package com.uoc.biblioteca.dto;

import java.util.List;

// Lo que necesita la estantería 3D de cada libro. Es un "record": una caja de datos de solo lectura
// que Spring convierte a JSON sola. Así no mandamos al navegador las entidades enteras (ni contraseñas).
public record LibroVista(
        Long id,
        String titulo,
        List<String> autores,
        Integer anio,
        String isbn,
        boolean disponible,
        boolean favorito,
        PrestamoVista prestamo) {
}
