package com.uoc.biblioteca.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// Saludo de bienvenida del Producto 1. Si ves este mensaje, la app está viva.
@RestController
public class HelloController {

    @GetMapping("/")
    public String hello() {
        return "Hello World - Biblioteca FP065";
    }
}
