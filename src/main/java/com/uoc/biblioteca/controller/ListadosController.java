package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.model.Prestamo;
import com.uoc.biblioteca.repository.PrestamoRepository;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

// Pantallas de administración de usuarios y préstamos. Solo ROLE_ADMIN.
@Controller
@RequestMapping("/admin")
public class ListadosController {

    private final UsuarioRepository usuarioRepository;
    private final PrestamoRepository prestamoRepository;

    public ListadosController(UsuarioRepository usuarioRepository, PrestamoRepository prestamoRepository) {
        this.usuarioRepository = usuarioRepository;
        this.prestamoRepository = prestamoRepository;
    }

    // Muestra todos los socios de la biblioteca, con sus roles.
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

    // El socio trajo el libro: el préstamo se cierra y el libro vuelve a estar disponible.
    @PostMapping("/prestamos/{id}/devolver")
    @Transactional
    public String devolver(@PathVariable Long id, RedirectAttributes redirect) {
        Prestamo p = prestamoRepository.findById(id).orElseThrow();
        p.setDevuelto(true);
        p.getLibro().setDisponible(true);
        redirect.addFlashAttribute("mensaje", "Préstamo de \"" + p.getLibro().getTitulo() + "\" marcado como devuelto.");
        return "redirect:/admin/prestamos";
    }
}
