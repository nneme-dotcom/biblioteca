// Vista cinematográfica del admin: un escritorio con tres pilas de libros prestados.
//   Vencidos · Vencen en 3 días o menos · En plazo
// Pasá el ratón por un libro: levita y se separa de la pila. Hacé clic: aparece su etiqueta
// (quién lo tiene, email y teléfono) y el libro empieza a girar. Clic fuera o Esc para dejarlo.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  crearEscenario, crearLibro, vestirConPortada, texturaMadera, prefiereQuieto, webglDisponible,
} from './biblioteca3d.js';

const $ = (s) => document.querySelector(s);
const quieto = prefiereQuieto();
const PILAS = [
  { clave: 'vencido', nombre: 'Vencidos', color: '#a1252b', x: -0.36 },
  { clave: 'pronto', nombre: 'Vencen pronto', color: '#b87a0a', x: 0 },
  { clave: 'ok', nombre: 'En plazo', color: '#1f7a55', x: 0.36 },
];
const MESA = 0.76; // altura del tablero
const suaveS = (t) => t * t * (3 - 2 * t);
const Z = 0.14;    // el escritorio un poco separado de la pared

const estadoDe = (p) => (p.vencido ? 'vencido' : p.diasRestantes <= 3 ? 'pronto' : 'ok');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fecha(s) { const [a, m, d] = s.split('-'); return `${d} ${MESES[Number(m) - 1]} ${a}`; }
function textoDias(p) {
  const n = Math.abs(p.diasRestantes);
  if (p.vencido) return `Vencido hace ${n} ${n === 1 ? 'día' : 'días'}`;
  if (p.diasRestantes === 0) return 'Vence hoy';
  return `Quedan ${n} ${n === 1 ? 'día' : 'días'}`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

if (!webglDisponible()) {
  $('#cargando').innerHTML = 'Tu navegador no puede mostrar el panel 3D. <a href="/vista/tradicional">Ir a la vista tradicional</a>';
} else {
  iniciar().catch((e) => { console.error(e); $('#cargando').innerHTML = 'No se pudo cargar el panel. <a href="/vista/tradicional">Ir a la vista tradicional</a>'; });
}

async function iniciar() {
  const libros = await (await fetch('/admin/panel/datos', { headers: { Accept: 'application/json' } })).json();
  const prestados = libros.filter((l) => l.prestamo);

  const cuenta = (e) => prestados.filter((l) => estadoDe(l.prestamo) === e).length;
  $('#k-vencidos').textContent = cuenta('vencido');
  $('#k-pronto').textContent = cuenta('pronto');
  $('#k-ok').textContent = cuenta('ok');
  $('#k-estante').textContent = libros.length - prestados.length;

  const ctx = crearEscenario($('#escena'), {
    camara: [0, 1.26, 1.16 + Z], mira: [0, MESA + 0.08, 0.04 + Z],
    limites: { min: 0.6, max: 2.4, azimut: 0.8, polarMin: 0.55, polarMax: 1.35 },
  });
  const { escena, cam, controles, renderer, alCuadro, foco } = ctx;
  foco.position.set(0.3, 2.4, 1.1); foco.target.position.set(0, MESA, 0); foco.angle = 0.6; foco.penumbra = 0.8;
  // lámpara de escritorio: un círculo de luz cálida sobre las pilas
  const lampara = new THREE.SpotLight(0xffd29a, 6, 2.5, 0.75, 0.7, 1.4);
  lampara.position.set(-0.7, MESA + 0.75, -0.15 + Z); lampara.target.position.set(0, MESA, 0.05 + Z);
  lampara.castShadow = true; lampara.shadow.mapSize.set(1024, 1024); lampara.shadow.bias = -0.0003;
  escena.add(lampara, lampara.target);

  // Escritorio de nogal con un cartapacio de cuero verde.
  const tablero = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 1.05), new THREE.MeshPhysicalMaterial({
    map: texturaMadera(renderer, { base: '#4a2c18', claro: '#5e3a20', oscuro: '#2a170b', repetir: [2, 1] }), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25,
  }));
  tablero.position.set(0, MESA - 0.025, Z); tablero.receiveShadow = true; tablero.castShadow = true; escena.add(tablero);
  const cuero = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.004, 0.62), new THREE.MeshStandardMaterial({ color: 0x1f3a2c, roughness: 0.8 }));
  cuero.position.set(0, MESA + 0.002, 0.04 + Z); cuero.receiveShadow = true; escena.add(cuero);
  [-1, 1].forEach((s) => { // patas
    const pata = new THREE.Mesh(new THREE.BoxGeometry(0.08, MESA - 0.05, 0.9), new THREE.MeshStandardMaterial({ color: 0x2e1a0d, roughness: 0.6 }));
    pata.position.set(s * 0.95, (MESA - 0.05) / 2, Z); escena.add(pata);
  });

  // --- Pilas -------------------------------------------------------------------
  const libros3d = [];
  PILAS.forEach((pila) => {
    const lista = prestados.filter((l) => estadoDe(l.prestamo) === pila.clave)
      .sort((a, b) => b.prestamo.diasRestantes - a.prestamo.diasRestantes); // el más urgente, arriba
    let y = MESA + 0.004;
    lista.forEach((l, i) => {
      const g = crearLibro(l);
      const { grosor, alto } = g.userData;
      // tumbado: la tapa mira arriba y el lomo hacia nosotros
      const r = Math.sin(l.id * 12.9898) * 0.5;
      g.rotation.set(0, r * 0.22, Math.PI / 2);
      g.position.set(pila.x + r * 0.02, y + grosor / 2, 0.06 + Z + r * 0.01);
      g.userData.base = { pos: g.position.clone(), rot: g.rotation.clone() };
      g.userData.pila = pila; g.userData.flota = 0; g.userData.giro = 0;
      escena.add(g); libros3d.push(g);
      vestirConPortada(g, renderer);
      y += grosor + 0.0015;
    });
    // etiqueta de papel con el nombre de la pila
    const div = document.createElement('div');
    div.className = 'etiqueta-pila'; div.style.setProperty('--c', pila.color);
    div.innerHTML = `${pila.nombre}<b>${lista.length}</b>`;
    const et = new CSS2DObject(div); et.position.set(pila.x, MESA + 0.005, 0.25 + Z); escena.add(et);
    if (!lista.length) {
      const vacio = document.createElement('div'); vacio.className = 'pila-vacia'; vacio.textContent = 'Ninguno';
      const v = new CSS2DObject(vacio); v.position.set(pila.x, MESA + 0.03, 0.06 + Z); escena.add(v);
    }
  });
  $('#cargando').hidden = true;

  // --- Etiqueta del libro elegido (quién lo tiene) -----------------------------
  const ficha = document.createElement('div'); ficha.className = 'etiqueta-libro'; ficha.hidden = true;
  const fichaObj = new CSS2DObject(ficha); escena.add(fichaObj);

  // --- Interacción --------------------------------------------------------------
  const ray = new THREE.Raycaster(), puntero = new THREE.Vector2(), tip = $('#tooltip');
  const mallas = libros3d.flatMap((g) => g.userData.piezas);
  let encima = null, elegido = null;
  const libroDe = (o) => { while (o && !o.userData.libro) o = o.parent; return o; };
  function libroBajo(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(puntero, cam);
    const h = ray.intersectObjects(mallas, false)[0];
    return h ? libroDe(h.object) : null;
  }
  renderer.domElement.addEventListener('pointermove', (ev) => {
    const g = libroBajo(ev); encima = g;
    renderer.domElement.style.cursor = g ? 'pointer' : 'grab';
    if (g && g !== elegido) {
      const l = g.userData.libro;
      tip.innerHTML = `<strong>${esc(l.titulo)}</strong><em class="${estadoDe(l.prestamo)}">${textoDias(l.prestamo)}</em><span>Clic para ver quién lo tiene</span>`;
      tip.style.left = Math.min(ev.clientX + 16, window.innerWidth - 280) + 'px'; tip.style.top = ev.clientY + 12 + 'px'; tip.hidden = false;
    } else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { encima = null; tip.hidden = true; });
  let abajo = null;
  renderer.domElement.addEventListener('pointerdown', (ev) => { abajo = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (!abajo || Math.hypot(ev.clientX - abajo[0], ev.clientY - abajo[1]) > 5) return;
    const g = libroBajo(ev);
    if (g && g !== elegido) elegir(g); else if (!g || g === elegido) soltar();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') soltar(); });

  function elegir(g) {
    elegido = g; tip.hidden = true;
    const l = g.userData.libro, p = l.prestamo, e = estadoDe(p);
    ficha.className = 'etiqueta-libro ' + e;
    ficha.innerHTML = `
      <span class="estado-etiqueta">${textoDias(p)}</span>
      <h3>${esc(l.titulo)}</h3>
      <p class="autor">${esc(l.autores.join(', '))}</p>
      <dl>
        <dt>Lo tiene</dt><dd><strong>${esc(p.socio)}</strong></dd>
        <dt>Email</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd>
        <dt>Teléfono</dt><dd>${p.telefono ? `<a href="tel:${esc(p.telefono)}">${esc(p.telefono)}</a>` : '—'}</dd>
        <dt>Prestado</dt><dd>${fecha(p.fechaPrestamo)}</dd>
        <dt>Devolver antes del</dt><dd>${fecha(p.fechaDevolucion)}</dd>
      </dl>`;
    ficha.hidden = false;
  }
  function soltar() { elegido = null; ficha.hidden = true; }

  // --- Animación: levitar, separarse y girar (todo con transiciones suaves) -------
  const q = new THREE.Quaternion(), qGiro = new THREE.Quaternion(), eY = new THREE.Vector3(0, 1, 0);
  alCuadro.push((dt, t) => {
    libros3d.forEach((g) => {
      const b = g.userData.base;
      const objetivo = g === elegido ? 1 : g === encima ? 0.6 : 0;
      const vel = quieto ? 1 : 1 - Math.exp(-dt * 6);
      g.userData.flota += (objetivo - g.userData.flota) * vel;
      const f = g.userData.flota;
      const lado = Math.sign(b.pos.x - g.userData.pila.x) || 1;
      // primero se desliza hacia adelante, fuera de la pila (así no atraviesa los de arriba),
      // y después levita
      const sal = suaveS(Math.min(1, f * 1.7));
      const sube = suaveS(Math.max(0, (f - 0.25) / 0.75));
      g.position.set(
        b.pos.x + sal * 0.03 * lado,
        b.pos.y + sube * 0.13 + (f > 0.02 && !quieto ? Math.sin(t * 2.2 + b.pos.y * 40) * 0.005 * f : 0),
        b.pos.z + sal * 0.2);
      // al elegirlo: se endereza mostrando la portada y gira sobre sí mismo
      if (g === elegido && !quieto) g.userData.giro += dt * 1.1;
      else g.userData.giro *= Math.max(0, 1 - dt * 4);
      q.setFromEuler(b.rot);
      const enderezar = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5 * suaveS(Math.max(0, (f - 0.3) / 0.7)), 0, 0));
      qGiro.setFromAxisAngle(eY, g.userData.giro);
      g.quaternion.copy(qGiro).multiply(enderezar).multiply(q);
    });
    if (elegido) fichaObj.position.copy(elegido.position).add(new THREE.Vector3(0.2, 0.05, 0));
  });
}
