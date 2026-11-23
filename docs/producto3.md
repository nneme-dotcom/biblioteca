# Producto 3 · Seguridad y usuarios — guía rápida

## Cómo arrancar
- Local (MariaDB en el PC): `.\mvnw spring-boot:run` → http://localhost:8082
- Docker: `docker compose up --build` → http://localhost:8082
  - Para empezar con la base de datos limpia: `docker compose down -v` (borra el volumen `datos-biblioteca`).

## Cuentas de prueba (se crean solas al arrancar, `config/DatosIniciales.java`)
| Rol | Email | Contraseña |
|---|---|---|
| ADMIN | admin@biblioteca.com | admin123 |
| USER | lucia.fernandez@example.com (y los otros 3 socios de `data.sql`) | usuario123 |

Se pueden cambiar con las variables `APP_ADMIN_EMAIL`, `APP_ADMIN_PASSWORD` y `APP_DEMO_PASSWORD` (ver `docker-compose.yml`).

## Rutas y permisos (`security/SecurityConfig.java`)
| Ruta | Quién | Qué hace |
|---|---|---|
| `/`, `/login`, `/registro`, `/css/**` | Todos | Portada, login, registro |
| `/libros` | Con sesión | Catálogo (botones según rol) |
| `/admin/libros/**` | ADMIN | CRUD de libros (movido desde `/libros` del P2) |
| `/admin/usuarios` | ADMIN | Usuarios con roles |
| `/admin/prestamos/**` | ADMIN | Préstamos y devoluciones |
| `/user/prestamos/**` | USER | Mis préstamos y pedir un libro |
| `/user/favoritos/**` | USER | Favoritos (relación nueva Usuario–Libro) |

## Piezas nuevas
- `model/Rol.java`, cambios en `model/Usuario.java` (password, activo, roles, favoritos) y `model/Libro.java` (seguidores)
- `security/SecurityConfig.java`: reglas de acceso, login propio, logout, BCrypt, página 403
- `security/UsuarioDetailsService.java`: carga el usuario de la BD para el login
- `config/DatosIniciales.java`: roles, admin y contraseñas de los socios de ejemplo
- `controller/AuthController.java` (login y registro), `CatalogoController.java`, `UserController.java`, `HomeController.java`
- Vistas: `fragments/menu.html` (menú dinámico con `sec:authorize`), `auth/login.html`, `auth/registro.html`, `index.html`, `user/*.html`, `error/403.html`
- `static/css/estilos.css`: estilos comunes (antes repetidos en cada vista)
- Docker: volumen para no perder datos, variables de las cuentas iniciales, `restart: unless-stopped`

## Vistas 3D (three.js)
- **Socio · `/libros`**: el catálogo es una estantería de nogal en 3D con los libros reales (portadas de Open Library). Al pasar el ratón el libro asoma; al hacer clic viene a la mano y se abre la ficha (pedir prestado, favorito). Los favoritos llevan una cinta roja y los prestados una etiqueta con la fecha de vuelta. `/libros?vista=tabla` muestra la lista de siempre.
- **Admin · `/admin/panel`**: los libros prestados salen de su hueco y flotan delante con un anillo que marca lo que queda de préstamo (verde en plazo, ámbar ≤ 3 días, rojo vencido) y un hilo de luz hasta su hueco. A la derecha, resumen y lista de préstamos enlazada con la escena.
- Datos en JSON: `/libros/datos` (socio, sin datos de otros socios) y `/admin/panel/datos` (solo ADMIN).
- Necesita internet: three.js se carga desde jsDelivr y las portadas desde Open Library. Si el navegador no tiene WebGL se ofrece la lista.
- Código: `static/js/biblioteca3d.js` (sala, madera, libros, portadas), `estanteria.js`, `panel.js`, `static/css/estanteria.css`, `controller/VistaLibros.java`, `PanelController.java`, `dto/`.

## Guion sugerido para el vídeo
1. Sin sesión: portada → intentar `/admin/libros` → redirige a login.
2. Registro: error de contraseñas distintas → registro correcto → login.
3. Como USER: menú de socio, pedir un libro, Mis préstamos, marcar favorito, intentar `/admin/libros` → 403.
4. Como ADMIN: menú de administración, crear/editar/borrar libro, Usuarios con roles, marcar préstamo devuelto, intentar `/user/prestamos` → 403.
5. Mostrar en la BD que la contraseña está cifrada (`$2a$10$...`).
6. `docker compose up --build` funcionando.
