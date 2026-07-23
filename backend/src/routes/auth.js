const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
    }

    const [rows] = await pool.query(
      `SELECT id, username, password_hash, full_name FROM admins WHERE username = ?`,
      [username]
    );
    const admin = rows[0];

    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ message: 'Datos incorrectos' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, fullName: admin.full_name },
      process.env.JWT_SECRET || 'mamina_sprint1_secret_change_me',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: { id: admin.id, username: admin.username, fullName: admin.full_name },
    });
  })
);

router.get('/me', authAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      fullName: req.admin.fullName,
    },
  });
});

module.exports = router;
