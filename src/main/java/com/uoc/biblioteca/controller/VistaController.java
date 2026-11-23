package com.uoc.biblioteca.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

// Cambia entre las dos formas de usar la app y lo recuerda en una cookie:
//  - "cine": vista cinematográfica en 3D a pantalla completa (estantería del socio, panel del admin).
//  - "tradicional": las pantallas de siempre, con el menú de pestañas.
// El back-end es el mismo para las dos: solo cambia el front-end.
@Controller
public class VistaController {

    public static final String COOKIE = "vista";
    public static final String CINE = "cine";
    public static final String TRADICIONAL = "tradicional";

    @GetMapping("/vista/{modo}")
    public String cambiar(@PathVariable String modo, HttpServletResponse response) {
        Cookie c = new Cookie(COOKIE, TRADICIONAL.equals(modo) ? TRADICIONAL : CINE);
        c.setPath("/");
        c.setMaxAge(60 * 60 * 24 * 365);
        c.setHttpOnly(true);
        response.addCookie(c);
        return "redirect:/";
    }
}
