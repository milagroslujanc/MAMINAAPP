const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const bus = require('../events');
const { requireKitchen, normalizeRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();

function authKitchenFromQuery(req, res, next) {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'mamina_sprint1_secret_change_me'
    );
    const role = normalizeRole(payload);
    if (!['admin', 'cocina'].includes(role)) {
      return res.status(403).json({ message: 'Acceso denegado. Entra por /cocina' });
    }
    req.staff = { ...payload, role };
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

async function getKitchenDetail(orderId) {
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
    `SELECT id, order_id, product_id, product_name, quantity, unit_price, special_notes
     FROM order_items WHERE order_id = ?`,
    [orderId]
  );

  return {
    id: order.id,
    status: order.status,
    total: Number(order.total),
    order_type: order.order_type,
    is_new: false,
    notes: order.notes,
    created_at: order.created_at,
    table_number: order.table_number ?? null,
    items: items.map((i) => ({ ...i, unit_price: Number(i.unit_price) })),
  };
}

router.get('/stream', authKitchenFromQuery, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: 'connected' });

  const onOrder = (order) => send({ type: 'order', order });
  const onCancel = (payload) => send({ type: 'order_cancelled', orderId: payload.id });
  const onUpdate = (payload) => send({ type: 'order_updated', orderId: payload.id });
  bus.on('order:new', onOrder);
  bus.on('order:cancelled', onCancel);
  bus.on('order:updated', onUpdate);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('order:new', onOrder);
    bus.off('order:cancelled', onCancel);
    bus.off('order:updated', onUpdate);
  });
});

router.use(requireKitchen);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_type, o.is_new, o.notes, o.created_at,
              t.number AS table_number
       FROM orders o
       LEFT JOIN \`tables\` t ON t.id = o.table_id
       WHERE DATE(o.created_at) = CURDATE()
         AND o.status IN ('pendiente', 'en_preparacion', 'listo')
       ORDER BY o.created_at ASC`
    );

    res.json(
      rows.map((o) => ({
        ...o,
        total: Number(o.total),
        is_new: Boolean(o.is_new),
      }))
    );
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    await pool.query('UPDATE orders SET is_new = 0 WHERE id = ?', [orderId]);
    const detail = await getKitchenDetail(orderId);
    if (!detail) return res.status(404).json({ message: 'Pedido no encontrado' });
    res.json(detail);
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const status = req.body?.status;

    if (!['en_preparacion', 'listo'].includes(status)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    const [orders] = await pool.query('SELECT id, status FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (status === 'en_preparacion' && !['pendiente', 'listo'].includes(order.status)) {
      return res.status(409).json({
        message: 'Solo se puede poner en preparación un pedido pendiente o listo',
      });
    }
    if (status === 'listo' && order.status !== 'en_preparacion') {
      return res.status(409).json({ message: 'Solo se puede marcar listo un pedido en preparación' });
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    bus.emit('order:updated', { id: orderId });

    const detail = await getKitchenDetail(orderId);
    const reverted = status === 'en_preparacion' && order.status === 'listo';
    res.json({
      ...detail,
      message: status === 'listo'
        ? 'Pedido marcado como listo'
        : reverted
          ? 'Pedido vuelto a preparación'
          : 'Pedido en preparación',
    });
  })
);

module.exports = router;
