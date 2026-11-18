package com.uoc.biblioteca.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

// La portada (reemplaza al Hello World del Producto 1) y la página de "acceso denegado".
@Controller
public class HomeController {

    @GetMapping("/")
    public String inicio() {
        return "index";
    }

    // Spring Security manda acá a quien entra en una zona que no le corresponde.
    // Acepta cualquier método porque también llegan POST rechazados (por ejemplo, sin token CSRF).
    @RequestMapping("/403")
    public String accesoDenegado() {
        return "error/403";
    }
}
