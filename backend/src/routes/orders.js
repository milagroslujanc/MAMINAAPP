const express = require('express');
const pool = require('../config/db');
const bus = require('../events');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { sessionToken, items, notes } = req.body || {};

    if (!sessionToken || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Sesión e ítems son obligatorios' });
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [sessions] = await conn.query(
        "SELECT id, table_id, order_type FROM sessions WHERE token = ? AND status = 'activa'",
        [sessionToken]
      );
      const session = sessions[0];
      if (!session) {
        await conn.rollback();
        return res.status(404).json({ message: 'Sesión inválida' });
      }

      let total = 0;
      const resolved = [];

      for (const item of items) {
        const [products] = await conn.query(
          'SELECT id, name, price, stock, is_active FROM products WHERE id = ? FOR UPDATE',
          [item.productId]
        );
        const product = products[0];
        if (!product || !product.is_active) {
          await conn.rollback();
          return res.status(400).json({ message: `Producto ${item.productId} no existe` });
        }
        if (Number(product.stock) <= 0) {
          await conn.rollback();
          return res.status(400).json({ message: `${product.name} está agotado` });
        }
        const qty = Math.max(1, Number(item.quantity) || 1);
        if (Number(product.stock) < qty) {
          await conn.rollback();
          return res.status(400).json({ message: `Stock insuficiente de ${product.name}` });
        }
        total += Number(product.price) * qty;
        resolved.push({ product, quantity: qty, specialNotes: item.specialNotes || null });
      }

      const [orderResult] = await conn.query(
        `INSERT INTO orders (session_id, table_id, order_type, status, total, notes, is_new)
         VALUES (?, ?, ?, 'pendiente', ?, ?, 1)`,
        [session.id, session.table_id, session.order_type, total, notes || null]
      );
      const orderId = orderResult.insertId;

      for (const row of resolved) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, special_notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            row.product.id,
            row.product.name,
            row.quantity,
            row.product.price,
            row.specialNotes,
          ]
        );
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [
          row.quantity,
          row.product.id,
        ]);
      }

      await conn.commit();

      let tableNumber = null;
      if (session.table_id) {
        const [tableRows] = await pool.query('SELECT number FROM `tables` WHERE id = ?', [
          session.table_id,
        ]);
        tableNumber = tableRows[0]?.number ?? null;
      }

      bus.emit('order:new', {
        id: orderId,
        status: 'pendiente',
        total: Number(total),
        order_type: session.order_type,
        is_new: true,
        notes: notes || null,
        created_at: new Date().toISOString(),
        table_number: tableNumber,
      });

      res.status(201).json({
        orderId,
        total: Number(total),
        status: 'pendiente',
        message: 'Pedido enviado a cocina',
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
