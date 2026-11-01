package com.uoc.biblioteca.model;

import jakarta.persistence.*;

import java.time.LocalDate;

// Cuando alguien se lleva un libro a casa.
@Entity
@Table(name = "prestamo")
public class Prestamo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate fechaPrestamo;

    private LocalDate fechaDevolucionPrevista;

    // ¿Ya lo trajo de vuelta?
    private boolean devuelto;

    // Qué libro se llevó...
    @ManyToOne(optional = false)
    @JoinColumn(name = "libro_id")
    private Libro libro;

    // ...y quién se lo llevó.
    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDate getFechaPrestamo() { return fechaPrestamo; }
    public void setFechaPrestamo(LocalDate fechaPrestamo) { this.fechaPrestamo = fechaPrestamo; }

    public LocalDate getFechaDevolucionPrevista() { return fechaDevolucionPrevista; }
    public void setFechaDevolucionPrevista(LocalDate f) { this.fechaDevolucionPrevista = f; }

    public boolean isDevuelto() { return devuelto; }
    public void setDevuelto(boolean devuelto) { this.devuelto = devuelto; }

    public Libro getLibro() { return libro; }
    public void setLibro(Libro libro) { this.libro = libro; }

    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
}
