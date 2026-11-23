package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.dto.LibroVista;
import com.uoc.biblioteca.dto.PrestamoVista;
import com.uoc.biblioteca.model.Autor;
import com.uoc.biblioteca.model.Libro;
import com.uoc.biblioteca.model.Prestamo;
import com.uoc.biblioteca.repository.LibroRepository;
import com.uoc.biblioteca.repository.PrestamoRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

// Arma la lista de libros que dibujan las vistas 3D (estantería del socio y panel del admin).
// Está en un solo lugar para que las dos pantallas cuenten lo mismo.
@Component
public class VistaLibros {

    private final LibroRepository libroRepository;
    private final PrestamoRepository prestamoRepository;

    public VistaLibros(LibroRepository libroRepository, PrestamoRepository prestamoRepository) {
        this.libroRepository = libroRepository;
        this.prestamoRepository = prestamoRepository;
    }

    // conDatosDelSocio = true solo para administración: incluye quién tiene cada libro y su teléfono.
    // emailActual sirve para marcar los préstamos que son del propio socio.
    public List<LibroVista> armar(Set<Long> favoritosIds, boolean conDatosDelSocio, String emailActual) {
        LocalDate hoy = LocalDate.now();
        // Préstamo activo de cada libro (si hubiera más de uno, el más reciente).
        Map<Long, Prestamo> activos = prestamoRepository.findByDevueltoFalse().stream()
                .collect(Collectors.toMap(p -> p.getLibro().getId(), Function.identity(),
                        (a, b) -> a.getFechaPrestamo().isAfter(b.getFechaPrestamo()) ? a : b));

        return libroRepository.findAll().stream()
                .sorted(Comparator.comparing(Libro::getId))
                .map(l -> {
                    Prestamo p = activos.get(l.getId());
                    PrestamoVista pv = null;
                    if (p != null) {
                        long dias = ChronoUnit.DAYS.between(hoy, p.getFechaDevolucionPrevista());
                        pv = new PrestamoVista(
                                p.getId(),
                                conDatosDelSocio ? p.getUsuario().getNombre() : null,
                                conDatosDelSocio ? p.getUsuario().getEmail() : null,
                                conDatosDelSocio ? p.getUsuario().getTelefono() : null,
                                String.valueOf(p.getFechaPrestamo()),
                                String.valueOf(p.getFechaDevolucionPrevista()),
                                dias,
                                dias < 0,
                                p.getUsuario().getEmail() != null && p.getUsuario().getEmail().equals(emailActual));
                    }
                    List<String> autores = l.getAutores().stream()
                            .map(Autor::getNombre).sorted().toList();
                    return new LibroVista(l.getId(), l.getTitulo(), autores, l.getAnio(), l.getIsbn(), l.getGenero(),
                            l.isDisponible(), favoritosIds.contains(l.getId()), pv);
                })
                .toList();
    }
}
