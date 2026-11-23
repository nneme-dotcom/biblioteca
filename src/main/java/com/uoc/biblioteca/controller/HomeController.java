package com.uoc.biblioteca.controller;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

// La portada y la página de "acceso denegado".
// Con sesión iniciada y en vista cinematográfica (la de por defecto), la portada lleva directo a la
// escena 3D de cada rol. En vista tradicional se queda en la portada de siempre, con su menú.
@Controller
public class HomeController {

    @GetMapping("/")
    public String inicio(Authentication auth,
                         @CookieValue(name = VistaController.COOKIE, required = false) String vista) {
        if (auth != null && auth.isAuthenticated() && !VistaController.TRADICIONAL.equals(vista)) {
            boolean admin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
            boolean socio = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_USER"));
            if (admin) return "redirect:/admin/panel";
            if (socio) return "redirect:/libros";
        }
        return "index";
    }

    // Spring Security manda acá a quien entra en una zona que no le corresponde.
    // Acepta cualquier método porque también llegan POST rechazados (por ejemplo, sin token CSRF).
    @RequestMapping("/403")
    public String accesoDenegado() {
        return "error/403";
    }
}
