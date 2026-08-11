const pool = require('./config/db');

async function ensureMigrations() {
  try {
    const dbName = process.env.DB_NAME || 'mamina';
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'service_requests'`,
      [dbName]
    );
    if (rows[0].c === 0) {
      await pool.query(`
        CREATE TABLE service_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          session_id INT NOT NULL,
          table_id INT NULL,
          type ENUM('terminar_pedido') NOT NULL DEFAULT 'terminar_pedido',
          status ENUM('pendiente', 'atendida') NOT NULL DEFAULT 'pendiente',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          attended_at TIMESTAMP NULL,
          attended_by INT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES sessions(id),
          FOREIGN KEY (table_id) REFERENCES \`tables\`(id),
          FOREIGN KEY (attended_by) REFERENCES admins(id)
        )
      `);
      console.log('Migración: tabla service_requests creada.');
    }
  } catch (err) {
    console.warn('No se pudo verificar migraciones:', err.message);
  }
}

module.exports = { ensureMigrations };
