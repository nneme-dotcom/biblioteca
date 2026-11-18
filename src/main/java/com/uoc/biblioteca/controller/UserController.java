package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.model.Libro;
import com.uoc.biblioteca.model.Prestamo;
import com.uoc.biblioteca.model.Usuario;
import com.uoc.biblioteca.repository.LibroRepository;
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

import java.security.Principal;
import java.time.LocalDate;

// La zona del socio (/user/...). Solo entra ROLE_USER y siempre trabaja con SUS datos.
@Controller
@RequestMapping("/user")
public class UserController {

    // Cuántos días tiene el socio para devolver un libro.
    private static final int DIAS_PRESTAMO = 14;

    private final UsuarioRepository usuarioRepository;
    private final LibroRepository libroRepository;
    private final PrestamoRepository prestamoRepository;

    public UserController(UsuarioRepository usuarioRepository, LibroRepository libroRepository,
                          PrestamoRepository prestamoRepository) {
        this.usuarioRepository = usuarioRepository;
        this.libroRepository = libroRepository;
        this.prestamoRepository = prestamoRepository;
    }

    // El usuario que inició sesión, a partir del email guardado en la sesión.
    private Usuario actual(Principal principal) {
        return usuarioRepository.findByEmail(principal.getName()).orElseThrow();
    }

    @GetMapping("/prestamos")
    public String misPrestamos(Model model, Principal principal) {
        model.addAttribute("prestamos", prestamoRepository.findByUsuarioOrderByFechaPrestamoDesc(actual(principal)));
        return "user/prestamos";
    }

    // Pide un libro prestado desde el catálogo.
    @PostMapping("/prestamos/solicitar/{libroId}")
    @Transactional
    public String solicitar(@PathVariable Long libroId, Principal principal, RedirectAttributes redirect) {
        Libro libro = libroRepository.findById(libroId).orElseThrow();
        if (!libro.isDisponible()) {
            redirect.addFlashAttribute("error", "\"" + libro.getTitulo() + "\" no está disponible ahora.");
            return "redirect:/libros";
        }
        Prestamo p = new Prestamo();
        p.setLibro(libro);
        p.setUsuario(actual(principal));
        p.setFechaPrestamo(LocalDate.now());
        p.setFechaDevolucionPrevista(LocalDate.now().plusDays(DIAS_PRESTAMO));
        p.setDevuelto(false);
        prestamoRepository.save(p);
        libro.setDisponible(false);
        redirect.addFlashAttribute("mensaje", "Listo: te llevás \"" + libro.getTitulo() + "\". Devolvelo antes del "
                + p.getFechaDevolucionPrevista() + ".");
        return "redirect:/user/prestamos";
    }

    @GetMapping("/favoritos")
    public String favoritos(Model model, Principal principal) {
        model.addAttribute("favoritos", actual(principal).getFavoritos());
        return "user/favoritos";
    }

    // Marca o desmarca un libro como favorito (como un interruptor).
    @PostMapping("/favoritos/{libroId}")
    @Transactional
    public String alternarFavorito(@PathVariable Long libroId, Principal principal) {
        Usuario u = actual(principal);
        Libro libro = libroRepository.findById(libroId).orElseThrow();
        if (!u.getFavoritos().remove(libro)) {
            u.getFavoritos().add(libro);
        }
        return "redirect:/libros";
    }
}
