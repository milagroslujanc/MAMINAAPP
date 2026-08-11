const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const bus = require('../events');
const { requireStaff, normalizeRole } = require('../middleware/auth');
const { uuid, asyncHandler } = require('../utils');

const router = express.Router();

function authStaffFromQuery(req, res, next) {
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
    if (!['admin', 'mesero'].includes(role)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    req.staff = { ...payload, role };
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

router.get('/alerts/stream', authStaffFromQuery, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: 'connected' });

  const onAlert = (alert) => send({ type: 'alert', alert });
  const onAttended = (payload) => send({ type: 'alert_attended', id: payload.id });
  bus.on('alert:new', onAlert);
  bus.on('alert:attended', onAttended);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('alert:new', onAlert);
    bus.off('alert:attended', onAttended);
  });
});

router.use(requireStaff);

router.get(
  '/floor/tables',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT t.id, t.number, t.capacity, t.status, t.qr_token, t.is_active,
              s.id AS session_id, s.token AS session_token, s.status AS session_status
       FROM \`tables\` t
       LEFT JOIN sessions s ON s.table_id = t.id AND s.status = 'activa'
       WHERE t.is_active = 1
       ORDER BY t.number`
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        number: row.number,
        capacity: row.capacity,
        status: row.status,
        hasQr: Boolean(row.qr_token),
        sessionId: row.session_id || null,
        sessionToken: row.session_token || null,
        sessionStatus: row.session_status || null,
      }))
    );
  })
);

/** Apertura de mesa por personal: ocupada, sesión activa, sin QR */
router.post(
  '/floor/tables/:id/open',
  asyncHandler(async (req, res) => {
    const tableId = Number(req.params.id);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [tables] = await conn.query(
        'SELECT id, number, status, is_active FROM `tables` WHERE id = ? FOR UPDATE',
        [tableId]
      );
      const table = tables[0];
      if (!table) {
        await conn.rollback();
        return res.status(404).json({ message: 'Mesa no encontrada' });
      }
      if (!table.is_active) {
        await conn.rollback();
        return res.status(403).json({ message: 'Esta mesa está desactivada' });
      }
      if (table.status === 'ocupada') {
        await conn.rollback();
        return res.status(409).json({ message: 'La mesa ya está ocupada' });
      }

      const sessionToken = uuid();
      await conn.query('UPDATE `tables` SET status = ?, qr_token = NULL WHERE id = ?', [
        'ocupada',
        tableId,
      ]);
      const [sessionResult] = await conn.query(
        "INSERT INTO sessions (token, table_id, order_type, status) VALUES (?, ?, 'mesa', 'activa')",
        [sessionToken, tableId]
      );

      await conn.commit();

      res.status(201).json({
        table: { id: table.id, number: table.number, status: 'ocupada' },
        session: { id: sessionResult.insertId, token: sessionToken },
        message: `Mesa ${table.number} aperturada. Ya no se puede generar QR sobre esta mesa.`,
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
  '/floor/takeaway',
  asyncHandler(async (_req, res) => {
    const sessionToken = uuid();
    const [result] = await pool.query(
      "INSERT INTO sessions (token, table_id, order_type, status) VALUES (?, NULL, 'llevar', 'activa')",
      [sessionToken]
    );

    res.status(201).json({
      table: null,
      session: { id: result.insertId, token: sessionToken, order_type: 'llevar' },
      message: 'Sesión para llevar creada (sin QR)',
    });
  })
);

router.get(
  '/alerts',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT r.id, r.order_id, r.session_id, r.table_id, r.type, r.status, r.created_at,
              o.total, o.status AS order_status, t.number AS table_number
       FROM service_requests r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN \`tables\` t ON t.id = r.table_id
       WHERE r.status = 'pendiente'
       ORDER BY r.created_at ASC`
    );

    res.json(
      rows.map((r) => ({
        ...r,
        total: Number(r.total),
      }))
    );
  })
);

router.post(
  '/alerts/:id/attend',
  asyncHandler(async (req, res) => {
    const alertId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, status FROM service_requests WHERE id = ?`,
      [alertId]
    );
    const alert = rows[0];
    if (!alert) return res.status(404).json({ message: 'Alerta no encontrada' });
    if (alert.status !== 'pendiente') {
      return res.json({ id: alertId, message: 'La alerta ya estaba atendida' });
    }

    await pool.query(
      `UPDATE service_requests
       SET status = 'atendida', attended_at = NOW(), attended_by = ?
       WHERE id = ?`,
      [req.staff.id || null, alertId]
    );

    bus.emit('alert:attended', { id: alertId });
    res.json({ id: alertId, message: 'Alerta marcada como atendida' });
  })
);

module.exports = router;
