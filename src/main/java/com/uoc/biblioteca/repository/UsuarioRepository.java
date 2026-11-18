package com.uoc.biblioteca.repository;

import com.uoc.biblioteca.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

// El archivero de los usuarios: guardar, buscar y borrar viene de regalo con Spring.
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    // Para el login: el email es el nombre de usuario.
    Optional<Usuario> findByEmail(String email);

    // Para el registro: no dejamos repetir email.
    boolean existsByEmail(String email);
}
