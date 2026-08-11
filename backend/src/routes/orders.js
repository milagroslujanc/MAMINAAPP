const express = require('express');
const pool = require('../config/db');
const bus = require('../events');
const { asyncHandler } = require('../utils');

const router = express.Router();

async function recalcTotal(conn, orderId) {
  const [sumRows] = await conn.query(
    `SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  const total = Number(sumRows[0].total);
  await conn.query(`UPDATE orders SET total = ? WHERE id = ?`, [total, orderId]);
  return total;
}

async function upsertOrderItem(conn, orderId, product, qty, specialNotes) {
  const [existing] = await conn.query(
    `SELECT id, quantity FROM order_items
     WHERE order_id = ? AND product_id = ? AND (special_notes <=> ?)`,
    [orderId, product.id, specialNotes || null]
  );

  if (existing[0]) {
    await conn.query(`UPDATE order_items SET quantity = quantity + ? WHERE id = ?`, [
      qty,
      existing[0].id,
    ]);
  } else {
    await conn.query(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, special_notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, product.id, product.name, qty, product.price, specialNotes || null]
    );
  }

  await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, product.id]);
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { sessionToken, items, notes } = req.body || {};

    if (!sessionToken || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Sesión e ítems son obligatorios' });
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [sessions] = await conn.query(
        "SELECT id, table_id, order_type FROM sessions WHERE token = ? AND status = 'activa'",
        [sessionToken]
      );
      const session = sessions[0];
      if (!session) {
        await conn.rollback();
        return res.status(404).json({ message: 'Sesión inválida' });
      }

      const resolved = [];

      for (const item of items) {
        const [products] = await conn.query(
          'SELECT id, name, price, stock, is_active FROM products WHERE id = ? FOR UPDATE',
          [item.productId]
        );
        const product = products[0];
        if (!product || !product.is_active) {
          await conn.rollback();
          return res.status(400).json({ message: `Producto ${item.productId} no existe` });
        }
        if (Number(product.stock) <= 0) {
          await conn.rollback();
          return res.status(400).json({ message: `${product.name} está agotado` });
        }
        const qty = Math.max(1, Number(item.quantity) || 1);
        if (Number(product.stock) < qty) {
          await conn.rollback();
          return res.status(400).json({ message: `Stock insuficiente de ${product.name}` });
        }
        resolved.push({ product, quantity: qty, specialNotes: item.specialNotes || null });
      }

      const [existingOrders] = await conn.query(
        `SELECT id, status, notes FROM orders
         WHERE session_id = ? AND status NOT IN ('cancelado', 'entregado')
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [session.id]
      );

      let orderId;
      let orderStatus = 'pendiente';
      let orderNotes = notes || null;

      if (existingOrders[0]) {
        orderId = existingOrders[0].id;
        orderStatus = existingOrders[0].status;

        if (notes) {
          orderNotes = existingOrders[0].notes
            ? `${existingOrders[0].notes}\n${notes}`
            : notes;
        } else {
          orderNotes = existingOrders[0].notes;
        }

        for (const row of resolved) {
          await upsertOrderItem(conn, orderId, row.product, row.quantity, row.specialNotes);
        }

        const total = await recalcTotal(conn, orderId);
        const nextStatus = orderStatus === 'listo' ? 'pendiente' : orderStatus;

        await conn.query(
          `UPDATE orders SET notes = ?, status = ?, is_new = 1 WHERE id = ?`,
          [orderNotes, nextStatus, orderId]
        );

        await conn.commit();
        orderStatus = nextStatus;

        bus.emit('order:updated', { id: orderId });

        return res.status(200).json({
          orderId,
          total,
          status: orderStatus,
          isNewOrder: false,
          message: `Ítems agregados al pedido #${orderId}`,
        });
      }

      let batchTotal = 0;
      for (const row of resolved) {
        batchTotal += Number(row.product.price) * row.quantity;
      }

      const [orderResult] = await conn.query(
        `INSERT INTO orders (session_id, table_id, order_type, status, total, notes, is_new)
         VALUES (?, ?, ?, 'pendiente', ?, ?, 1)`,
        [session.id, session.table_id, session.order_type, batchTotal, notes || null]
      );
      orderId = orderResult.insertId;

      for (const row of resolved) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, special_notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            row.product.id,
            row.product.name,
            row.quantity,
            row.product.price,
            row.specialNotes,
          ]
        );
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [
          row.quantity,
          row.product.id,
        ]);
      }

      await conn.commit();

      let tableNumber = null;
      if (session.table_id) {
        const [tableRows] = await pool.query('SELECT number FROM `tables` WHERE id = ?', [
          session.table_id,
        ]);
        tableNumber = tableRows[0]?.number ?? null;
      }

      bus.emit('order:new', {
        id: orderId,
        status: 'pendiente',
        total: Number(batchTotal),
        order_type: session.order_type,
        is_new: true,
        notes: notes || null,
        created_at: new Date().toISOString(),
        table_number: tableNumber,
      });

      res.status(201).json({
        orderId,
        total: Number(batchTotal),
        status: 'pendiente',
        isNewOrder: true,
        message: 'Pedido enviado a cocina',
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const sessionToken = req.query.sessionToken;
    if (!sessionToken) {
      return res.status(400).json({ message: 'sessionToken es obligatorio' });
    }

    const [sessions] = await pool.query(
      "SELECT id FROM sessions WHERE token = ? AND status = 'activa'",
      [sessionToken]
    );
    if (!sessions[0]) {
      return res.status(404).json({ message: 'Sesión inválida' });
    }

    const sessionId = sessions[0].id;
    const [orders] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_type, o.notes, o.created_at, o.table_id
       FROM orders o
       WHERE o.session_id = ? AND o.status NOT IN ('cancelado', 'entregado')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    const order = orders[0];
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    const [tables] = await pool.query('SELECT number FROM `tables` WHERE id = ?', [order.table_id]);
    const tableNumber = tables[0]?.number ?? null;

    const [pendingReq] = await pool.query(
      `SELECT id FROM service_requests
       WHERE order_id = ? AND type = 'terminar_pedido' AND status = 'pendiente'
       LIMIT 1`,
      [order.id]
    );

    res.json({
      id: order.id,
      status: order.status,
      total: Number(order.total),
      order_type: order.order_type,
      notes: order.notes,
      created_at: order.created_at,
      table_number: tableNumber,
      finish_requested: Boolean(pendingReq[0]),
    });
  })
);

