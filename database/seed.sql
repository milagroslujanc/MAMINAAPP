-- Referencia SQL. Preferir: cd backend && npm run seed
-- (el script genera el hash bcrypt correcto de admin123)

USE mamina;

INSERT INTO tables (number, capacity, status) VALUES
(1, 2, 'libre'),
(2, 2, 'libre'),
(3, 4, 'libre'),
(4, 4, 'libre'),
(5, 4, 'libre'),
(6, 4, 'libre'),
(7, 4, 'libre'),
(8, 6, 'libre'),
(9, 6, 'libre'),
(10, 4, 'libre'),
(11, 4, 'libre'),
(12, 2, 'libre'),
(13, 8, 'libre');



-- se cambiaron las categorias del menu y se coloco los platos reales del restaurante en la base de datos en la carpeta seed.sql Y en el backend en el seed.js

INSERT INTO categories (name, sort_order) VALUES
('Anticuchos', 1),
('Combinados', 2),
('1/2 porción', 3),
('Carnes a la parrilla', 4),
('Complementos', 5),
('Infuciones / Bebidas', 6),
('Gaseosas', 7),
('Vinos', 8),
('Cervezas', 9);

INSERT INTO products (category_id, name, description, price, image_url, stock, is_active) VALUES
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
(9, 'Variados', 'Otras marcas de cerveza', 9.00, 'https://i.postimg.cc/7hypp2WW/varias-cervesas.jpg', 20, 1);