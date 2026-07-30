const express = require('express');
const pool = require('../config/db');
const bus = require('../events');
const { requireStaff } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.use(requireStaff);

async function recalcTotal(conn, orderId) {
  const [sumRows] = await conn.query(
    `SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  const total = Number(sumRows[0].total);
  await conn.query(`UPDATE orders SET total = ? WHERE id = ?`, [total, orderId]);
  return total;
}

async function getOrderDetail(orderId) {
  const [orders] = await pool.query(
    `SELECT o.id, o.status, o.total, o.order_type, o.notes, o.created_at,
            t.number AS table_number
     FROM orders o
     LEFT JOIN \`tables\` t ON t.id = o.table_id
     WHERE o.id = ?`,
    [orderId]
  );
  const order = orders[0];
  if (!order) return null;

  const [items] = await pool.query(
    `SELECT id, product_id, product_name, quantity, unit_price, special_notes
     FROM order_items WHERE order_id = ?`,
    [orderId]
  );

  return {
    ...order,
    total: Number(order.total),
    charged: order.status !== 'cancelado',
    items: items.map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      quantity: Number(i.quantity),
    })),
  };
}

function assertEditable(order, res) {
  if (!order) {
    res.status(404).json({ message: 'Pedido no encontrado' });
    return false;
  }
  if (order.status === 'cancelado') {
    res.status(409).json({ message: 'No se puede editar un pedido cancelado' });
    return false;
  }
  if (order.status === 'entregado') {
    res.status(409).json({ message: 'No se puede editar un pedido entregado' });
    return false;
  }
  return true;
}

router.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_type, o.notes, o.created_at, o.updated_at,
              t.number AS table_number
       FROM orders o
       LEFT JOIN \`tables\` t ON t.id = o.table_id
       WHERE DATE(o.created_at) = CURDATE()
       ORDER BY o.created_at DESC`
    );

    res.json(
      rows.map((o) => ({
        ...o,
        total: Number(o.total),
        charged: o.status !== 'cancelado',
      }))
    );
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const detail = await getOrderDetail(Number(req.params.id));
    if (!detail) return res.status(404).json({ message: 'Pedido no encontrado' });
    res.json(detail);
  })
);

router.patch(
  '/orders/:id/notes',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const notes = req.body?.notes ?? '';

    const [orders] = await pool.query(`SELECT id, status FROM orders WHERE id = ?`, [orderId]);
    if (!assertEditable(orders[0], res)) return;

    await pool.query(`UPDATE orders SET notes = ? WHERE id = ?`, [String(notes), orderId]);
    bus.emit('order:updated', { id: orderId });

    const detail = await getOrderDetail(orderId);
    res.json({ ...detail, message: 'Notas actualizadas' });
  })
);

