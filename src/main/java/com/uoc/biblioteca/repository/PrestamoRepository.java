package com.uoc.biblioteca.repository;

import com.uoc.biblioteca.model.Prestamo;
import org.springframework.data.jpa.repository.JpaRepository;

// El archivero de los préstamos: guardar, buscar y borrar viene de regalo con Spring.
public interface PrestamoRepository extends JpaRepository<Prestamo, Long> {
}
