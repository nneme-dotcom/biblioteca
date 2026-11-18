package com.uoc.biblioteca.repository;

import com.uoc.biblioteca.model.Rol;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

// El archivero de los roles.
public interface RolRepository extends JpaRepository<Rol, Long> {

    Optional<Rol> findByNombre(String nombre);
}
