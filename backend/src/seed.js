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
      // Migración ligera: columna is_active en mesas (MMN-19)
      const [cols] = await connection.query(
        `SELECT COUNT(*) AS c FROM information_schema.columns
         WHERE table_schema = ? AND table_name = 'tables' AND column_name = 'is_active'`,
        [dbName]
      );
      if (cols[0].c === 0) {
        await connection.query(
          `ALTER TABLE \`tables\` ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER qr_token`
        );
        console.log('Migración: columna tables.is_active agregada.');
      }

      // Migración: rol en admins (admin | mesero)
      const [roleCols] = await connection.query(
        `SELECT COUNT(*) AS c FROM information_schema.columns
         WHERE table_schema = ? AND table_name = 'admins' AND column_name = 'role'`,
        [dbName]
      );
      if (roleCols[0].c === 0) {
        await connection.query(
          `ALTER TABLE admins ADD COLUMN role ENUM('admin', 'mesero', 'cocina') NOT NULL DEFAULT 'admin' AFTER full_name`
        );
        console.log('Migración: columna admins.role agregada.');
      } else {
        await connection.query(
          `ALTER TABLE admins MODIFY COLUMN role ENUM('admin', 'mesero', 'cocina') NOT NULL DEFAULT 'admin'`
        );
      }

      const meseroHash = await bcrypt.hash('mesero123', 10);
      await connection.query(
        `INSERT INTO admins (username, password_hash, full_name, role)
         SELECT 'mesero', ?, 'Mesero La Mamina', 'mesero'
         FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'mesero')`,
        [meseroHash]
      );
      await connection.query(
        `UPDATE admins SET role = 'mesero', full_name = 'Mesero La Mamina' WHERE username = 'mesero'`
      );
      await connection.query(
        `UPDATE admins SET role = 'admin' WHERE username = 'admin' AND (role IS NULL OR role = '')`
      );

      const cocinaHash = await bcrypt.hash('cocina123', 10);
      await connection.query(
        `INSERT INTO admins (username, password_hash, full_name, role)
         SELECT 'cocina', ?, 'Cocina La Mamina', 'cocina'
         FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'cocina')`,
        [cocinaHash]
      );
      await connection.query(
        `UPDATE admins SET role = 'cocina', full_name = 'Cocina La Mamina' WHERE username = 'cocina'`
      );

      // Migración: alertas de servicio (solicitar terminar pedido)
      const [reqTable] = await connection.query(
        `SELECT COUNT(*) AS c FROM information_schema.tables
         WHERE table_schema = ? AND table_name = 'service_requests'`,
        [dbName]
      );
      if (reqTable[0].c === 0) {
        await connection.query(`
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

      console.log('Base de datos ya inicializada — se omite el seed.');
      await connection.end();
      return;
    }
  }

  await connection.query(`
    DROP TABLE IF EXISTS service_requests;
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
      role ENUM('admin', 'mesero', 'cocina') NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE \`tables\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      number INT NOT NULL UNIQUE,
      capacity INT NOT NULL DEFAULT 4,
      status ENUM('libre', 'ocupada') NOT NULL DEFAULT 'libre',
      qr_token VARCHAR(64) NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
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
    );
  `);

  const passwordHash = await bcrypt.hash('admin123', 10);
  const meseroHash = await bcrypt.hash('mesero123', 10);
  const cocinaHash = await bcrypt.hash('cocina123', 10);

  await connection.query(
    `INSERT INTO admins (username, password_hash, full_name, role) VALUES
      (?, ?, ?, 'admin'),
      (?, ?, ?, 'mesero'),
      (?, ?, ?, 'cocina')`,
    [
      'admin',
      passwordHash,
      'Administrador La Mamina',
      'mesero',
      meseroHash,
      'Mesero La Mamina',
      'cocina',
      cocinaHash,
      'Cocina La Mamina',
    ]
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
    ('Anticuchos', 1),
    ('Combinados', 2),
    ('1/2 porción', 3),
    ('Carnes a la parrilla', 4),
    ('Complementos', 5),
    ('Infuciones / Bebidas', 6),
    ('Gaseosas', 7),
    ('Vinos', 8),
    ('Cervezas', 9);`
  );

  await connection.query(
    `INSERT INTO products (category_id, name, description, price, image_url, stock, is_active) VALUES
-- Categoría 1: Anticuchos
(1, 'Anticucho (3 palitos)', '3 palitos de anticucho + papas + choclo + ensalada + cremas', 20.00, 'https://i.postimg.cc/tg61k0QX/Anticucho-(3-palitos).png', 20, 1),
(1, 'Anticucho (4 palitos)', '4 palitos de anticucho + papas + choclo + ensalada + cremas', 22.00, 'https://i.postimg.cc/brmMBBcn/watermarked-img-12490061967351436661.jpg', 20, 1),
(1, 'Anticucho de Carne', '3 palitos de anticucho + papas + choclo + ensalada + cremas', 24.00, 'https://i.postimg.cc/sXN7HYHP/antocucho-de-carne.jpg', 20, 1),
(1, 'Anticucho de Pollo', '3 palitos de anticucho + papas + choclo + ensalada + cremas', 21.00, 'https://i.postimg.cc/3NG1gfrD/anticucho-de-pollo.jpg', 20, 1),
(1, 'Anticucho 3 Sabores', '1 palito de pollo + 1 palito de carne + 1 palito de corazón + papas + choclo + ensalada + cremas', 22.00, 'https://i.postimg.cc/YS4WGGqn/Anticucho-3-Sabores.jpg', 20, 1),

-- Categoría 2: Combinados
(2, 'Combinado', '2 palitos de anticucho + rachi + corazón + mollejita + papas + choclo + ensalada + cremas', 20.00, 'https://i.postimg.cc/nzJhFCsP/combinado-1.jpg', 20, 1),
(2, 'Dúo', '2 palitos de anticucho + choncholí + papas + choclo + ensalada + cremas', 21.00, 'https://i.postimg.cc/FzFFS8Vj/duo.jpg', 20, 1),
(2, 'Choncholí', '+ papas + choclo + ensalada + cremas', 21.00, 'https://i.postimg.cc/3JcryL40/chocholi.webp', 20, 1),
(2, 'Rachi', '+ papas + choclo + ensalada + cremas', 20.00, 'https://i.postimg.cc/zfnqc8dt/rachi.jpg', 20, 1),
(2, 'Molleja', '+ papas + choclo + ensalada + cremas', 20.00, 'https://i.postimg.cc/FzqtKBPB/mollejita.jpg', 20, 1),
(2, 'Corazón de pollo', '+ papas + choclo + ensalada + cremas', 20.00, 'https://i.postimg.cc/s23L3zjg/corazon-de-pollo.webp', 20, 1),

-- Categoría 3: 1/2 Porción
(3, 'Anticucho (1/2 porción)', '2 palitos de anticucho + papas + choclo + ensalada + cremas', 14.00, 'https://i.postimg.cc/bvMFkt01/anticucho-1-2.jpg', 20, 1),
(3, 'Choncholí (1/2 porción)', '+ papas + choclo + ensalada + cremas', 16.00, 'https://i.postimg.cc/CKf4y6DD/CHONCHOLI-1CARTO.webp', 20, 1),
(3, 'Rachi (1/2 porción)', '+ papas + choclo + ensalada + cremas', 15.00, 'https://i.postimg.cc/zfnqc8dt/rachi.jpg', 20, 1),
(3, 'Molleja (1/2 porción)', '+ papas + choclo + ensalada + cremas', 15.00, 'https://i.postimg.cc/FzqtKBPB/mollejita.jpg', 20, 1),
(3, 'Corazón de pollo (1/2 porción)', '+ papas + choclo + ensalada + cremas', 15.00, 'https://i.postimg.cc/s23L3zjg/corazon-de-pollo.webp', 20, 1),

-- Categoría 4: Carnes a la Parrilla
(4, 'Pollo ó Churrasco ó Chuleta', '+ 2 palitos anticucho + rachi + corazón + mollejita + hot dog + chorizo + papas + choclo + ensalada + cremas', 46.00, 'https://i.postimg.cc/Y2XL3zL2/PARRILLA.jpg', 20, 1),
(4, 'Filete de Pollo c/ Chorizo y Hot Dog', '+ papas + choclo + ensalada + cremas', 25.00, 'https://i.postimg.cc/fTGL22zN/filete-de-pollo.jpg', 20, 1),
(4, 'Muslo de pollo c/ Chorizo y Hot Dog', '+ papas + choclo + ensalada + cremas', 25.00, 'https://i.postimg.cc/QM0j303D/Muslo-de-pollo.jpg', 20, 1),
(4, 'Chuleta c/ Chorizo y Hot Dog', '+ papas + choclo + ensalada + cremas', 27.00, 'https://i.postimg.cc/ryv03FjY/chuleta.jpg', 20, 1),
(4, 'Churrasco c/ Chorizo y Hot Dog', '+ papas + choclo + ensalada + cremas', 29.00, 'https://i.postimg.cc/nr7zpB27/churrasco.jpg', 20, 1),
(4, 'Filete de pollo', '+ papas + choclo + ensalada + cremas', 20.00, 'https://i.postimg.cc/2ST5kzd1/filete2.jpg', 20, 1),
(4, 'Muslo Deshuesado de Pollo', '+ papas + choclo + ensalada + cremas', 20.00, 'https://i.postimg.cc/brQzK8YH/Muslo-desguesado.jpg', 20, 1),
(4, 'Churrasco', '+ papas + choclo + ensalada + cremas', 23.00, 'https://i.postimg.cc/Pq9TJNPF/churrasco2.jpg', 20, 1),
(4, 'Chuleta', '+ papas + choclo + ensalada + cremas', 22.00, 'https://i.postimg.cc/zDdpgWJT/Gemini-Generated-Image-smrr39smrr39smrr.png', 20, 1),

-- Categoría 5: Complementos
(5, 'Arroz', 'Porción de arroz', 3.00, 'https://i.postimg.cc/d3d8p7yV/Arroz.jpg', 20, 1),
(5, 'Papa sancochada', 'Porción de papa sancochada', 2.50, 'https://i.postimg.cc/SQz7JPt7/Papa-sancochada.jpg', 20, 1),
(5, 'Papa frita', 'Porción de papa frita', 10.00, 'https://i.postimg.cc/zXZwWksH/Papa-frita.jpg', 20, 1),
(5, 'Choclo', 'Porción de choclo', 2.50, 'https://i.postimg.cc/9FddB72p/porcion-de-choclo.jpg', 20, 1),
(5, 'Ensalada', 'Porción de ensalada fresca', 6.00, 'https://i.postimg.cc/L8mzQ86m/ensalada.webp', 20, 1),
(5, 'Chorizo', 'Unidad de chorizo', 6.00, 'https://i.postimg.cc/y8n0MCkV/chorizo.jpg', 20, 1),
(5, 'Hot Dog', 'Unidad de hot dog', 3.00, 'https://i.postimg.cc/3x92sQdm/hot-dog.jpg', 20, 1),
(5, 'Frankfrutter', 'Unidad de salchicha frankfurter', 6.00, 'https://i.postimg.cc/PqRYqbWc/Frankfrutte.jpg', 20, 1),

-- Categoría 6: Infusiones / Bebidas
(6, 'Infusiones', 'Bebida caliente', 4.00, 'https://i.postimg.cc/52HFRQdK/infuciones.webp', 20, 1),
(6, 'Café', 'Taza de café', 5.00, 'https://i.postimg.cc/y8JSb34j/cafe.jpg', 20, 1),
(6, 'Jarra de Chicha 1 Lt.', 'Jarra de un litro de chicha', 10.00, 'https://i.postimg.cc/Njyrz2qz/jarra-de-chicha.jpg', 20, 1),
(6, 'Jarra de Chicha 1/2 Lt.', 'Jarra de medio litro de chicha', 5.50, 'https://i.postimg.cc/Njyrz2qz/jarra-de-chicha.jpg', 20, 1),

-- Categoría 7: Gaseosas
(7, 'Coca Cola / Inka Cola 1Lt.', 'Gaseosa de 1 litro', 10.00, 'https://i.postimg.cc/RZ3nDJ5g/cocacola.webp', 20, 1),
(7, 'Coca Cola / Inka Cola 1.5 Lt.', 'Gaseosa de 1.5 litros', 13.00, 'https://i.postimg.cc/W1DJHqLS/cocacola-de-litro-y-medio.jpg', 20, 1),
(7, 'Coca Cola / Inka Cola 3 Lt.', 'Gaseosa de 3 litros', 18.00, 'https://i.postimg.cc/x1kb4NDR/coca-de-3-litros.webp', 20, 1),
(7, 'Gordita', 'Gaseosa presentación gordita', 5.50, 'https://i.postimg.cc/2SqBKLRc/GORDITA.jpg', 20, 1),
(7, 'Mediana', 'Gaseosa presentación mediana', 3.50, 'https://i.postimg.cc/Ghf4G38P/GASEOSA-MEDIANA.jpg', 20, 1),
(7, 'Agua mineral', 'Botella de agua mineral', 3.50, 'https://i.postimg.cc/W1DJHqLM/agua-mineral.jpg', 20, 1),
(7, 'Frugos', 'Jugo envasado', 3.00, 'https://i.postimg.cc/HkJ7h8DP/frugos.webp', 20, 1),

-- Categoría 8: Vinos
(8, 'Tabernero Rosé y Borgoña', 'Vino Tabernero', 36.00, 'https://i.postimg.cc/8cBqDz2t/vino-1.webp', 20, 1),
(8, 'Tabernero Rosé especial', 'Vino Tabernero edición especial', 45.00, 'https://i.postimg.cc/fyj6ZRG5/vino-2.webp', 20, 1),
(8, 'Santiago Queirolo Borgoña', 'Vino Santiago Queirolo', 36.00, 'https://i.postimg.cc/Bbcdsnrm/vino-3.jpg', 20, 1),

-- Categoría 9: Cervezas
(9, 'Pilsen personal', 'Cerveza Pilsen tamaño personal', 8.00, 'https://i.postimg.cc/WzPQQkHf/pilsen-personal.jpg', 20, 1),
(9, 'Cusqueña personal', 'Cerveza Cusqueña tamaño personal', 8.00, 'https://i.postimg.cc/Gt1ZZy5N/cusquena-personal.webp', 20, 1),
(9, 'Variados', 'Otras marcas de cerveza', 9.00, 'https://i.postimg.cc/7hypp2WW/varias-cervesas.jpg', 20, 1);`
  );

  console.log('Base de datos mamina creada y sembrada correctamente.');
  console.log('Admin → usuario: admin | contraseña: admin123');
  console.log('Cocina → usuario: cocina | contraseña: cocina123');
  await connection.end();
}

seed().catch((err) => {
  console.error('Error al sembrar la BD:', err.message);
  process.exit(1);
});
