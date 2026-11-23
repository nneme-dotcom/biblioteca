package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.dto.LibroVista;
import com.uoc.biblioteca.model.Libro;
import com.uoc.biblioteca.repository.LibroRepository;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// El catálogo de libros. El socio lo ve en la vista cinematográfica (estantería 3D a pantalla completa);
// en la vista tradicional (o con ?vista=tabla, o si es admin) se ve la tabla de siempre.
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
    public String catalogo(@RequestParam(required = false) String vista,
                           @CookieValue(name = VistaController.COOKIE, required = false) String preferencia,
                           Model model, Authentication auth) {
        boolean esSocio = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_USER"));
        boolean tradicional = "tabla".equals(vista) || VistaController.TRADICIONAL.equals(preferencia);
        if (esSocio && !tradicional) {
            return "libros/estanteria";
        }
        model.addAttribute("libros", libroRepository.findAll());
        model.addAttribute("favoritosIds", favoritosDe(auth.getName()));
        return "libros/lista";
    }

    // Los datos que dibuja la estantería 3D, en JSON (el front-end 3D solo habla con estas rutas).
    @GetMapping("/libros/datos")
    @ResponseBody
    public List<LibroVista> datos(Authentication auth) {
        return vistaLibros.armar(favoritosDe(auth.getName()), false, auth.getName());
    }

    // Para pintar la estrella en los favoritos del socio.
    private Set<Long> favoritosDe(String email) {
        return usuarioRepository.findByEmail(email)
                .map(u -> u.getFavoritos().stream().map(Libro::getId).collect(Collectors.toSet()))
                .orElse(Set.of());
    }
}
