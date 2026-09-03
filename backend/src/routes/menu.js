const express = require('express');
const pool = require('../config/db');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [categories] = await pool.query(
      `SELECT id, name, sort_order FROM categories ORDER BY sort_order`
    );
    const [products] = await pool.query(
      `SELECT id, category_id, name, description, price, image_url, is_active
       FROM products WHERE is_active = 1`
    );

    const menu = categories.map((cat) => ({
      ...cat,
      products: products
        .filter((p) => p.category_id === cat.id)
        .map((p) => ({
          ...p,
          price: Number(p.price),
        })),
    }));

    res.json(menu);
  })
);

module.exports = router;
