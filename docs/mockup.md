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

---

# Producto 3 · Pantallas nuevas y cambios

El menú superior ahora es **dinámico**: cambia según quién haya iniciado sesión.

| Quién | Menú |
|---|---|
| Sin sesión | Biblioteca · Entrar · Registrarse |
| USER | Biblioteca · Catálogo · Mis préstamos · Favoritos · *email* `USER` · Salir |
| ADMIN | Biblioteca · Catálogo · Gestión de libros · Usuarios · Préstamos · *email* `ADMIN` · Salir |

## Pantalla 5 · Login (`/login`)
- Email y contraseña. Mensajes: credenciales incorrectas, sesión cerrada, cuenta creada.
- Enlace a **Registrarse**.

## Pantalla 6 · Registro (`/registro`)
- Nombre, email, teléfono, contraseña y repetir contraseña.
- Errores: email repetido, contraseña corta (< 6) o que no coincide.
- Al terminar vuelve al login con aviso de "Cuenta creada". Siempre entra como USER.

## Pantalla 7 · Portada (`/`)
- Sin sesión: bienvenida con botones Entrar / Crear cuenta.
- USER y ADMIN: accesos directos a sus secciones.

## Pantalla 1 (cambia) · Catálogo / Gestión de libros (`/libros`, `/admin/libros`)
- Misma tabla para los dos roles.
- ADMIN: **+ Nuevo libro**, **Editar**, **Eliminar** (avisa si el libro tiene préstamos).
- USER: **Pedir prestado** (si está disponible) y estrella **☆/★** de favorito.

## Pantalla 8 · Mis préstamos (`/user/prestamos`)
- Tabla: Libro, Fecha de préstamo, Devolución prevista (14 días), Estado.

## Pantalla 9 · Favoritos (`/user/favoritos`)
- Libros marcados con la estrella, con botón **Quitar**.

## Pantalla 4 (cambia) · Préstamos (`/admin/prestamos`)
- Botón **Marcar devuelto** en los pendientes: cierra el préstamo y deja el libro disponible.

## Pantalla 3 (cambia) · Usuarios (`/admin/usuarios`)
- Añade columnas Roles, Activo y Favoritos.

## Pantalla 10 · Acceso denegado (`/403`)
- Se muestra cuando un rol entra donde no le corresponde.
