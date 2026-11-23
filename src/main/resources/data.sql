-- Datos de ejemplo para que la biblioteca no arranque vacía.
-- Se cargan en cada arranque, pero no se duplican: si una fila ya existe, se la saltea.
-- Ojo: si borrás un libro de ejemplo, vuelve a aparecer la próxima vez que arranques.

-- AUTORES
INSERT IGNORE INTO autor (id, nombre, nacionalidad) VALUES
 (1, 'Jorge Luis Borges', 'Argentina'),
 (2, 'Julio Cortázar', 'Argentina'),
 (3, 'Ernesto Sabato', 'Argentina'),
 (4, 'Adolfo Bioy Casares', 'Argentina'),
 (5, 'Silvina Ocampo', 'Argentina'),
 (6, 'Manuel Puig', 'Argentina'),
 (7, 'Mariana Enriquez', 'Argentina'),
 (8, 'Fiódor Dostoyevski', 'Rusia');

-- LIBROS (año de primera publicación)
INSERT IGNORE INTO libro (id, titulo, isbn, anio, disponible) VALUES
 (1,  'Ficciones', '978-84-206-3363-6', 1944, true),
 (2,  'El Aleph', '978-84-206-3384-1', 1949, false),
 (3,  'Rayuela', '978-84-376-0453-9', 1963, false),
 (4,  'Bestiario', '978-84-204-6467-4', 1951, true),
 (5,  'El túnel', '978-84-376-0144-6', 1948, true),
 (6,  'Sobre héroes y tumbas', '978-84-322-1735-0', 1961, true),
 (7,  'La invención de Morel', '978-84-376-0306-8', 1940, false),
 (8,  'Seis problemas para don Isidro Parodi', '978-84-206-1641-7', 1942, true),
 (9,  'Antología de la literatura fantástica', '978-84-350-4040-5', 1940, true),
 (10, 'El beso de la mujer araña', '978-84-322-1606-3', 1976, true),
 (11, 'Nuestra parte de noche', '978-84-339-9888-3', 2019, false),
 (12, 'Crimen y castigo', '978-84-9104-136-0', 1866, false),
 (13, 'Los hermanos Karamázov', '978-84-376-0516-1', 1880, true),
 (14, 'El idiota', '978-84-8432-967-8', 1869, true),
 (15, 'Memorias del subsuelo', '978-84-376-0835-3', 1864, true);

-- QUIÉN ESCRIBIÓ QUÉ. Hay libros escritos a cuatro y seis manos (el 8 y el 9).
INSERT IGNORE INTO libro_autor (libro_id, autor_id) VALUES
 (1, 1), (2, 1), (3, 2), (4, 2), (5, 3), (6, 3), (7, 4),
 (8, 1), (8, 4),
 (9, 1), (9, 4), (9, 5),
 (10, 6), (11, 7), (12, 8), (13, 8), (14, 8), (15, 8);

-- USUARIOS (inventados). La contraseña y el rol se los pone DatosIniciales.java al arrancar.
INSERT IGNORE INTO usuario (id, nombre, email, telefono, fecha_alta) VALUES
 (1, 'Lucía Fernández', 'lucia.fernandez@example.com', '600111222', '2026-01-15'),
 (2, 'Martín Gómez', 'martin.gomez@example.com', '600333444', '2026-03-02'),
 (3, 'Valentina Ruiz', 'valentina.ruiz@example.com', '600555666', '2026-05-20'),
 (4, 'Tomás Herrera', 'tomas.herrera@example.com', '600777888', '2026-09-10');

-- PRÉSTAMOS: los que todavía no se devolvieron son los libros que figuran como no disponibles
INSERT IGNORE INTO prestamo (id, libro_id, usuario_id, fecha_prestamo, fecha_devolucion_prevista, devuelto) VALUES
 (1, 2,  1, '2026-10-20', '2026-11-03', false),
 (2, 3,  2, '2026-10-22', '2026-11-05', false),
 (3, 7,  3, '2026-10-25', '2026-11-08', false),
 (4, 11, 4, '2026-10-27', '2026-11-10', false),
 (5, 12, 1, '2026-10-28', '2026-11-11', false),
 (6, 1,  2, '2026-09-01', '2026-09-15', true),
 (7, 5,  3, '2026-09-10', '2026-09-24', true),
 (8, 13, 4, '2026-09-15', '2026-09-29', true);

