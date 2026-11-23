package com.uoc.biblioteca.dto;

// El préstamo activo de un libro: quién lo tiene, desde cuándo y cuánto le queda.
// En la estantería del socio el nombre y el email van vacíos (no le mostramos quién lo tiene).
public record PrestamoVista(
        Long id,
        String socio,
        String email,
        String fechaPrestamo,
        String fechaDevolucion,
        long diasRestantes,
        boolean vencido) {
}
