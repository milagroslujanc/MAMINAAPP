const express = require('express');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.use(requireAdmin);

function mapTable(row) {
  return {
    ...row,
    is_active: Boolean(row.is_active),
  };
}

router.get(
  '/tables',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT id, number, capacity, status, qr_token, is_active, updated_at
       FROM \`tables\`
       ORDER BY number`
    );
    res.json(rows.map(mapTable));
  })
);

router.post(
  '/tables',
  asyncHandler(async (req, res) => {
    const { number, capacity, isActive } = req.body || {};
    const tableNumber = Number(number);
    const tableCapacity = Number(capacity);

    if (!tableNumber || tableNumber < 1) {
      return res.status(400).json({ message: 'Número de mesa inválido' });
    }
    if (!tableCapacity || tableCapacity < 1) {
      return res.status(400).json({ message: 'Capacidad inválida' });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO \`tables\` (number, capacity, status, is_active)
         VALUES (?, ?, 'libre', ?)`,
        [tableNumber, tableCapacity, isActive === false || isActive === 0 ? 0 : 1]
      );

      const [rows] = await pool.query(
        `SELECT id, number, capacity, status, qr_token, is_active, updated_at
         FROM \`tables\` WHERE id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        ...mapTable(rows[0]),
        message: `Mesa ${tableNumber} creada y habilitada`,
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: `Ya existe la mesa número ${tableNumber}` });
      }
      throw err;
    }
  })
);

router.put(
  '/tables/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { number, capacity, isActive } = req.body || {};
    const tableNumber = Number(number);
    const tableCapacity = Number(capacity);

    const [existing] = await pool.query(
      `SELECT id, status FROM \`tables\` WHERE id = ?`,
      [id]
    );
    if (!existing[0]) {
      return res.status(404).json({ message: 'Mesa no encontrada' });
    }

    if (!tableNumber || tableNumber < 1) {
      return res.status(400).json({ message: 'Número de mesa inválido' });
    }
    if (!tableCapacity || tableCapacity < 1) {
      return res.status(400).json({ message: 'Capacidad inválida' });
    }

    const active = isActive === false || isActive === 0 ? 0 : 1;

    try {
      // Si se desactiva y estaba ocupada, liberar sesión
      if (!active && existing[0].status === 'ocupada') {
        await pool.query(
          `UPDATE \`tables\` SET number = ?, capacity = ?, is_active = 0,
             status = 'libre', qr_token = NULL WHERE id = ?`,
          [tableNumber, tableCapacity, id]
        );
        await pool.query(
          `UPDATE sessions SET status = 'cerrada' WHERE table_id = ? AND status = 'activa'`,
          [id]
        );
      } else {
        await pool.query(
          `UPDATE \`tables\` SET number = ?, capacity = ?, is_active = ? WHERE id = ?`,
          [tableNumber, tableCapacity, active, id]
        );
      }
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: `Ya existe la mesa número ${tableNumber}` });
      }
      throw err;
    }

    const [rows] = await pool.query(
      `SELECT id, number, capacity, status, qr_token, is_active, updated_at
       FROM \`tables\` WHERE id = ?`,
      [id]
    );

    res.json({
      ...mapTable(rows[0]),
      message: 'Mesa actualizada',
    });
  })
);

router.patch(
  '/tables/:id/active',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const active = req.body?.isActive;

    if (typeof active !== 'boolean' && active !== 0 && active !== 1) {
      return res.status(400).json({ message: 'isActive debe ser true o false' });
    }

    const [existing] = await pool.query(
      `SELECT id, number, status FROM \`tables\` WHERE id = ?`,
      [id]
    );
    if (!existing[0]) {
      return res.status(404).json({ message: 'Mesa no encontrada' });
    }

    const value = active === true || active === 1 ? 1 : 0;

    if (!value) {
      await pool.query(
        `UPDATE \`tables\` SET is_active = 0, status = 'libre', qr_token = NULL WHERE id = ?`,
        [id]
      );
      await pool.query(
        `UPDATE sessions SET status = 'cerrada' WHERE table_id = ? AND status = 'activa'`,
        [id]
      );
    } else {
      await pool.query(`UPDATE \`tables\` SET is_active = 1 WHERE id = ?`, [id]);
    }

    res.json({
      id,
      is_active: Boolean(value),
      message: value
        ? `Mesa ${existing[0].number} habilitada`
        : `Mesa ${existing[0].number} desactivada — no acepta nuevos pedidos`,
    });
  })
);

router.delete(
  '/tables/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await pool.query(
      `SELECT id, number FROM \`tables\` WHERE id = ?`,
      [id]
    );
    if (!existing[0]) {
      return res.status(404).json({ message: 'Mesa no encontrada' });
    }

    // Soft-delete: desactiva y libera (conserva historial de pedidos)
    await pool.query(
      `UPDATE \`tables\` SET is_active = 0, status = 'libre', qr_token = NULL WHERE id = ?`,
      [id]
    );
    await pool.query(
      `UPDATE sessions SET status = 'cerrada' WHERE table_id = ? AND status = 'activa'`,
      [id]
    );

    res.json({
      id,
      message: `Mesa ${existing[0].number} eliminada del salón (desactivada)`,
    });
  })
);

module.exports = router;
