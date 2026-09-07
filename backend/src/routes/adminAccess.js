const express = require('express');
const pool = require('../config/db');
const bus = require('../events');
const { requireAdmin, CONTROLLED_ROLES } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();
router.use(requireAdmin);

function mapAccess(row) {
  return { role: row.role, isOpen: Boolean(row.is_open) };
}

router.get('/staff-access', asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT role, is_open FROM staff_access WHERE role IN (?, ?) ORDER BY role',
    CONTROLLED_ROLES
  );
  const access = Object.fromEntries(rows.map((row) => [row.role, mapAccess(row)]));
  for (const role of CONTROLLED_ROLES) {
    access[role] ||= { role, isOpen: true };
  }
  res.json(access);
}));

router.patch('/staff-access/:role', asyncHandler(async (req, res) => {
  const { role } = req.params;
  if (!CONTROLLED_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Rol inválido' });
  }
  if (typeof req.body?.isOpen !== 'boolean') {
    return res.status(400).json({ message: 'isOpen debe ser booleano' });
  }

  const isOpen = req.body.isOpen ? 1 : 0;
  const [previous] = await pool.query('SELECT is_open FROM staff_access WHERE role = ?', [role]);
  await pool.query(
    `INSERT INTO staff_access (role, is_open) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE is_open = VALUES(is_open), updated_at = CURRENT_TIMESTAMP`,
    [role, isOpen]
  );

  if (previous[0]?.is_open && !isOpen) {
    bus.emit('staff:access-closed', { role });
  }

  res.json({ role, isOpen: Boolean(isOpen), message: isOpen ? 'Acceso abierto' : 'Acceso cerrado' });
}));

module.exports = router;