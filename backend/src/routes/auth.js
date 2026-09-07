const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authStaff, normalizeRole, isStaffAccessOpen, CONTROLLED_ROLES } = require('../middleware/auth');
const bus = require('../events');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
    }

    let rows;
    try {
      [rows] = await pool.query(
        `SELECT id, username, password_hash, full_name, role FROM admins WHERE username = ?`,
        [username]
      );
    } catch (err) {
      // BD antigua sin columna role
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        [rows] = await pool.query(
          `SELECT id, username, password_hash, full_name FROM admins WHERE username = ?`,
          [username]
        );
      } else {
        throw err;
      }
    }

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Datos incorrectos' });
    }

    const role = normalizeRole({
      role: user.role,
      username: user.username,
    });

    if (CONTROLLED_ROLES.includes(role) && !(await isStaffAccessOpen(role))) {
      return res.status(403).json({ message: 'Acceso no disponible' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role,
      },
      process.env.JWT_SECRET || 'mamina_sprint1_secret_change_me',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role,
      },
    });
  })
);

router.get('/staff-access/stream', asyncHandler(async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'No autorizado' });

  let role;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'mamina_sprint1_secret_change_me');
    role = normalizeRole(payload);
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }

  if (!CONTROLLED_ROLES.includes(role)) {
    return res.status(403).json({ message: 'Este control no aplica al administrador' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  if (!(await isStaffAccessOpen(role))) {
    res.write(`data: ${JSON.stringify({ type: 'access_closed' })}\n\n`);
    return res.end();
  }

  const onClosed = (payload) => {
    if (payload.role === role) {
      res.write(`data: ${JSON.stringify({ type: 'access_closed' })}\n\n`);
    }
  };
  bus.on('staff:access-closed', onClosed);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('staff:access-closed', onClosed);
  });
}));

router.get('/me', authStaff, (req, res) => {
  res.json({
    admin: {
      id: req.staff.id,
      username: req.staff.username,
      fullName: req.staff.fullName,
      role: req.staff.role,
    },
  });
});

module.exports = router;
