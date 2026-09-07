const express = require('express');
const pool = require('../config/db');
const bus = require('../events');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.get('/:token/stream', (req, res) => {
  const { token } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: 'connected' });

  const onClosed = (payload) => {
    if (payload.sessionToken === token) {
      send({ type: 'session_closed' });
    }
  };

  bus.on('session:closed', onClosed);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('session:closed', onClosed);
  });
});

router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const [byQr] = await pool.query(
      'SELECT t.id, t.number, t.qr_token FROM `tables` t WHERE t.qr_token = ?',
      [token]
    );

    if (byQr[0]) {
      const table = byQr[0];
      const [sessions] = await pool.query(
        "SELECT id, token, order_type FROM sessions WHERE table_id = ? AND status = 'activa' ORDER BY id DESC LIMIT 1",
        [table.id]
      );
      if (!sessions[0]) {
        return res.status(404).json({ message: 'Sesión no encontrada para esta mesa' });
      }
      return res.json({
        sessionToken: sessions[0].token,
        tableId: table.id,
        tableNumber: table.number,
        orderType: sessions[0].order_type,
      });
    }

    const [sessions] = await pool.query(
      `SELECT s.id, s.token, s.table_id, s.order_type, t.number AS table_number
       FROM sessions s
       LEFT JOIN \`tables\` t ON t.id = s.table_id
       WHERE s.token = ? AND s.status = 'activa'`,
      [token]
    );

    if (!sessions[0]) {
      return res.status(404).json({ message: 'Código QR inválido o expirado' });
    }

    const session = sessions[0];
    res.json({
      sessionToken: session.token,
      tableId: session.table_id,
      tableNumber: session.table_number ?? null,
      orderType: session.order_type,
    });
  })
);

module.exports = router;
