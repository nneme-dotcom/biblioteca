package com.uoc.biblioteca.repository;

import com.uoc.biblioteca.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

// El archivero de los usuarios: guardar, buscar y borrar viene de regalo con Spring.
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
}
