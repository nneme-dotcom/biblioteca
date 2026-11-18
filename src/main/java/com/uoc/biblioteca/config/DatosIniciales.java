package com.uoc.biblioteca.config;

import com.uoc.biblioteca.model.Rol;
import com.uoc.biblioteca.model.Usuario;
import com.uoc.biblioteca.repository.RolRepository;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

// Se ejecuta una vez cada vez que arranca la app, después de data.sql.
// Deja listos los roles, el administrador y una contraseña para los socios de ejemplo.
@Component
public class DatosIniciales implements CommandLineRunner {

    private final RolRepository rolRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    // Se pueden cambiar desde docker-compose.yml o desde variables de entorno.
    @Value("${app.admin.email:admin@biblioteca.com}")
    private String adminEmail;

    @Value("${app.admin.password:admin123}")
    private String adminPassword;

    @Value("${app.demo.password:usuario123}")
    private String demoPassword;

    public DatosIniciales(RolRepository rolRepository, UsuarioRepository usuarioRepository,
                          PasswordEncoder passwordEncoder) {
        this.rolRepository = rolRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        Rol admin = crearRolSiFalta("ROLE_ADMIN", "Gestiona libros, usuarios y préstamos");
        Rol user = crearRolSiFalta("ROLE_USER", "Socio: consulta el catálogo y pide préstamos");

        // El administrador inicial. Si ya existe, no se toca.
        if (!usuarioRepository.existsByEmail(adminEmail)) {
            Usuario a = new Usuario();
            a.setNombre("Administración");
            a.setEmail(adminEmail);
            a.setFechaAlta(LocalDate.now());
            a.setPassword(passwordEncoder.encode(adminPassword));
            a.setActivo(true);
            a.getRoles().add(admin);
            usuarioRepository.save(a);
        }

        // Los socios de ejemplo de data.sql no tienen contraseña ni rol: les ponemos unos.
        for (Usuario u : usuarioRepository.findAll()) {
            boolean cambio = false;
            if (u.getPassword() == null || u.getPassword().isBlank()) {
                u.setPassword(passwordEncoder.encode(demoPassword));
                cambio = true;
            }
            if (u.getActivo() == null) {
                u.setActivo(true);
                cambio = true;
            }
            if (u.getRoles().isEmpty()) {
                u.getRoles().add(user);
                cambio = true;
            }
            if (cambio) {
                usuarioRepository.save(u);
            }
        }
    }

    private Rol crearRolSiFalta(String nombre, String descripcion) {
        return rolRepository.findByNombre(nombre)
                .orElseGet(() -> rolRepository.save(new Rol(nombre, descripcion)));
    }
}
