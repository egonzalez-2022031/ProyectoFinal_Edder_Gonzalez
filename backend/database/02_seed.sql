SET NAMES utf8mb4;
USE passionbook;

-- ---------------------------------------------------------------------
-- Usuarios de prueba (contraseñas con hash bcrypt, costo 10)
--   admin@passionbook.com  ->  Admin123!
--   carlos@passionbook.com ->  Lector123!
--   maria@passionbook.com  ->  Maria123!
-- ---------------------------------------------------------------------
INSERT INTO usuarios (nombre, apellido, email, password_hash, biografia, puntos_totales) VALUES
('Edder',  'González', 'admin@passionbook.com',
 '$2b$10$oxfjMik3Jqv5wcG6O1fuguCAIpf9cQv30BLN8dxzJKtzawr6h1zky',
 'Administrador y creador de PassionBook.', 70),
('Carlos', 'Pérez',    'carlos@passionbook.com',
 '$2b$10$CTAfWi7/vLgGBhY26oK4HO.rHpfLGaP14OL18BEm0it2jlHZgyk3C',
 'Me gusta la ciencia ficción y la fantasía.', 40),
('María',  'López',    'maria@passionbook.com',
 '$2b$10$45sm/IgGOijGbvwowhcn4O8wih.U7cxqvHycTExvDS.7IXeqrzdK2',
 'Lectora de novela clásica y misterio.', 30);

-- ---------------------------------------------------------------------
-- Categorías / géneros
-- ---------------------------------------------------------------------
INSERT INTO categorias (nombre, descripcion) VALUES
('Ciencia Ficción', 'Historias basadas en avances científicos y futuros posibles.'),
('Fantasía',        'Mundos imaginarios con magia y criaturas fantásticas.'),
('Novela Clásica',  'Obras literarias de referencia de la literatura universal.'),
('Misterio',        'Tramas de intriga, crimen y suspenso.'),
('Desarrollo Personal', 'Libros de hábitos, productividad y crecimiento personal.');

-- ---------------------------------------------------------------------
-- Libros (10)
-- ---------------------------------------------------------------------
INSERT INTO libros (titulo, autor, id_categoria, isbn, num_paginas, anio_publicacion, sinopsis, id_creador) VALUES
('Dune', 'Frank Herbert', 1, '9780441013593', 688, 1965,
 'Épica del planeta desértico Arrakis y la lucha por la especia.', 1),
('Fundación', 'Isaac Asimov', 1, '9780553293357', 255, 1951,
 'Un matemático intenta preservar el conocimiento ante la caída de un imperio galáctico.', 1),
('El Hobbit', 'J. R. R. Tolkien', 2, '9780547928227', 310, 1937,
 'Bilbo Bolsón se embarca en una aventura inesperada junto a un grupo de enanos.', 1),
('Harry Potter y la piedra filosofal', 'J. K. Rowling', 2, '9788478884452', 254, 1997,
 'Un niño descubre que es mago y entra a Hogwarts.', 2),
('Cien años de soledad', 'Gabriel García Márquez', 3, '9780307474728', 417, 1967,
 'La saga de la familia Buendía en el mítico pueblo de Macondo.', 2),
('Don Quijote de la Mancha', 'Miguel de Cervantes', 3, '9788420412146', 863, 1605,
 'Las aventuras de un hidalgo que enloquece leyendo libros de caballerías.', 3),
('Asesinato en el Orient Express', 'Agatha Christie', 4, '9780062693662', 288, 1934,
 'Hércules Poirot investiga un crimen a bordo de un tren detenido por la nieve.', 3),
('El código Da Vinci', 'Dan Brown', 4, '9780307474278', 689, 2003,
 'Un simbólogo persigue pistas ocultas en obras de arte y sociedades secretas.', 3),
('Hábitos atómicos', 'James Clear', 5, '9780735211292', 320, 2018,
 'Método práctico para construir buenos hábitos y eliminar los malos.', 1),
('El poder del ahora', 'Eckhart Tolle', 5, '9781577314806', 236, 1997,
 'Guía para vivir en el presente y reducir la ansiedad.', 2);

-- ---------------------------------------------------------------------
-- Lecturas de usuarios (para probar estadísticas, metas y ranking)
-- ---------------------------------------------------------------------
INSERT INTO lecturas_usuario
  (id_usuario, id_libro, estado, fecha_inicio, fecha_fin, calificacion, puntos_otorgados) VALUES
(1, 1,  'completado', '2026-07-01', '2026-07-20', 5, 20),
(1, 3,  'completado', '2026-08-02', '2026-08-15', 5, 20),
(1, 9,  'completado', '2026-09-01', '2026-09-12', 4, 20),
(1, 2,  'en_lectura', '2026-09-20', NULL, NULL, 0),
(2, 4,  'completado', '2026-08-05', '2026-08-18', 5, 20),
(2, 2,  'completado', '2026-09-03', '2026-09-22', 4, 20),
(2, 1,  'pendiente',  NULL, NULL, NULL, 0),
(3, 7,  'completado', '2026-09-02', '2026-09-10', 5, 20),
(3, 5,  'en_lectura', '2026-09-15', NULL, NULL, 0),
(3, 6,  'pendiente',  NULL, NULL, NULL, 0);

-- Ajuste de puntos para que coincidan con las lecturas completadas
UPDATE usuarios SET puntos_totales = 60 WHERE id_usuario = 1;
UPDATE usuarios SET puntos_totales = 40 WHERE id_usuario = 2;
UPDATE usuarios SET puntos_totales = 20 WHERE id_usuario = 3;

-- ---------------------------------------------------------------------
-- Metas (mes = 0 para metas anuales)
-- ---------------------------------------------------------------------
INSERT INTO metas (id_usuario, tipo_periodo, anio, mes, cantidad_objetivo) VALUES
(1, 'anual',   2026, 0, 12),
(1, 'mensual', 2026, 9, 2),
(2, 'anual',   2026, 0, 6),
(3, 'mensual', 2026, 9, 3);

-- ---------------------------------------------------------------------
-- Catálogo de insignias
-- ---------------------------------------------------------------------
INSERT INTO insignias (codigo, nombre, descripcion, icono, criterio_tipo, criterio_valor) VALUES
('PRIMER_LIBRO',   'Primer Capítulo',   'Completaste tu primer libro.',            'bi-book',          'libros_completados', 1),
('LECTOR_5',       'Lector Constante',  'Completaste 5 libros.',                   'bi-bookmark-star', 'libros_completados', 5),
('LECTOR_10',      'Devorador de Libros','Completaste 10 libros.',                 'bi-trophy',        'libros_completados', 10),
('PUNTOS_100',     'Centenario',        'Alcanzaste 100 puntos.',                  'bi-star-fill',     'puntos',             100),
('META_CUMPLIDA',  'Meta Cumplida',     'Cumpliste una meta de lectura.',          'bi-bullseye',      'metas_cumplidas',    1);

-- Insignias ya obtenidas
INSERT INTO usuario_insignias (id_usuario, id_insignia) VALUES
(1, 1),
(2, 1),
(3, 1);