-- ===================== Producto 3 · Estantería 3D =====================
-- Cada libro va en un estante según su género. Los 15 de antes se reparten así:
UPDATE libro SET genero = 'Novela'   WHERE id IN (3, 5, 6, 7, 10) AND genero IS NULL;
UPDATE libro SET genero = 'Cuento'   WHERE id IN (1, 2, 4, 9) AND genero IS NULL;
UPDATE libro SET genero = 'Clásicos' WHERE id IN (12, 13, 14, 15) AND genero IS NULL;
UPDATE libro SET genero = 'Género'   WHERE id IN (8, 11) AND genero IS NULL;
-- Los libros que se carguen sin género van a Novela.
UPDATE libro SET genero = 'Novela' WHERE genero IS NULL;

-- 27 autores nuevos (ids desde 101 para no chocar con los que se creen desde la app).
INSERT IGNORE INTO autor (id, nombre, nacionalidad) VALUES
 (101, 'Gabriel García Márquez', 'Colombia'),
 (102, 'Isabel Allende', 'Chile'),
 (103, 'Juan Rulfo', 'México'),
 (104, 'Mario Vargas Llosa', 'Perú'),
 (105, 'Mario Benedetti', 'Uruguay'),
 (106, 'Roberto Bolaño', 'Chile'),
 (107, 'Laura Esquivel', 'México'),
 (108, 'Horacio Quiroga', 'Uruguay'),
 (109, 'Samanta Schweblin', 'Argentina'),
 (110, 'Miguel de Cervantes', 'España'),
 (111, 'León Tolstói', 'Rusia'),
 (112, 'Gustave Flaubert', 'Francia'),
 (113, 'Jane Austen', 'Reino Unido'),
 (114, 'Herman Melville', 'Estados Unidos'),
 (115, 'Franz Kafka', 'Austria-Hungría'),
 (116, 'William Shakespeare', 'Inglaterra'),
 (117, 'Victor Hugo', 'Francia'),
 (118, 'Ray Bradbury', 'Estados Unidos'),
 (119, 'George Orwell', 'Reino Unido'),
 (120, 'Aldous Huxley', 'Reino Unido'),
 (121, 'Mary Shelley', 'Reino Unido'),
 (122, 'Bram Stoker', 'Irlanda'),
 (123, 'Stephen King', 'Estados Unidos'),
 (124, 'Agatha Christie', 'Reino Unido'),
 (125, 'Arthur Conan Doyle', 'Reino Unido'),
 (126, 'Umberto Eco', 'Italia'),
 (127, 'Isaac Asimov', 'Estados Unidos');

