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

INSERT INTO categories (name, sort_order) VALUES
('Entradas', 1),
('Platos de Fondo', 2),
('Bebidas', 3),
('Postres', 4);

INSERT INTO products (category_id, name, description, price, image_url, stock, is_active) VALUES
(1, 'Combinado Completo', 'Pescado fresco marinado en limón con cebolla y ají', 28.00, 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=400', 20, 1),
(1, 'Mollejitas', 'Deditos de queso envueltos en masa crujiente (6 und)', 16.00, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400', 15, 1),
(1, 'Papa a la Huancaína', 'Papas con crema de ají amarillo', 14.00, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400', 0, 1),
(2, 'Lomo Saltado', 'Lomo salteado con cebolla, tomate y papas fritas', 32.00, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400', 18, 1),
(2, 'Ají de Gallina', 'Pechuga deshilachada en salsa de ají amarillo', 26.00, 'https://images.unsplash.com/photo-1604908177522-040703ecce6a?w=400', 12, 1),
(2, 'Arroz con Mariscos', 'Arroz cremoso con mariscos frescos', 34.00, 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400', 10, 1),
(2, 'Anticuchos', 'Brochetas de corazón a la parrilla con papas', 24.00, 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400', 0, 1),
(3, 'Chicha Morada', 'Bebida tradicional de maíz morado (jarra)', 12.00, 'https://images.unsplash.com/photo-1544145945-f904253e1e73?w=400', 30, 1),
(3, 'Inca Kola', 'Gaseosa 500 ml', 5.00, 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400', 40, 1),
(3, 'Café Americano', 'Café filtrado', 6.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', 25, 1),
(4, 'Suspiro Limeño', 'Manjar blanco con merengue', 12.00, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', 8, 1),
(4, 'Mazamorra Morada', 'Postre de maíz morado con frutas', 10.00, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400', 5, 1);
