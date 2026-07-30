require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const tablesRoutes = require('./routes/tables');
const sessionsRoutes = require('./routes/sessions');
const menuRoutes = require('./routes/menu');
const ordersRoutes = require('./routes/orders');
const kitchenRoutes = require('./routes/kitchen');
const adminMenuRoutes = require('./routes/adminMenu');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, project: 'La Mamina', sprint: 1, mode: 'mysql' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/admin', adminMenuRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Error interno' });
});

app.listen(PORT, () => {
  console.log(`API La Mamina (Sprint 1 · DEMO) → http://localhost:${PORT}`);
  console.log('Admin demo → admin / admin123');
});
