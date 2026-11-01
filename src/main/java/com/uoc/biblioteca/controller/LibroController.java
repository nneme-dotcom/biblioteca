package com.uoc.biblioteca.controller;

import com.uoc.biblioteca.model.Autor;
import com.uoc.biblioteca.model.Libro;
import com.uoc.biblioteca.repository.AutorRepository;
import com.uoc.biblioteca.repository.LibroRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// Todo lo que pasa con los libros: verlos, crearlos, editarlos y borrarlos.
@Controller
@RequestMapping("/libros")
public class LibroController {

    // Los "archiveros" de donde sacamos y guardamos libros y autores.
    private final LibroRepository libroRepository;
    private final AutorRepository autorRepository;

    public LibroController(LibroRepository libroRepository, AutorRepository autorRepository) {
        this.libroRepository = libroRepository;
        this.autorRepository = autorRepository;
    }

    // Muestra la lista con todos los libros.
    @GetMapping
    public String listar(Model model) {
        model.addAttribute("libros", libroRepository.findAll());
        return "libros/lista";
    }

    // Abre el formulario vacío para cargar un libro nuevo.
    @GetMapping("/nuevo")
    public String nuevo(Model model) {
        model.addAttribute("libro", new Libro());
        model.addAttribute("autores", autorRepository.findAll());
        model.addAttribute("autorIdsSeleccionados", List.of());
        return "libros/formulario";
    }

    // Abre el formulario con los datos de un libro que ya existe, listo para cambiarlo.
    @GetMapping("/{id}/editar")
    public String editar(@PathVariable Long id, Model model) {
        Libro libro = libroRepository.findById(id).orElseThrow();
        model.addAttribute("libro", libro);
        model.addAttribute("autores", autorRepository.findAll());
        // Marcamos en la lista los autores que ya tiene el libro.
        model.addAttribute("autorIdsSeleccionados",
                libro.getAutores().stream().map(Autor::getId).collect(Collectors.toList()));
        return "libros/formulario";
    }

    // Guarda el libro, sea nuevo o editado, junto con los autores elegidos.
    @PostMapping
    public String guardar(@ModelAttribute Libro libro,
                          @RequestParam(name = "autorIds", required = false) List<Long> autorIds) {
        Set<Autor> autores = new HashSet<>();
        if (autorIds != null) {
            autorRepository.findAllById(autorIds).forEach(autores::add);
        }
        libro.setAutores(autores);
        libroRepository.save(libro);
        return "redirect:/libros";
    }

    // Borra el libro. Ojo: si tiene préstamos, la base de datos no lo deja borrar.
    @PostMapping("/{id}/eliminar")
    public String eliminar(@PathVariable Long id) {
        libroRepository.deleteById(id);
        return "redirect:/libros";
    }
}
