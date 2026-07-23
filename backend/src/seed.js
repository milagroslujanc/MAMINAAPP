require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME || 'mamina';

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${dbName}\``);

  const [existing] = await connection.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = ? AND table_name = 'admins'`,
    [dbName]
  );

  if (existing[0].c > 0) {
    const [admins] = await connection.query('SELECT COUNT(*) AS c FROM admins');
    if (admins[0].c > 0) {
      console.log('Base de datos ya inicializada — se omite el seed.');
      await connection.end();
      return;
    }
  }

  await connection.query(`
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS \`tables\`;
    DROP TABLE IF EXISTS admins;

    CREATE TABLE admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE \`tables\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      number INT NOT NULL UNIQUE,
      capacity INT NOT NULL DEFAULT 4,
      status ENUM('libre', 'ocupada') NOT NULL DEFAULT 'libre',
      qr_token VARCHAR(64) NULL UNIQUE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    );

    CREATE TABLE products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      image_url VARCHAR(255),
      stock INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(64) NOT NULL UNIQUE,
      table_id INT NULL,
      order_type ENUM('mesa', 'llevar') NOT NULL DEFAULT 'mesa',
      status ENUM('activa', 'cerrada') NOT NULL DEFAULT 'activa',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES \`tables\`(id)
    );

    CREATE TABLE orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      table_id INT NULL,
      order_type ENUM('mesa', 'llevar') NOT NULL DEFAULT 'mesa',
      status ENUM('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes TEXT,
      is_new TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (table_id) REFERENCES \`tables\`(id)
    );

    CREATE TABLE order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(120) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL,
      special_notes VARCHAR(255) NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  const passwordHash = await bcrypt.hash('admin123', 10);

  await connection.query(
    `INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)`,
    ['admin', passwordHash, 'Administrador La Mamina']
  );

  const tables = Array.from({ length: 13 }, (_, i) => {
    const n = i + 1;
    const capacity = n <= 2 || n === 12 ? 2 : n === 13 ? 8 : n >= 8 && n <= 9 ? 6 : 4;
    return [n, capacity, 'libre'];
  });
  await connection.query(
    'INSERT INTO `tables` (number, capacity, status) VALUES ?',
    [tables]
  );

  await connection.query(
    `INSERT INTO categories (name, sort_order) VALUES
      ('Entradas', 1),
      ('Platos de Fondo', 2),
      ('Bebidas', 3),
      ('Postres', 4)`
  );

  await connection.query(
    `INSERT INTO products (category_id, name, description, price, image_url, stock, is_active) VALUES
      (1, 'Ceviche Clásico', 'Pescado fresco marinado en limón con cebolla y ají', 28.00, 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=400', 20, 1),
      (1, 'Tequeños', 'Deditos de queso envueltos en masa crujiente (6 und)', 16.00, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400', 15, 1),
      (1, 'Papa a la Huancaína', 'Papas con crema de ají amarillo', 14.00, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400', 0, 1),
      (2, 'Lomo Saltado', 'Lomo salteado con cebolla, tomate y papas fritas', 32.00, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400', 18, 1),
      (2, 'Ají de Gallina', 'Pechuga deshilachada en salsa de ají amarillo', 26.00, 'https://images.unsplash.com/photo-1604908177522-040703ecce6a?w=400', 12, 1),
      (2, 'Arroz con Mariscos', 'Arroz cremoso con mariscos frescos', 34.00, 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400', 10, 1),
      (2, 'Anticuchos', 'Brochetas de corazón a la parrilla con papas', 24.00, 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400', 0, 1),
      (3, 'Chicha Morada', 'Bebida tradicional de maíz morado (jarra)', 12.00, 'https://images.unsplash.com/photo-1544145945-f904253e1e73?w=400', 30, 1),
      (3, 'Inca Kola', 'Gaseosa 500 ml', 5.00, 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400', 40, 1),
      (3, 'Café Americano', 'Café filtrado', 6.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', 25, 1),
      (4, 'Suspiro Limeño', 'Manjar blanco con merengue', 12.00, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', 8, 1),
      (4, 'Mazamorra Morada', 'Postre de maíz morado con frutas', 10.00, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400', 5, 1)`
  );

  console.log('Base de datos mamina creada y sembrada correctamente.');
  console.log('Admin → usuario: admin | contraseña: admin123');
  await connection.end();
}

seed().catch((err) => {
  console.error('Error al sembrar la BD:', err.message);
  process.exit(1);
});
