const express = require('express');
const pool = require('../config/db');
const bus = require('../events');
const { requireStaff, requireAdmin } = require('../middleware/auth');
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

async function hasPendingFinish(conn, orderId) {
  const [rows] = await conn.query(
    `SELECT id FROM service_requests
     WHERE order_id = ? AND type = 'terminar_pedido' AND status = 'pendiente'
     LIMIT 1`,
    [orderId]
  );
  return Boolean(rows[0]);
}

async function getOrderDetail(orderId) {
  const [orders] = await pool.query(
    `SELECT o.id, o.status, o.total, o.order_type, o.notes, o.created_at,
            t.number AS table_number, s.status AS session_status
     FROM orders o
     LEFT JOIN \`tables\` t ON t.id = o.table_id
     LEFT JOIN sessions s ON s.id = o.session_id
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

  const [pending] = await pool.query(
    `SELECT id FROM service_requests
     WHERE order_id = ? AND type = 'terminar_pedido' AND status = 'pendiente'
     LIMIT 1`,
    [orderId]
  );

  return {
    ...order,
    total: Number(order.total),
    charged: order.status !== 'cancelado',
    finish_requested: Boolean(pending[0]),
    items: items.map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      quantity: Number(i.quantity),
    })),
  };
}

router.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'entregado' THEN total END), 0) AS dailyRevenue,
         COALESCE(COUNT(CASE WHEN DATE(created_at) = CURDATE() AND status = 'entregado' THEN 1 END), 0) AS dailyCompleted,
         COALESCE(COUNT(DISTINCT CASE WHEN DATE(created_at) = CURDATE() THEN session_id END), 0) AS dailyClients,

         COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND status = 'entregado' THEN total END), 0) AS monthlyRevenue,
         COALESCE(COUNT(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) AND status = 'entregado' THEN 1 END), 0) AS monthlyCompleted,
         COALESCE(COUNT(DISTINCT CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN session_id END), 0) AS monthlyClients,

         COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND status = 'entregado' THEN total END), 0) AS yearlyRevenue,
         COALESCE(COUNT(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND status = 'entregado' THEN 1 END), 0) AS yearlyCompleted,
         COALESCE(COUNT(DISTINCT CASE WHEN YEAR(created_at) = YEAR(CURDATE()) THEN session_id END), 0) AS yearlyClients
       FROM orders`
    );

    const [currentMonth] = await pool.query(
      `SELECT DAY(created_at) AS day, COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE status = 'entregado'
         AND YEAR(created_at) = YEAR(CURDATE())
         AND MONTH(created_at) = MONTH(CURDATE())
       GROUP BY DAY(created_at)
       ORDER BY day`
    );

    const [previousMonth] = await pool.query(
      `SELECT DAY(created_at) AS day, COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE status = 'entregado'
         AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
         AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
       GROUP BY DAY(created_at)
       ORDER BY day`
    );

    const row = rows[0] || {};
    res.json({
      daily: {
        revenue: Number(row.dailyRevenue),
        completedOrders: Number(row.dailyCompleted),
        clients: Number(row.dailyClients),
      },
      monthly: {
        revenue: Number(row.monthlyRevenue),
        completedOrders: Number(row.monthlyCompleted),
        clients: Number(row.monthlyClients),
      },
      yearly: {
        revenue: Number(row.yearlyRevenue),
        completedOrders: Number(row.yearlyCompleted),
        clients: Number(row.yearlyClients),
      },
      salesHistogram: {
        currentMonth: currentMonth.map((d) => ({ day: Number(d.day), total: Number(d.total) })),
        previousMonth: previousMonth.map((d) => ({ day: Number(d.day), total: Number(d.total) })),
        currentMonthLabel: new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }),
        previousMonthLabel: new Date(
          new Date().getFullYear(),
          new Date().getMonth() - 1,
          1
        ).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }),
        daysInCurrentMonth: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          0
        ).getDate(),
        daysInPreviousMonth: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          0
        ).getDate(),
      },
    });
  })
);

