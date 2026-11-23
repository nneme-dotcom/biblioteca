package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.dto.LibroVista;
import com.uoc.biblioteca.model.Libro;
import com.uoc.biblioteca.repository.LibroRepository;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// El catálogo de libros que ve cualquiera que haya iniciado sesión.
// El socio lo ve como una estantería 3D; con ?vista=tabla (o si es admin) se ve la tabla de siempre.
@Controller
public class CatalogoController {

    private final LibroRepository libroRepository;
    private final UsuarioRepository usuarioRepository;
    private final VistaLibros vistaLibros;

    public CatalogoController(LibroRepository libroRepository, UsuarioRepository usuarioRepository,
                              VistaLibros vistaLibros) {
        this.libroRepository = libroRepository;
        this.usuarioRepository = usuarioRepository;
        this.vistaLibros = vistaLibros;
    }

    @GetMapping("/libros")
    public String catalogo(@RequestParam(required = false) String vista, Model model, Authentication auth) {
        boolean esSocio = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_USER"));
        if (esSocio && !"tabla".equals(vista)) {
            return "libros/estanteria";
        }
        model.addAttribute("libros", libroRepository.findAll());
        model.addAttribute("favoritosIds", favoritosDe(auth.getName()));
        return "libros/lista";
    }

    // Los datos que dibuja la estantería 3D, en JSON.
    @GetMapping("/libros/datos")
    @ResponseBody
    public List<LibroVista> datos(Authentication auth) {
        return vistaLibros.armar(favoritosDe(auth.getName()), false);
    }

    // Para pintar la estrella en los favoritos del socio.
    private Set<Long> favoritosDe(String email) {
        return usuarioRepository.findByEmail(email)
                .map(u -> u.getFavoritos().stream().map(Libro::getId).collect(Collectors.toSet()))
                .orElse(Set.of());
    }
}
