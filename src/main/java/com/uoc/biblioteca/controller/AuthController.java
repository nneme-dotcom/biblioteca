package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.model.Usuario;
import com.uoc.biblioteca.repository.RolRepository;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.LocalDate;

// Login y registro de usuarios nuevos.
// El POST de /login no está acá: lo atiende Spring Security solo.
@Controller
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UsuarioRepository usuarioRepository, RolRepository rolRepository,
                          PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.rolRepository = rolRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/login")
    public String login() {
        return "auth/login";
    }

    @GetMapping("/registro")
    public String registro(Model model) {
        model.addAttribute("usuario", new Usuario());
        return "auth/registro";
    }

    // Da de alta al socio nuevo. Siempre entra como ROLE_USER: los administradores no se registran solos.
    @PostMapping("/registro")
    public String registrar(@RequestParam String nombre,
                            @RequestParam String email,
                            @RequestParam(required = false) String telefono,
                            @RequestParam String password,
                            @RequestParam String confirmacion,
                            Model model) {
        String emailLimpio = email.trim().toLowerCase();
        String error = null;
        if (nombre.isBlank() || emailLimpio.isBlank()) {
            error = "El nombre y el email son obligatorios.";
        } else if (usuarioRepository.existsByEmail(emailLimpio)) {
            error = "Ya hay una cuenta con ese email.";
        } else if (password.length() < 6) {
            error = "La contraseña tiene que tener al menos 6 caracteres.";
        } else if (!password.equals(confirmacion)) {
            error = "Las contraseñas no coinciden.";
        }

        if (error != null) {
            // Volvemos al formulario con lo que ya había escrito (menos las contraseñas).
            Usuario u = new Usuario();
            u.setNombre(nombre);
            u.setEmail(email);
            u.setTelefono(telefono);
            model.addAttribute("usuario", u);
            model.addAttribute("error", error);
            return "auth/registro";
        }

        Usuario nuevo = new Usuario();
        nuevo.setNombre(nombre.trim());
        nuevo.setEmail(emailLimpio);
        nuevo.setTelefono(telefono);
        nuevo.setFechaAlta(LocalDate.now());
        nuevo.setPassword(passwordEncoder.encode(password));
        nuevo.setActivo(true);
        nuevo.getRoles().add(rolRepository.findByNombre("ROLE_USER").orElseThrow());
        usuarioRepository.save(nuevo);
        return "redirect:/login?registrado";
    }
}
