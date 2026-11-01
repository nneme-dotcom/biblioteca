# Producto 2 · Mockup de la aplicación

## Pantalla 1 · Listado de libros (`/libros`)
- Menú superior: **Libros · Usuarios · Préstamos**.
- Botón **+ Nuevo libro** (arriba a la izquierda de la tabla).
- Tabla con columnas: Título, ISBN, Año, Disponible, Autores, Acciones.
- Acciones por fila: **Editar** (enlace) y **Eliminar** (botón).

## Pantalla 2 · Formulario de libro (`/libros/nuevo`, `/libros/{id}/editar`)
- Título (obligatorio), ISBN, Año.
- Autores: selección múltiple (relación N:M con Autor).
- Casilla **Disponible**.
- Botón **Guardar** → vuelve al listado.

## Pantalla 3 · Listado de usuarios (`/usuarios`)
- Tabla: Nombre, Email, Teléfono, Alta y número de préstamos.
- Solo lectura en esta versión.

## Pantalla 4 · Listado de préstamos (`/prestamos`)
- Tabla: Libro, Usuario, Fecha de préstamo, Devolución prevista, Devuelto.
- Solo lectura en esta versión.
