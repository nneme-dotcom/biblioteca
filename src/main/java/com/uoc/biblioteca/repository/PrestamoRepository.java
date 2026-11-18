package com.uoc.biblioteca.repository;

import com.uoc.biblioteca.model.Prestamo;
import com.uoc.biblioteca.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// El archivero de los préstamos: guardar, buscar y borrar viene de regalo con Spring.
public interface PrestamoRepository extends JpaRepository<Prestamo, Long> {

    // "Mis préstamos": los de un usuario, del más nuevo al más viejo.
    List<Prestamo> findByUsuarioOrderByFechaPrestamoDesc(Usuario usuario);
}
