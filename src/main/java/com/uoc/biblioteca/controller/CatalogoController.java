package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.model.Libro;
import com.uoc.biblioteca.repository.LibroRepository;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.security.Principal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// El catálogo de libros que ve cualquiera que haya iniciado sesión.
// Lo que cambia según el rol (botones de editar, pedir prestado...) lo decide la vista.
@Controller
public class CatalogoController {

    private final LibroRepository libroRepository;
    private final UsuarioRepository usuarioRepository;

    public CatalogoController(LibroRepository libroRepository, UsuarioRepository usuarioRepository) {
        this.libroRepository = libroRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @GetMapping("/libros")
    public String catalogo(Model model, Principal principal) {
        model.addAttribute("libros", libroRepository.findAll());
        // Para pintar la estrella en los favoritos del socio.
        Set<Long> favoritosIds = usuarioRepository.findByEmail(principal.getName())
                .map(u -> u.getFavoritos().stream().map(Libro::getId).collect(Collectors.toSet()))
                .orElse(Set.of());
        model.addAttribute("favoritosIds", favoritosIds);
        return "libros/lista";
    }
}
