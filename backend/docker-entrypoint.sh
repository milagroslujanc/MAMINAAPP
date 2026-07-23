#!/bin/sh
set -e

echo "? Esperando MySQL en ${DB_HOST}:${DB_PORT:-3306}..."

node <<'EOF'
const mysql = require('mysql2/promise');

(async () => {
  const host = process.env.DB_HOST || 'db';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  for (let i = 1; i <= 60; i++) {
    try {
      const conn = await mysql.createConnection({ host, port, user, password });
      await conn.ping();
      await conn.end();
      console.log('? MySQL listo');
      process.exit(0);
    } catch (err) {
      console.log(`  intento ${i}/60: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error('MySQL no respondi? a tiempo');
  process.exit(1);
})();
EOF

echo "? Ejecutando seed (idempotente)..."
npm run seed

echo "? Iniciando API..."
exec npm start