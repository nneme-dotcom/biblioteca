package com.uoc.biblioteca.model;

import jakarta.persistence.*;

import java.util.HashSet;
import java.util.Set;

// Un libro de la biblioteca.
@Entity
@Table(name = "libro")
public class Libro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String titulo;

    private String isbn;

    private Integer anio;

    // ¿Está en la estantería? Si alguien lo tiene prestado, no.
    private boolean disponible = true;

    // Quién lo escribió. La tabla libro_autor une cada libro con sus autores.
    @ManyToMany
    @JoinTable(
            name = "libro_autor",
            joinColumns = @JoinColumn(name = "libro_id"),
            inverseJoinColumns = @JoinColumn(name = "autor_id"))
    private Set<Autor> autores = new HashSet<>();

    // Todas las veces que se prestó este libro.
    @OneToMany(mappedBy = "libro")
    private Set<Prestamo> prestamos = new HashSet<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getIsbn() { return isbn; }
    public void setIsbn(String isbn) { this.isbn = isbn; }

    public Integer getAnio() { return anio; }
    public void setAnio(Integer anio) { this.anio = anio; }

    public boolean isDisponible() { return disponible; }
    public void setDisponible(boolean disponible) { this.disponible = disponible; }

    public Set<Autor> getAutores() { return autores; }
    public void setAutores(Set<Autor> autores) { this.autores = autores; }

    public Set<Prestamo> getPrestamos() { return prestamos; }
    public void setPrestamos(Set<Prestamo> prestamos) { this.prestamos = prestamos; }
}
