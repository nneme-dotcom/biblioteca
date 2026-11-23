package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.dto.LibroVista;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;
import java.util.Set;

// Panel 3D de administración: dónde está cada libro y cuánto le queda a cada préstamo.
// Vive en /admin, así que solo entra ROLE_ADMIN (ver SecurityConfig).
@Controller
@RequestMapping("/admin/panel")
public class PanelController {

    private final VistaLibros vistaLibros;

    public PanelController(VistaLibros vistaLibros) {
        this.vistaLibros = vistaLibros;
    }

    @GetMapping
    public String panel() {
        return "admin/panel";
    }

    // Todos los libros con su préstamo activo, incluido quién lo tiene y su teléfono.
    @GetMapping("/datos")
    @ResponseBody
    public List<LibroVista> datos() {
        return vistaLibros.armar(Set.of(), true, null);
    }
}
