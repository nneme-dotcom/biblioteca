package com.uoc.biblioteca.repository;

import com.uoc.biblioteca.model.Autor;
import org.springframework.data.jpa.repository.JpaRepository;

// El archivero de los autores: guardar, buscar y borrar viene de regalo con Spring.
public interface AutorRepository extends JpaRepository<Autor, Long> {
}
