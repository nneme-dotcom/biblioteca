# Producto 2 · Diagrama E/R (Biblioteca)

Entidades: **Libro**, **Autor**, **Usuario**, **Préstamo**.

| Relación | Cardinalidad | Descripción |
|---|---|---|
| Libro – Autor | **N:M** | Un libro puede tener varios autores y un autor varios libros. Se implementa con la tabla intermedia `libro_autor`. |
| Usuario – Préstamo | 1:N | Un usuario puede tener muchos préstamos; cada préstamo pertenece a un usuario. |
| Libro – Préstamo | 1:N | Un libro puede prestarse muchas veces; cada préstamo corresponde a un libro. |

```mermaid
erDiagram
    LIBRO }o--o{ AUTOR : escrito_por
    USUARIO ||--o{ PRESTAMO : realiza
    LIBRO ||--o{ PRESTAMO : se_presta_en

    LIBRO {
        bigint id PK
        varchar titulo
        varchar isbn
        int anio
        boolean disponible
    }
    AUTOR {
        bigint id PK
        varchar nombre
        varchar nacionalidad
    }
    USUARIO {
        bigint id PK
        varchar nombre
        varchar email
        varchar telefono
        date fecha_alta
    }
    PRESTAMO {
        bigint id PK
        date fecha_prestamo
        date fecha_devolucion_prevista
        boolean devuelto
        bigint libro_id FK
        bigint usuario_id FK
    }
```
