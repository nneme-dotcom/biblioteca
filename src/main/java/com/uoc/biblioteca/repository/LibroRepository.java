package com.uoc.biblioteca.repository;

import com.uoc.biblioteca.model.Libro;
import org.springframework.data.jpa.repository.JpaRepository;

// El archivero de los libros: guardar, buscar y borrar viene de regalo con Spring.
public interface LibroRepository extends JpaRepository<Libro, Long> {
}