-- 40 libros nuevos (ids desde 101). ISBN y año de ediciones reales en Open Library.
INSERT IGNORE INTO libro (id, titulo, isbn, anio, genero, disponible) VALUES
 (101, 'Cien años de soledad', '9786070714863', 1967, 'Novela', false),
 (102, 'La casa de los espíritus', '9789586392297', 1982, 'Novela', true),
 (103, 'Pedro Páramo', '9798452384724', 1955, 'Novela', true),
 (104, 'La ciudad y los perros', '9789870411017', 1963, 'Novela', true),
 (105, 'El amor en los tiempos del cólera', '9786070729164', 1985, 'Novela', true),
 (106, 'Crónica de una muerte anunciada', '9785403034310', 1981, 'Novela', true),
 (107, 'La tregua', '9788466322874', 1960, 'Novela', true),
 (108, 'Los detectives salvajes', '9788433966636', 1998, 'Novela', true),
 (109, 'Como agua para chocolate', '9788434589810', 1989, 'Novela', true),
 (110, 'El llano en llamas', '9788437605128', 1953, 'Cuento', true),
 (111, 'Cuentos de amor de locura y de muerte', '9789500301664', 1917, 'Cuento', true),
 (112, 'Final del juego', '9788466311809', 1956, 'Cuento', true),
 (113, 'El libro de arena', '9788423338719', 1975, 'Cuento', true),
 (114, 'Las cosas que perdimos en el fuego', '9780525432548', 2016, 'Cuento', true),
 (115, 'Doce cuentos peregrinos', '9789681326630', 1992, 'Cuento', true),
 (116, 'Historias de cronopios y de famas', '9788466331890', 1962, 'Cuento', true),
 (117, 'Pájaros en la boca', '9786124545986', 2009, 'Cuento', true),
 (118, 'Los peligros de fumar en la cama', '9789500432122', 2009, 'Cuento', true),
 (119, 'El informe de Brodie', '9788420614991', 1970, 'Cuento', true),
 (120, 'Don Quijote de la Mancha', '9788423901500', 1605, 'Clásicos', true),
 (121, 'Ana Karenina', '9788497941648', 1877, 'Clásicos', true),
 (122, 'Guerra y paz', '9788432039799', 1869, 'Clásicos', true),
 (123, 'Madame Bovary', '9788415089155', 1857, 'Clásicos', true),
 (124, 'Orgullo y prejuicio', '9781495437786', 1813, 'Clásicos', true),
 (125, 'Moby Dick', '9789706277138', 1851, 'Clásicos', true),
 (126, 'La metamorfosis', '9781726729888', 1915, 'Clásicos', true),
 (127, 'El proceso', '9789877251517', 1925, 'Clásicos', true),
 (128, 'Hamlet', '9788494773440', 1603, 'Clásicos', true),
 (129, 'Los miserables', '9788408197515', 1862, 'Clásicos', true),
 (130, 'Fahrenheit 451', '9781508760863', 1953, 'Género', true),
 (131, 'Crónicas marcianas', '9789877671315', 1950, 'Género', true),
 (132, '1984', '9780582777316', 1949, 'Género', false),
 (133, 'Un mundo feliz', '9789706438874', 1932, 'Género', true),
 (134, 'Frankenstein', '9788415089452', 1818, 'Género', true),
 (135, 'Drácula', '9781449552107', 1897, 'Género', true),
 (136, 'El resplandor', '9789500732062', 1977, 'Género', true),
 (137, 'Asesinato en el Orient Express', '9788478712090', 1934, 'Género', true),
 (138, 'El sabueso de los Baskerville', '9788472540415', 1902, 'Género', true),
 (139, 'El nombre de la rosa', '9788426414373', 1980, 'Género', true),
 (140, 'Fundación', '9788418037542', 1951, 'Género', true);

INSERT IGNORE INTO libro_autor (libro_id, autor_id) VALUES
 (101, 101),
 (102, 102),
 (103, 103),
 (104, 104),
 (105, 101),
 (106, 101),
 (107, 105),
 (108, 106),
 (109, 107),
 (110, 103),
 (111, 108),
 (112, 2),
 (113, 1),
 (114, 7),
 (115, 101),
 (116, 2),
 (117, 109),
 (118, 7),
 (119, 1),
 (120, 110),
 (121, 111),
 (122, 111),
 (123, 112),
 (124, 113),
 (125, 114),
 (126, 115),
 (127, 115),
 (128, 116),
 (129, 117),
 (130, 118),
 (131, 118),
 (132, 119),
 (133, 120),
 (134, 121),
 (135, 122),
 (136, 123),
 (137, 124),
 (138, 125),
 (139, 126),
 (140, 127);

-- Dos préstamos con fechas relativas a hoy, para que el panel del admin muestre los tres estados:
-- 'Cien años de soledad' vence en 2 días (ámbar) y '1984' en 9 días (verde). Solo se crean la primera vez.
INSERT IGNORE INTO prestamo (id, libro_id, usuario_id, fecha_prestamo, fecha_devolucion_prevista, devuelto) VALUES
 (1001, 101, 2, CURDATE() - INTERVAL 12 DAY, CURDATE() + INTERVAL 2 DAY, false),
 (1002, 132, 3, CURDATE() - INTERVAL 5 DAY,  CURDATE() + INTERVAL 9 DAY, false);
