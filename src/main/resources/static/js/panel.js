// Panel 3D de administración.
// Los libros en préstamo salen de su hueco en la estantería y flotan delante, cada uno con un anillo
// que marca cuánto le queda (verde: en plazo · ámbar: vence en 3 días o menos · rojo: vencido).
// Una línea une cada libro con el hueco que dejó: de un vistazo se ve dónde está cada uno.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  crearEscenario, crearLibro, montarEstanteria, vestirConPortada, prefiereQuieto, webglDisponible,
} from './biblioteca3d.js';

const $ = (s) => document.querySelector(s);
const COLORES = { ok: 0x2bd99a, pronto: 0xffb020, vencido: 0xff3b3b };
const quieto = prefiereQuieto();

if (!webglDisponible()) {
  $('#cargando').textContent = 'Tu navegador no puede mostrar el panel 3D. La lista de préstamos de la derecha sigue disponible.';
  iniciarSoloLista();
} else {
  iniciar().catch((e) => { console.error(e); $('#cargando').textContent = 'No se pudo cargar el panel 3D.'; });
}

function estadoDe(p) { return p.vencido ? 'vencido' : (p.diasRestantes <= 3 ? 'pronto' : 'ok'); }
function fecha(iso) { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }
function textoDias(p) {
  if (p.vencido) return `Vencido hace ${-p.diasRestantes} ${-p.diasRestantes === 1 ? 'día' : 'días'}`;
  if (p.diasRestantes === 0) return 'Vence hoy';
  return `Quedan ${p.diasRestantes} ${p.diasRestantes === 1 ? 'día' : 'días'}`;
}

async function datos() { return (await fetch('/admin/panel/datos', { headers: { Accept: 'application/json' } })).json(); }

// Tarjetas de resumen y lista de préstamos (HTML: se lee igual con o sin 3D).
function pintarResumen(libros) {
  const prestados = libros.filter((l) => l.prestamo);
  const vencidos = prestados.filter((l) => l.prestamo.vencido);
  const pronto = prestados.filter((l) => !l.prestamo.vencido && l.prestamo.diasRestantes <= 3);
  $('#k-total').textContent = libros.length;
  $('#k-estante').textContent = libros.length - prestados.length;
  $('#k-prestados').textContent = prestados.length;
  $('#k-vencidos').textContent = vencidos.length;
  $('#k-pronto').textContent = pronto.length;

  const lista = $('#lista-prestamos');
  lista.innerHTML = '';
  if (!prestados.length) { lista.innerHTML = '<li class="vacio">No hay libros prestados ahora mismo.</li>'; return; }
  prestados.sort((a, b) => a.prestamo.diasRestantes - b.prestamo.diasRestantes).forEach((l) => {
    const p = l.prestamo, e = estadoDe(p);
    const li = document.createElement('li');
    li.className = 'prestamo ' + e; li.dataset.id = l.id; li.tabIndex = 0;
    li.innerHTML = `<span class="punto" aria-hidden="true"></span>
      <div><strong>${esc(l.titulo)}</strong>
      <span>${esc(p.socio)} · devolución ${fecha(p.fechaDevolucion)}</span></div>
      <em>${textoDias(p)}</em>`;
    lista.appendChild(li);
  });
}

async function iniciarSoloLista() { pintarResumen(await datos()); }

