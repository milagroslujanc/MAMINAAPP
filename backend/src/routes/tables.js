const express = require('express');
const pool = require('../config/db');
const { uuid, asyncHandler } = require('../utils');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT id, number, capacity, status, qr_token
       FROM \`tables\`
       WHERE is_active = 1
       ORDER BY number`
    );
    res.json(rows);
  })
);

router.post(
  '/:id/select',
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
        return res.status(403).json({ message: 'Esta mesa está desactivada y no admite pedidos' });
      }
      if (table.status === 'ocupada') {
        await conn.rollback();
        return res.status(409).json({ message: 'La mesa ya está ocupada' });
      }

      const qrToken = uuid();
      const sessionToken = uuid();

      await conn.query('UPDATE `tables` SET status = ?, qr_token = ? WHERE id = ?', [
        'ocupada',
        qrToken,
        tableId,
      ]);

      const [sessionResult] = await conn.query(
        "INSERT INTO sessions (token, table_id, order_type, status) VALUES (?, ?, 'mesa', 'activa')",
        [sessionToken, tableId]
      );

      await conn.commit();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.status(201).json({
        table: { id: table.id, number: table.number, status: 'ocupada', qr_token: qrToken },
        session: { id: sessionResult.insertId, token: sessionToken },
        qrUrl: `${frontendUrl}/s/${qrToken}`,
        qrToken,
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
  '/takeaway',
  asyncHandler(async (_req, res) => {
    const sessionToken = uuid();
    const [result] = await pool.query(
      "INSERT INTO sessions (token, table_id, order_type, status) VALUES (?, NULL, 'llevar', 'activa')",
      [sessionToken]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.status(201).json({
      table: null,
      session: { id: result.insertId, token: sessionToken, order_type: 'llevar' },
      qrUrl: `${frontendUrl}/s/${sessionToken}`,
      qrToken: sessionToken,
      orderType: 'llevar',
    });
  })
);

router.post(
  '/:id/release',
  asyncHandler(async (req, res) => {
    const tableId = Number(req.params.id);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [tables] = await conn.query('SELECT id FROM `tables` WHERE id = ? FOR UPDATE', [
        tableId,
      ]);
      if (!tables[0]) {
        await conn.rollback();
        return res.status(404).json({ message: 'Mesa no encontrada' });
      }

      await conn.query('UPDATE `tables` SET status = ?, qr_token = NULL WHERE id = ?', [
        'libre',
        tableId,
      ]);
      await conn.query(
        "UPDATE sessions SET status = 'cerrada' WHERE table_id = ? AND status = 'activa'",
        [tableId]
      );

      await conn.commit();
      res.json({ message: 'Mesa liberada' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