/** Cliente solicita terminar pedido → alerta al mesero (no cierra el pedido) */
router.post(
  '/request-finish',
  asyncHandler(async (req, res) => {
    const { sessionToken } = req.body || {};
    if (!sessionToken) {
      return res.status(400).json({ message: 'sessionToken es obligatorio' });
    }

    const [sessions] = await pool.query(
      `SELECT id, table_id FROM sessions WHERE token = ? AND status = 'activa'`,
      [sessionToken]
    );
    const session = sessions[0];
    if (!session) {
      return res.status(404).json({ message: 'Sesión inválida' });
    }

    const [orders] = await pool.query(
      `SELECT id, status, total, order_type, table_id
       FROM orders
       WHERE session_id = ? AND status NOT IN ('cancelado', 'entregado')
       ORDER BY id DESC
       LIMIT 1`,
      [session.id]
    );
    const order = orders[0];
    if (!order) {
      return res.status(404).json({ message: 'No hay pedido activo para solicitar el cierre' });
    }

    const [existing] = await pool.query(
      `SELECT id FROM service_requests
       WHERE order_id = ? AND type = 'terminar_pedido' AND status = 'pendiente'
       LIMIT 1`,
      [order.id]
    );
    if (existing[0]) {
      return res.json({
        id: existing[0].id,
        orderId: order.id,
        message: 'Ya solicitaste terminar el pedido. Un mesero te atenderá pronto.',
        alreadyRequested: true,
      });
    }

    const [result] = await pool.query(
      `INSERT INTO service_requests (order_id, session_id, table_id, type, status)
       VALUES (?, ?, ?, 'terminar_pedido', 'pendiente')`,
      [order.id, session.id, order.table_id || session.table_id || null]
    );

    let tableNumber = null;
    const tableId = order.table_id || session.table_id;
    if (tableId) {
      const [tables] = await pool.query('SELECT number FROM `tables` WHERE id = ?', [tableId]);
      tableNumber = tables[0]?.number ?? null;
    }

    const alert = {
      id: result.insertId,
      order_id: order.id,
      session_id: session.id,
      table_id: tableId || null,
      type: 'terminar_pedido',
      status: 'pendiente',
      created_at: new Date().toISOString(),
      total: Number(order.total),
      order_status: order.status,
      table_number: tableNumber,
    };

    bus.emit('alert:new', alert);

    res.status(201).json({
      id: alert.id,
      orderId: order.id,
      message: 'Solicitud enviada. Un mesero atenderá tu mesa en breve.',
      alreadyRequested: false,
    });
  })
);

module.exports = router;
