package com.uoc.biblioteca.dto;

// El préstamo activo de un libro: quién lo tiene, desde cuándo y cuánto le queda.
// En la vista del socio los datos personales van vacíos; solo sabe si el préstamo es suyo (propio).
public record PrestamoVista(
        Long id,
        String socio,
        String email,
        String telefono,
        String fechaPrestamo,
        String fechaDevolucion,
        long diasRestantes,
        boolean vencido,
        boolean propio) {
}
