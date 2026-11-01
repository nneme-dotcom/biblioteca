package com.uoc.biblioteca.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

// Un socio de la biblioteca, el que pide libros prestados.
@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    // No puede haber dos socios con el mismo email.
    @Column(unique = true)
    private String email;

    private String telefono;

    private LocalDate fechaAlta;

    // Todos los libros que pidió alguna vez.
    @OneToMany(mappedBy = "usuario")
    private Set<Prestamo> prestamos = new HashSet<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public LocalDate getFechaAlta() { return fechaAlta; }
    public void setFechaAlta(LocalDate fechaAlta) { this.fechaAlta = fechaAlta; }

    public Set<Prestamo> getPrestamos() { return prestamos; }
    public void setPrestamos(Set<Prestamo> prestamos) { this.prestamos = prestamos; }
}
