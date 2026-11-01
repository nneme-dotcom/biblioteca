package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.repository.PrestamoRepository;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

// Las pantallas de solo lectura: lista de usuarios y lista de préstamos.
@Controller
public class ListadosController {

    private final UsuarioRepository usuarioRepository;
    private final PrestamoRepository prestamoRepository;

    public ListadosController(UsuarioRepository usuarioRepository, PrestamoRepository prestamoRepository) {
        this.usuarioRepository = usuarioRepository;
        this.prestamoRepository = prestamoRepository;
    }

    // Muestra todos los socios de la biblioteca.
    @GetMapping("/usuarios")
    public String usuarios(Model model) {
        model.addAttribute("usuarios", usuarioRepository.findAll());
        return "usuarios/lista";
    }

    // Muestra todos los préstamos, devueltos o no.
    @GetMapping("/prestamos")
    public String prestamos(Model model) {
        model.addAttribute("prestamos", prestamoRepository.findAll());
        return "prestamos/lista";
    }
}