router.get(
  '/stats/orders',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ message: 'Parámetros from y to requeridos (YYYY-MM-DD)' });
    }
    if (from > to) {
      return res.status(400).json({ message: 'El rango de fechas es inválido' });
    }

    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_type, o.notes, o.created_at,
              t.number AS table_number
       FROM orders o
       LEFT JOIN \`tables\` t ON t.id = o.table_id
       WHERE o.status = 'entregado'
         AND DATE(o.created_at) BETWEEN ? AND ?
       ORDER BY o.created_at DESC`,
      [from, to]
    );

    const list = rows.map((o) => ({
      ...o,
      total: Number(o.total),
    }));
    const totalSales = list.reduce((sum, o) => sum + o.total, 0);

    res.json({
      from,
      to,
      totalSales,
      count: list.length,
      orders: list,
    });
  })
);

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
              t.number AS table_number, s.status AS session_status,
              EXISTS (
                SELECT 1 FROM service_requests r
                WHERE r.order_id = o.id AND r.type = 'terminar_pedido' AND r.status = 'pendiente'
              ) AS finish_requested
       FROM orders o
       LEFT JOIN \`tables\` t ON t.id = o.table_id
       LEFT JOIN sessions s ON s.id = o.session_id
       WHERE DATE(o.created_at) = CURDATE()
       ORDER BY o.created_at DESC`
    );

    res.json(
      rows.map((o) => ({
        ...o,
        total: Number(o.total),
        charged: o.status !== 'cancelado',
        finish_requested: Boolean(o.finish_requested),
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
      if (await hasPendingFinish(conn, orderId)) {
        await conn.rollback();
        return res.status(409).json({
          message: 'Ya se solicitó la cuenta. No se pueden agregar más productos a cocina.',
        });
      }

      const [products] = await conn.query(
        `SELECT id, name, price, is_active FROM products WHERE id = ? FOR UPDATE`,
        [productId]
      );
      const product = products[0];
      if (!product || !product.is_active) {
        await conn.rollback();
        return res.status(400).json({ message: 'Producto no disponible' });
      }

      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, special_notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, product.id, product.name, qty, product.price, specialNotes || null]
      );
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
      if (quantity !== undefined && (await hasPendingFinish(conn, orderId))) {
        await conn.rollback();
        return res.status(409).json({
          message: 'Ya se solicitó la cuenta. No se pueden agregar más productos a cocina.',
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
        if (newQty !== Number(item.quantity)) {
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
  '/orders/:id/close-session',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [orders] = await conn.query(
        `SELECT id, session_id, status FROM orders WHERE id = ? FOR UPDATE`,
        [orderId]
      );
      const order = orders[0];
      if (!order) {
        await conn.rollback();
        return res.status(404).json({ message: 'Pedido no encontrado' });
      }
      if (order.status === 'entregado') {
        await conn.rollback();
        return res.json({ id: orderId, message: 'El pedido ya estaba terminado' });
      }
      if (order.status === 'cancelado') {
        await conn.rollback();
        return res.status(409).json({ message: 'No se puede terminar un pedido cancelado' });
      }

      const [sessions] = await conn.query(
        `SELECT id, table_id, status, token FROM sessions WHERE id = ? FOR UPDATE`,
        [order.session_id]
      );
      const session = sessions[0];

      await conn.query(`UPDATE orders SET status = 'entregado', is_new = 0 WHERE id = ?`, [
        orderId,
      ]);

      if (session && session.status === 'activa') {
        await conn.query(`UPDATE sessions SET status = 'cerrada' WHERE id = ?`, [session.id]);
      }

      if (session?.table_id) {
        await conn.query(
          `UPDATE tables SET status = 'libre', qr_token = NULL WHERE id = ?`,
          [session.table_id]
        );
      }

      const [pendingAlerts] = await conn.query(
        `SELECT id FROM service_requests WHERE order_id = ? AND status = 'pendiente'`,
        [orderId]
      );
      await conn.query(
        `UPDATE service_requests
         SET status = 'atendida', attended_at = NOW(), attended_by = ?
         WHERE order_id = ? AND status = 'pendiente'`,
        [req.staff?.id || null, orderId]
      );

      await conn.commit();
      bus.emit('order:updated', { id: orderId });
      if (session?.status === 'activa' && session.token) {
        bus.emit('session:closed', { sessionToken: session.token });
      }
      pendingAlerts.forEach((alert) => bus.emit('alert:attended', { id: alert.id }));

      res.json({
        id: orderId,
        message: 'Pedido terminado: mesa liberada, pedido entregado y sesión del cliente cerrada',
      });
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
