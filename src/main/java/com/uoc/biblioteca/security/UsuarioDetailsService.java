package com.uoc.biblioteca.security;

import com.uoc.biblioteca.model.Rol;
import com.uoc.biblioteca.model.Usuario;
import com.uoc.biblioteca.repository.UsuarioRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

// El puente entre nuestra tabla usuario y Spring Security.
// Cuando alguien intenta entrar, Spring llama a este método con el email que escribió.
@Service
public class UsuarioDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new UsernameNotFoundException("No existe un usuario con ese email"));

        // Un usuario sin contraseña todavía no puede entrar.
        boolean sinPassword = usuario.getPassword() == null || usuario.getPassword().isBlank();
        boolean inactivo = Boolean.FALSE.equals(usuario.getActivo());

        return User.withUsername(usuario.getEmail())
                .password(sinPassword ? "" : usuario.getPassword())
                .authorities(usuario.getRoles().stream().map(Rol::getNombre).toArray(String[]::new))
                .disabled(sinPassword || inactivo)
                .build();
    }
}