async function iniciar() {
  const libros = await datos();
  pintarResumen(libros);

  const ctx = crearEscenario($('#escena'), {
    camara: [0.12, 0.84, 2.3], mira: [0.08, 0.66, 0.15],
    limites: { min: 1.2, max: 3.4, azimut: 0.7, polarMin: 1.1, polarMax: 1.66 },
  });
  const { escena, cam, renderer, alCuadro, foco } = ctx;
  foco.position.set(0.4, 2.6, 2.4); foco.angle = 0.75; foco.distance = 8;

  const grupos = libros.map((l) => crearLibro(l));
  const { altoTotal } = montarEstanteria(ctx, grupos);
  $('#cargando').hidden = true;
  grupos.forEach((g) => vestirConPortada(g, renderer));

  // --- Libros en préstamo: salen a flotar delante -------------------------
  const fuera = grupos.filter((g) => g.userData.libro.prestamo)
    .sort((a, b) => a.userData.libro.prestamo.diasRestantes - b.userData.libro.prestamo.diasRestantes);
  const n = fuera.length;
  const sep = Math.min(0.28, 1.9 / Math.max(n, 1));
  const porId = new Map();

  fuera.forEach((g, i) => {
    const l = g.userData.libro, p = l.prestamo, e = estadoDe(p), color = COLORES[e];
    const hueco = g.userData.casa.pos.clone();

    // Marca luminosa en el hueco que dejó el libro.
    const marca = new THREE.Mesh(new THREE.BoxGeometry(g.userData.grosor * 0.7, g.userData.alto * 0.82, 0.006),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 }));
    marca.position.copy(hueco); marca.position.z += g.userData.fondo / 2 - 0.01;
    escena.add(marca);

    // Posición flotante, en arco frente a la estantería.
    const x = (i - (n - 1) / 2) * sep;
    const destino = new THREE.Vector3(x, altoTotal + 0.17 - Math.abs(x) * 0.06, 0.42 + Math.cos(x) * 0.05);
    g.position.copy(destino);
    g.rotation.set(0, -Math.PI / 2 + Math.atan2(-x, 2.3) * -1, 0); // tapa hacia la cámara
    g.userData.flota = { base: destino.clone(), fase: i * 0.9 };

    // Anillo de tiempo detrás del libro: la parte encendida es lo que queda de préstamo.
    const total = Math.max(1, (new Date(p.fechaDevolucion) - new Date(p.fechaPrestamo)) / 86400000);
    const fraccion = p.vencido ? 1 : Math.max(0.04, Math.min(1, p.diasRestantes / total));
    const r = Math.max(g.userData.alto, g.userData.fondo) * 0.62;
    const fondoAnillo = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 12, 96),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 16, 128, Math.PI * 2 * fraccion),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 }));
    anillo.rotation.z = Math.PI / 2; // empieza arriba
    const halo = new THREE.Group(); halo.add(fondoAnillo, anillo);
    halo.position.copy(destino); halo.position.z -= 0.035;
    escena.add(halo);

    // Hilo de luz desde el hueco hasta el libro.
    const desde = marca.position.clone();
    const medio = desde.clone().lerp(destino, 0.5); medio.z += 0.25; medio.y += 0.08;
    const curva = new THREE.CatmullRomCurve3([desde, medio, destino.clone().setZ(destino.z - 0.02)]);
    const hilo = new THREE.Mesh(new THREE.TubeGeometry(curva, 48, 0.0016, 6, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
    escena.add(hilo);

    // Etiqueta HTML debajo (texto real, nítido y con buen contraste).
    const div = document.createElement('div');
    div.className = 'etiqueta3d ' + e;
    div.innerHTML = `<strong>${esc(l.titulo)}</strong><span>${esc(p.socio)}</span><em>${textoDias(p)}</em>`;
    const etiqueta = new CSS2DObject(div);
    etiqueta.position.set(destino.x, destino.y - g.userData.alto / 2 - 0.05, destino.z);
    escena.add(etiqueta);

    porId.set(l.id, { g, anillo, marca, hilo, div, e });
  });

  // --- Animación: flotan, los vencidos laten ------------------------------
  let resaltado = null;
  alCuadro.push((dt, t) => {
    porId.forEach(({ g, anillo, marca, e }, id) => {
      const f = g.userData.flota;
      const activo = resaltado === id;
      if (!quieto) g.position.y = f.base.y + Math.sin(t * 1.1 + f.fase) * 0.008;
      const s = activo ? 1.18 : 1;
      g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, dt * 8));
      if (e === 'vencido' && !quieto) {
        const pulso = 1.2 + Math.sin(t * 4) * 1.0;
        anillo.material.emissiveIntensity = pulso; marca.material.emissiveIntensity = pulso;
      }
    });
  });

  // --- Enlace lista <-> escena --------------------------------------------
  function resaltar(id) {
    resaltado = id;
    document.querySelectorAll('#lista-prestamos li').forEach((li) => li.classList.toggle('activo', Number(li.dataset.id) === id));
    porId.forEach((o, k) => o.div.classList.toggle('activo', k === id));
  }
  $('#lista-prestamos').addEventListener('pointerover', (ev) => { const li = ev.target.closest('li[data-id]'); resaltar(li ? Number(li.dataset.id) : null); });
  $('#lista-prestamos').addEventListener('focusin', (ev) => { const li = ev.target.closest('li[data-id]'); if (li) resaltar(Number(li.dataset.id)); });
  $('#lista-prestamos').addEventListener('pointerleave', () => resaltar(null));

  const ray = new THREE.Raycaster(), puntero = new THREE.Vector2(), tip = $('#tooltip');
  const mallas = grupos.flatMap((g) => g.userData.piezas);
  renderer.domElement.addEventListener('pointermove', (ev) => {
    const rc = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(puntero, cam);
    const hit = ray.intersectObjects(mallas, false)[0];
    const g = hit ? hit.object.parent : null;
    if (!g) { tip.hidden = true; resaltar(null); return; }
    const l = g.userData.libro;
    resaltar(l.prestamo ? l.id : null);
    tip.innerHTML = `<strong>${esc(l.titulo)}</strong><span>${esc(l.autores.join(', '))}</span>`
      + (l.prestamo
        ? `<span>Lo tiene: ${esc(l.prestamo.socio)}</span><em class="${estadoDe(l.prestamo)}">${textoDias(l.prestamo)} · ${fecha(l.prestamo.fechaDevolucion)}</em>`
        : '<em class="ok">En la estantería</em>');
    tip.style.left = ev.clientX + 16 + 'px'; tip.style.top = ev.clientY + 12 + 'px'; tip.hidden = false;
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
