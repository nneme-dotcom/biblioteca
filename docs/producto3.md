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

## Dos vistas sobre el mismo back-end
El back-end (controladores, seguridad y rutas JSON) es uno solo. Encima hay dos front-ends y se pasa de uno a otro con un botón; la elección se guarda en la cookie `vista` (`/vista/cine` o `/vista/tradicional`).

- **Vista cinematográfica** (por defecto al iniciar sesión): pantalla completa, sin menú, en three.js.
  - **Socio · `/libros`**: solo la estantería, con 55 libros reales (portadas de Open Library) y un estante por género con su placa de latón grabada (clic para acercarte). La insignia dorada del lomo añade o quita favoritos. Los prestados están algo hundidos y apagados; los tuyos llevan un hilo verde. Al hacer clic en un libro sale del estante, la cámara se centra en él y se abre hasta la contratapa, donde está el bolsillo con la ficha de préstamo: «Sellar préstamo» estampa el sello con la fecha de devolución y registra el préstamo; la estrella de la ficha marca favorito. Clic fuera del libro (o Esc) lo devuelve al estante.
  - **Admin · `/admin/panel`**: panel de control 3D. Línea de tiempo con HOY en el centro: vencidos a la izquierda (rojo, laten), vencen en ≤ 3 días (ámbar) y en plazo (verde). Cada préstamo es una tarjeta con la portada; al hacer clic se despliegan los datos del socio (nombre, teléfono, email y fechas).
- **Vista tradicional**: las pantallas de siempre con el menú de pestañas (catálogo en tabla, mis préstamos, favoritos; gestión de libros, usuarios y préstamos para el admin). Enlace «✦ Vista cinematográfica» para volver.

Rutas JSON que usa el front-end 3D:
| Ruta | Rol | Qué hace |
|---|---|---|
| `GET /libros/datos` | USER | Libros con género, favorito y préstamo (solo si es tuyo se indica `propio`; nunca datos de otros socios) |
| `POST /user/api/prestamos/{id}` | USER | Pide el libro (14 días) y devuelve la fecha de devolución |
| `POST /user/api/favoritos/{id}` | USER | Marca o desmarca favorito |
| `GET /admin/panel/datos` | ADMIN | Libros con su préstamo activo, socio, email y teléfono |

Notas: necesita internet (three.js desde jsDelivr y portadas de Open Library). Abrí la estantería una vez antes de grabar para que el navegador guarde las portadas. Si el navegador no tiene WebGL se ofrece la vista tradicional.

Código 3D: `static/js/biblioteca3d.js` (sala, madera, libros que se abren, placas, portadas), `estanteria.js`, `panel.js`, `static/css/estanteria.css`; back-end: `VistaController`, `VistaLibros`, `PanelController`, `CatalogoController`, `UserController` (rutas `/api`), `dto/`.

## Guion sugerido para el vídeo
1. Sin sesión: portada → intentar `/admin/libros` → redirige a login.
2. Registro: error de contraseñas distintas → registro correcto → login.
3. Como USER: menú de socio, pedir un libro, Mis préstamos, marcar favorito, intentar `/admin/libros` → 403.
4. Como ADMIN: menú de administración, crear/editar/borrar libro, Usuarios con roles, marcar préstamo devuelto, intentar `/user/prestamos` → 403.
5. Mostrar en la BD que la contraseña está cifrada (`$2a$10$...`).
6. `docker compose up --build` funcionando.
