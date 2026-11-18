package com.uoc.biblioteca.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

// Un socio de la biblioteca. Desde el Producto 3 también es quien inicia sesión en la app.
@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    // No puede haber dos socios con el mismo email. Es lo que se escribe para entrar.
    @Column(unique = true)
    private String email;

    private String telefono;

    private LocalDate fechaAlta;

    // La contraseña se guarda cifrada con BCrypt, nunca en texto plano.
    private String password;

    // Si está en false, la cuenta existe pero no puede iniciar sesión.
    private Boolean activo = true;

    // Qué puede hacer: un usuario puede tener varios roles y un rol lo tienen muchos usuarios.
    // Se cargan siempre junto con el usuario porque Spring Security los necesita al iniciar sesión.
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "usuario_rol",
            joinColumns = @JoinColumn(name = "usuario_id"),
            inverseJoinColumns = @JoinColumn(name = "rol_id"))
    private Set<Rol> roles = new HashSet<>();

    // Los libros que marcó como favoritos. Relación nueva N:M con Libro.
    @ManyToMany
    @JoinTable(
            name = "usuario_favorito",
            joinColumns = @JoinColumn(name = "usuario_id"),
            inverseJoinColumns = @JoinColumn(name = "libro_id"))
    private Set<Libro> favoritos = new HashSet<>();

    // Todos los libros que pidió alguna vez.
    @OneToMany(mappedBy = "usuario")
    private Set<Prestamo> prestamos = new HashSet<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public LocalDate getFechaAlta() { return fechaAlta; }
    public void setFechaAlta(LocalDate fechaAlta) { this.fechaAlta = fechaAlta; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }

    public Set<Rol> getRoles() { return roles; }
    public void setRoles(Set<Rol> roles) { this.roles = roles; }

    public Set<Libro> getFavoritos() { return favoritos; }
    public void setFavoritos(Set<Libro> favoritos) { this.favoritos = favoritos; }

    public Set<Prestamo> getPrestamos() { return prestamos; }
    public void setPrestamos(Set<Prestamo> prestamos) { this.prestamos = prestamos; }

    // Atajo para las vistas: ¿tiene este rol?
    public boolean tieneRol(String nombreRol) {
        return roles.stream().anyMatch(r -> r.getNombre().equals(nombreRol));
    }
}
