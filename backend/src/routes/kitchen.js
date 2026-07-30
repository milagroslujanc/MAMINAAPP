const express = require('express');
const pool = require('../config/db');
const bus = require('../events');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.get('/stream', (req, res) => {
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

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_type, o.is_new, o.notes, o.created_at,
              t.number AS table_number
       FROM orders o
       LEFT JOIN \`tables\` t ON t.id = o.table_id
       WHERE o.status IN ('pendiente', 'en_preparacion', 'listo')
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

    const [orders] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_type, o.notes, o.created_at,
              t.number AS table_number
       FROM orders o
       LEFT JOIN \`tables\` t ON t.id = o.table_id
       WHERE o.id = ?`,
      [orderId]
    );
    const order = orders[0];
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    const [items] = await pool.query(
      `SELECT id, order_id, product_id, product_name, quantity, unit_price, special_notes
       FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    res.json({
      id: order.id,
      status: order.status,
      total: Number(order.total),
      order_type: order.order_type,
      is_new: false,
      notes: order.notes,
      created_at: order.created_at,
      table_number: order.table_number ?? null,
      items: items.map((i) => ({ ...i, unit_price: Number(i.unit_price) })),
    });
  })
);

module.exports = router;
