package com.uoc.biblioteca.model;

import jakarta.persistence.*;

// Un rol dice qué puede hacer cada usuario: ROLE_ADMIN gestiona todo, ROLE_USER pide libros.
@Entity
@Table(name = "rol")
public class Rol {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Spring Security espera que el nombre empiece con "ROLE_".
    @Column(nullable = false, unique = true)
    private String nombre;

    private String descripcion;

    public Rol() { }

    public Rol(String nombre, String descripcion) {
        this.nombre = nombre;
        this.descripcion = descripcion;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
}
