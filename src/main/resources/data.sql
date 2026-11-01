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

-- USUARIOS (inventados)
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
