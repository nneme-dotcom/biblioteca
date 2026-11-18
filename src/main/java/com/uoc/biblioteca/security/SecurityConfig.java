package com.uoc.biblioteca.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

// Las reglas de seguridad de toda la app: quién puede entrar a qué.
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Abierto a todo el mundo: portada, login, registro y estilos.
                .requestMatchers("/", "/login", "/registro", "/css/**", "/error").permitAll()
                // Solo administración: todo lo que crea, cambia o borra datos.
                .requestMatchers("/admin/**").hasRole("ADMIN")
                // Zona del socio: sus préstamos y sus favoritos.
                .requestMatchers("/user/**").hasRole("USER")
                // Lo demás (por ejemplo, el catálogo) pide haber iniciado sesión.
                .anyRequest().authenticated())
            // Usamos nuestro propio formulario de login. El usuario se identifica con el email.
            .formLogin(form -> form
                .loginPage("/login")
                .usernameParameter("email")
                .defaultSuccessUrl("/", true)
                .failureUrl("/login?error")
                .permitAll())
            .logout(logout -> logout
                .logoutSuccessUrl("/login?logout")
                .permitAll())
            // Si alguien entra donde no le toca, ve una página propia en lugar del error genérico.
            .exceptionHandling(ex -> ex.accessDeniedPage("/403"));
        return http.build();
    }

    // BCrypt cifra las contraseñas de forma que no se puedan leer aunque alguien vea la base de datos.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
