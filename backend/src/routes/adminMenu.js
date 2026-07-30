const express = require('express');
const pool = require('../config/db');
const { authAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.use(authAdmin);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT id, name, sort_order FROM categories ORDER BY sort_order, id`
    );
    res.json(rows);
  })
);

router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url,
              p.stock, p.is_active, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY c.sort_order, p.name`
    );
    res.json(
      rows.map((p) => ({
        ...p,
        price: Number(p.price),
        stock: Number(p.stock),
        is_active: Boolean(p.is_active),
        agotado: Number(p.stock) <= 0,
      }))
    );
  })
);

router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const { categoryId, name, description, price, imageUrl, stock, isActive } = req.body || {};

    if (!categoryId || !name || price === undefined || price === null || price === '') {
      return res.status(400).json({ message: 'Categoría, nombre y precio son obligatorios' });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: 'Precio inválido' });
    }

    const [categories] = await pool.query(`SELECT id FROM categories WHERE id = ?`, [categoryId]);
    if (!categories[0]) {
      return res.status(400).json({ message: 'Categoría no encontrada' });
    }

    const [result] = await pool.query(
      `INSERT INTO products (category_id, name, description, price, image_url, stock, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        String(name).trim(),
        description ? String(description).trim() : null,
        numericPrice,
        imageUrl ? String(imageUrl).trim() : null,
        Math.max(0, Number(stock) || 0),
        isActive === false || isActive === 0 ? 0 : 1,
      ]
    );

    const [rows] = await pool.query(
      `SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url,
              p.stock, p.is_active, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [result.insertId]
    );

    const product = rows[0];
    res.status(201).json({
      ...product,
      price: Number(product.price),
      stock: Number(product.stock),
      is_active: Boolean(product.is_active),
      message: 'Plato agregado al menú',
    });
  })
);

router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { categoryId, name, description, price, imageUrl, stock, isActive } = req.body || {};

    const [existing] = await pool.query(`SELECT id FROM products WHERE id = ?`, [id]);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!categoryId || !name || price === undefined || price === null || price === '') {
      return res.status(400).json({ message: 'Categoría, nombre y precio son obligatorios' });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: 'Precio inválido' });
    }

    await pool.query(
      `UPDATE products
       SET category_id = ?, name = ?, description = ?, price = ?, image_url = ?,
           stock = ?, is_active = ?
       WHERE id = ?`,
      [
        categoryId,
        String(name).trim(),
        description ? String(description).trim() : null,
        numericPrice,
        imageUrl ? String(imageUrl).trim() : null,
        Math.max(0, Number(stock) || 0),
        isActive === false || isActive === 0 ? 0 : 1,
        id,
      ]
    );

    const [rows] = await pool.query(
      `SELECT p.id, p.category_id, p.name, p.description, p.price, p.image_url,
              p.stock, p.is_active, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [id]
    );

    const product = rows[0];
    res.json({
      ...product,
      price: Number(product.price),
      stock: Number(product.stock),
      is_active: Boolean(product.is_active),
      message: 'Plato actualizado',
    });
  })
);

router.patch(
  '/products/:id/active',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const active = req.body?.isActive;

    if (typeof active !== 'boolean' && active !== 0 && active !== 1) {
      return res.status(400).json({ message: 'isActive debe ser true o false' });
    }

    const [existing] = await pool.query(`SELECT id, name FROM products WHERE id = ?`, [id]);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const value = active === true || active === 1 ? 1 : 0;
    await pool.query(`UPDATE products SET is_active = ? WHERE id = ?`, [value, id]);

    res.json({
      id,
      is_active: Boolean(value),
      message: value
        ? `${existing[0].name} visible en el menú`
        : `${existing[0].name} oculto del catálogo`,
    });
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existing] = await pool.query(`SELECT id, name FROM products WHERE id = ?`, [id]);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Soft-delete: no rompe historial de pedidos (FK order_items)
    await pool.query(`UPDATE products SET is_active = 0 WHERE id = ?`, [id]);

    res.json({
      id,
      message: `${existing[0].name} eliminado del menú (oculto para clientes)`,
    });
  })
);

module.exports = router;
