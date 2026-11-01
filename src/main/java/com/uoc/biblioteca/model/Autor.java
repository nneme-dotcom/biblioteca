package com.uoc.biblioteca.model;

import jakarta.persistence.*;

import java.util.HashSet;
import java.util.Set;

// Una persona que escribe libros.
@Entity
@Table(name = "autor")
public class Autor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    private String nacionalidad;

    // Los libros que escribió. Un autor puede tener muchos libros y un libro muchos autores.
    @ManyToMany(mappedBy = "autores")
    private Set<Libro> libros = new HashSet<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getNacionalidad() { return nacionalidad; }
    public void setNacionalidad(String nacionalidad) { this.nacionalidad = nacionalidad; }

    public Set<Libro> getLibros() { return libros; }
    public void setLibros(Set<Libro> libros) { this.libros = libros; }
}