router.post(
  '/orders/:id/items',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const { productId, quantity, specialNotes } = req.body || {};
    const qty = Math.max(1, Number(quantity) || 1);

    if (!productId) {
      return res.status(400).json({ message: 'productId es obligatorio' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orders] = await conn.query(`SELECT id, status FROM orders WHERE id = ? FOR UPDATE`, [
        orderId,
      ]);
      if (!orders[0] || orders[0].status === 'cancelado' || orders[0].status === 'entregado') {
        await conn.rollback();
        return res.status(409).json({
          message: !orders[0] ? 'Pedido no encontrado' : 'No se puede editar este pedido',
        });
      }

      const [products] = await conn.query(
        `SELECT id, name, price, stock, is_active FROM products WHERE id = ? FOR UPDATE`,
        [productId]
      );
      const product = products[0];
      if (!product || !product.is_active) {
        await conn.rollback();
        return res.status(400).json({ message: 'Producto no disponible' });
      }
      if (Number(product.stock) < qty) {
        await conn.rollback();
        return res.status(400).json({ message: `Stock insuficiente de ${product.name}` });
      }

      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, special_notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, product.id, product.name, qty, product.price, specialNotes || null]
      );
      await conn.query(`UPDATE products SET stock = stock - ? WHERE id = ?`, [qty, product.id]);
      const total = await recalcTotal(conn, orderId);
      await conn.commit();

      bus.emit('order:updated', { id: orderId });
      const detail = await getOrderDetail(orderId);
      res.status(201).json({
        ...detail,
        total,
        message: `${product.name} agregado al pedido`,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

router.patch(
  '/orders/:id/items/:itemId',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const { quantity, specialNotes } = req.body || {};

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orders] = await conn.query(`SELECT id, status FROM orders WHERE id = ? FOR UPDATE`, [
        orderId,
      ]);
      if (!orders[0] || orders[0].status === 'cancelado' || orders[0].status === 'entregado') {
        await conn.rollback();
        return res.status(409).json({
          message: !orders[0] ? 'Pedido no encontrado' : 'No se puede editar este pedido',
        });
      }

      const [items] = await conn.query(
        `SELECT id, product_id, quantity, special_notes FROM order_items WHERE id = ? AND order_id = ? FOR UPDATE`,
        [itemId, orderId]
      );
      const item = items[0];
      if (!item) {
        await conn.rollback();
        return res.status(404).json({ message: 'Ítem no encontrado' });
      }

      if (quantity !== undefined) {
        const newQty = Math.max(1, Number(quantity) || 1);
        const diff = newQty - Number(item.quantity);
        if (diff !== 0) {
          const [products] = await conn.query(
            `SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE`,
            [item.product_id]
          );
          const product = products[0];
          if (!product) {
            await conn.rollback();
            return res.status(400).json({ message: 'Producto no encontrado' });
          }
          if (diff > 0 && Number(product.stock) < diff) {
            await conn.rollback();
            return res.status(400).json({ message: `Stock insuficiente de ${product.name}` });
          }
          await conn.query(`UPDATE products SET stock = stock - ? WHERE id = ?`, [
            diff,
            item.product_id,
          ]);
          await conn.query(`UPDATE order_items SET quantity = ? WHERE id = ?`, [newQty, itemId]);
        }
      }

      if (specialNotes !== undefined) {
        await conn.query(`UPDATE order_items SET special_notes = ? WHERE id = ?`, [
          specialNotes ? String(specialNotes) : null,
          itemId,
        ]);
      }

      const total = await recalcTotal(conn, orderId);
      await conn.commit();

      bus.emit('order:updated', { id: orderId });
      const detail = await getOrderDetail(orderId);
      res.json({ ...detail, total, message: 'Ítem actualizado' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

router.delete(
  '/orders/:id/items/:itemId',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const itemId = Number(req.params.itemId);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orders] = await conn.query(`SELECT id, status FROM orders WHERE id = ? FOR UPDATE`, [
        orderId,
      ]);
      if (!orders[0] || orders[0].status === 'cancelado' || orders[0].status === 'entregado') {
        await conn.rollback();
        return res.status(409).json({
          message: !orders[0] ? 'Pedido no encontrado' : 'No se puede editar este pedido',
        });
      }

      const [items] = await conn.query(
        `SELECT id, product_id, quantity FROM order_items WHERE id = ? AND order_id = ?`,
        [itemId, orderId]
      );
      const item = items[0];
      if (!item) {
        await conn.rollback();
        return res.status(404).json({ message: 'Ítem no encontrado' });
      }

      await conn.query(`UPDATE products SET stock = stock + ? WHERE id = ?`, [
        item.quantity,
        item.product_id,
      ]);
      await conn.query(`DELETE FROM order_items WHERE id = ?`, [itemId]);

      const [remaining] = await conn.query(
        `SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      if (Number(remaining[0].c) === 0) {
        await conn.query(
          `UPDATE orders SET status = 'cancelado', is_new = 0, total = 0 WHERE id = ?`,
          [orderId]
        );
        await conn.commit();
        bus.emit('order:cancelled', { id: orderId });
        return res.json({
          id: orderId,
          status: 'cancelado',
          charged: false,
          items: [],
          message: 'Pedido sin ítems — se canceló automáticamente',
        });
      }

      const total = await recalcTotal(conn, orderId);
      await conn.commit();
      bus.emit('order:updated', { id: orderId });
      const detail = await getOrderDetail(orderId);
      res.json({ ...detail, total, message: 'Ítem eliminado del pedido' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

router.post(
  '/orders/:id/cancel',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [orders] = await conn.query(
        `SELECT id, status, total FROM orders WHERE id = ? FOR UPDATE`,
        [orderId]
      );
      const order = orders[0];
      if (!order) {
        await conn.rollback();
        return res.status(404).json({ message: 'Pedido no encontrado' });
      }
      if (order.status === 'cancelado') {
        await conn.rollback();
        return res.status(409).json({ message: 'El pedido ya está cancelado' });
      }
      if (order.status === 'entregado') {
        await conn.rollback();
        return res.status(409).json({ message: 'No se puede cancelar un pedido entregado' });
      }

      const [items] = await conn.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      for (const item of items) {
        await conn.query(`UPDATE products SET stock = stock + ? WHERE id = ?`, [
          item.quantity,
          item.product_id,
        ]);
      }

      await conn.query(
        `UPDATE orders SET status = 'cancelado', is_new = 0, notes = CONCAT(IFNULL(notes, ''), ?) WHERE id = ?`,
        [`\n[Cancelado por ${req.staff.role}: ${req.staff.username}]`, orderId]
      );

      await conn.commit();
      bus.emit('order:cancelled', { id: orderId });

      res.json({
        id: orderId,
        status: 'cancelado',
        charged: false,
        message: `Pedido #${orderId} cancelado — no se cobra y se retiró de cocina`,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
