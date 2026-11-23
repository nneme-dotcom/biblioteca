// Catálogo del socio como estantería 3D.
// Un estante por género (con su placa). Pasá el ratón por un lomo y el libro asoma; hacé clic y viene
// hacia vos. Al lado aparece su ficha de préstamo de cartulina (o el formulario simple, si lo preferís).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  crearEscenario, crearLibro, montarEstanteria, vestirConPortada, urlPortada,
  suave, prefiereQuieto, webglDisponible,
} from './biblioteca3d.js';

const $ = (s) => document.querySelector(s);
const contenedor = $('#escena');
const sala = contenedor.parentElement;
const tip = $('#tooltip');
const csrf = { token: $('meta[name=_csrf]').content, header: $('meta[name=_csrf_header]').content };
const socio = document.body.dataset.socio || '';
const quieto = prefiereQuieto();
const GENEROS = ['Novela', 'Cuento', 'Clásicos', 'Género'];
const CODIGO = { 'Novela': 'NOV', 'Cuento': 'CUE', 'Clásicos': 'CLA', 'Género': 'GEN' };

// Ficha realista o formulario simple: se recuerda la elección.
const guardado = { leer: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                   escribir: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } } };
let modo = guardado.leer('modoFicha') || 'real';
document.querySelectorAll('input[name=modo-ficha]').forEach((r) => {
  r.checked = r.value === modo;
  r.addEventListener('change', () => { modo = r.value; guardado.escribir('modoFicha', modo); if (window.__refrescarFicha) window.__refrescarFicha(); });
});

if (!webglDisponible()) {
  $('#cargando').innerHTML = 'Tu navegador no puede mostrar la estantería 3D. <a href="/libros?vista=tabla">Ver el catálogo como lista</a>';
} else {
  iniciar().catch((e) => {
    console.error(e);
    $('#cargando').innerHTML = 'No se pudo cargar la estantería. <a href="/libros?vista=tabla">Ver el catálogo como lista</a>';
  });
}

async function iniciar() {
  const libros = await (await fetch('/libros/datos', { headers: { Accept: 'application/json' } })).json();
  const ctx = crearEscenario(contenedor, {
    camara: [0.08, 0.8, 2.5], mira: [0, 0.72, 0], limites: { min: 0.45, max: 3.0, polarMin: 1.05, polarMax: 1.8 },
  });
  const { escena, cam, controles, renderer, alCuadro, foco } = ctx;
  foco.position.set(0.5, 2.7, 2.1); foco.target.position.set(0, 0.7, 0); foco.angle = 0.55;

  const grupos3d = libros.map((l) => crearLibro(l));
  const porGenero = GENEROS.map((nombre) => ({ nombre, libros: grupos3d.filter((g) => (g.userData.libro.genero || 'Novela') === nombre) }))
    .filter((gr) => gr.libros.length);
  const { filas, zFrente, anchoTotal } = montarEstanteria(ctx, grupos3d, { grupos: porGenero });
  grupos3d.forEach((g) => decorar(g));
  $('#cargando').hidden = true;
  $('#contador').textContent = `${libros.length} libros · ${libros.filter((l) => l.disponible).length} disponibles`;

  // Placas de latón con el nombre del género (HTML: nítidas y clicables).
  const vistos = new Set();
  filas.forEach((f) => {
    if (!f.nombre || vistos.has(f.nombre)) return; vistos.add(f.nombre);
    const div = document.createElement('button');
    div.type = 'button'; div.className = 'placa';
    div.innerHTML = `${f.nombre}<small>${porGenero.find((p) => p.nombre === f.nombre).libros.length}</small>`;
    div.addEventListener('click', () => enfocar(f.nombre));
    const placa = new CSS2DObject(div);
    placa.position.set(-anchoTotal / 2 + 0.12, f.yBase - 0.014, zFrente + 0.022);
    escena.add(placa);
  });

  // Botones para saltar de un género a otro.
  const nav = $('#nav-generos');
  ['Todos', ...porGenero.map((p) => p.nombre)].forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = n; b.dataset.genero = n;
    b.addEventListener('click', () => enfocar(n));
    nav.appendChild(b);
  });

  // Portadas de a poco, sin bloquear la escena (primero las del estante de arriba).
  (async () => { for (const g of grupos3d) { vestirConPortada(g, renderer); await new Promise((r) => setTimeout(r, 60)); } })();

  // --- Cámara: vista general o un estante de cerca --------------------------
  let viaje = null;
  const vistaGeneral = { pos: cam.position.clone(), mira: controles.target.clone() };
  function enfocar(nombre) {
    if (elegido) soltar(true);
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('activo', b.dataset.genero === nombre));
    let destino;
    if (nombre === 'Todos') destino = vistaGeneral;
    else {
      const f = filas.find((x) => x.nombre === nombre);
      destino = { pos: new THREE.Vector3(0.05, f.yCentro + 0.04, 1.22), mira: new THREE.Vector3(0, f.yCentro, 0) };
    }
    viaje = { t0: performance.now(), dur: quieto ? 1 : 1100, dePos: cam.position.clone(), deMira: controles.target.clone(), aPos: destino.pos.clone(), aMira: destino.mira.clone() };
  }
  nav.querySelector('button').classList.add('activo');

  // --- Interacción con los libros -------------------------------------------
  const ray = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const mallas = grupos3d.flatMap((g) => g.userData.piezas);
  let encima = null, elegido = null, anim = null;

  function libroBajo(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(puntero, cam);
    const hit = ray.intersectObjects(mallas, false)[0];
    return hit ? hit.object.parent : null;
  }

  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (elegido) return;
    const g = libroBajo(ev);
    encima = g;
    renderer.domElement.style.cursor = g ? 'pointer' : 'grab';
    if (g) {
      const l = g.userData.libro;
      tip.innerHTML = `<strong>${esc(l.titulo)}</strong><span>${esc(l.autores.join(', '))}${l.anio ? ' · ' + l.anio : ''}</span>`
        + `<em class="${l.disponible ? 'ok' : 'no'}">${l.disponible ? 'Disponible' : 'Prestado'}</em>`;
      tip.style.left = ev.clientX + 16 + 'px'; tip.style.top = ev.clientY + 12 + 'px';
      tip.hidden = false;
    } else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { encima = null; tip.hidden = true; });

  let abajo = null;
  renderer.domElement.addEventListener('pointerdown', (ev) => { abajo = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (!abajo || Math.hypot(ev.clientX - abajo[0], ev.clientY - abajo[1]) > 5) return; // fue un arrastre
    const g = libroBajo(ev);
    if (g && g !== elegido) elegir(g); else if (!g && elegido) soltar();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && elegido) soltar(); });
  document.querySelectorAll('[data-cerrar-ficha]').forEach((b) => b.addEventListener('click', () => soltar()));

  alCuadro.push((dt, t) => {
    if (viaje) {
      const k = suave(Math.min(1, (performance.now() - viaje.t0) / viaje.dur));
      cam.position.lerpVectors(viaje.dePos, viaje.aPos, k);
      controles.target.lerpVectors(viaje.deMira, viaje.aMira, k);
      if (k >= 1) viaje = null;
    }
    grupos3d.forEach((g) => {
      if (g === elegido || (anim && anim.g === g)) return;
      const casa = g.userData.casa;
      const objetivo = casa.pos.z + (g === encima ? 0.045 : 0) - (g.userData.libro.disponible ? 0 : 0.03);
      g.position.z += (objetivo - g.position.z) * Math.min(1, dt * (quieto ? 60 : 10));
    });
    if (anim) {
      anim.t = quieto ? 1 : Math.min(1, (performance.now() - anim.inicio) / (anim.dur * 1000));
      const k = suave(anim.t);
      anim.g.position.lerpVectors(anim.desde, anim.hasta, k);
      anim.g.position.z += Math.sin(k * Math.PI) * 0.12 * (anim.ida ? 1 : 0.5);
      anim.g.quaternion.slerpQuaternions(anim.qDesde, anim.qHasta, k);
      if (anim.t >= 1) { const fin = anim.fin; anim = null; fin && fin(); }
    } else if (elegido && !quieto) {
      const base = elegido.userData.enMano;
      elegido.position.y = base.pos.y + Math.sin(t * 1.4) * 0.004;
      elegido.quaternion.copy(base.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(t * 0.7) * 0.12, Math.sin(t * 0.9) * 0.02)));
    }
  });

  function poseEnMano() {
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const derecha = new THREE.Vector3().crossVectors(dir, cam.up).normalize();
    const dist = 0.62;
    const anchoFicha = window.innerWidth > 760 ? dist * 0.2 : 0;
    const pos = cam.position.clone().addScaledVector(dir, dist).addScaledVector(derecha, -anchoFicha);
    pos.y -= 0.01;
    const haciaCam = cam.position.clone().sub(pos).normalize();
    const X = haciaCam, Y = new THREE.Vector3(0, 1, 0);
    Y.sub(X.clone().multiplyScalar(Y.dot(X))).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    return { pos, q };
  }

  function elegir(g) {
    if (elegido) soltar(true);
    elegido = g; tip.hidden = true; controles.enabled = false;
    renderer.domElement.style.cursor = 'default';
    const mano = poseEnMano(); g.userData.enMano = mano;
    anim = { g, t: 0, inicio: performance.now(), dur: 0.9, ida: true, desde: g.position.clone(), hasta: mano.pos, qDesde: g.quaternion.clone(), qHasta: mano.q };
    mostrarFicha(g);
    sala.classList.add('con-ficha');
  }

  function soltar(inmediato) {
    const g = elegido; if (!g) return;
    elegido = null; controles.enabled = true;
    ocultarFichas();
    sala.classList.remove('con-ficha');
    const casa = g.userData.casa;
    const qCasa = new THREE.Quaternion().setFromEuler(casa.rot);
    if (inmediato === true) { g.position.copy(casa.pos); g.quaternion.copy(qCasa); return; }
    anim = { g, t: 0, inicio: performance.now(), dur: 0.75, ida: false, desde: g.position.clone(), hasta: casa.pos.clone(), qDesde: g.quaternion.clone(), qHasta: qCasa };
  }

  // --- Fichas (HTML, siempre legibles) --------------------------------------
  function ocultarFichas() { $('#ficha').hidden = true; $('#ficha-real').hidden = true; $('#ficha-real').classList.remove('sale'); }
  window.__refrescarFicha = () => { if (elegido) mostrarFicha(elegido); };

  function mostrarFicha(g) {
    ocultarFichas();
    if (modo === 'simple') fichaSimple(g); else fichaReal(g);
  }

  function fichaSimple(g) {
    const l = g.userData.libro;
    const img = $('#ficha-portada');
    if (g.userData.portadaId) { img.src = urlPortada(g.userData.portadaId, 'L'); img.hidden = false; } else img.hidden = true;
    img.alt = 'Portada de ' + l.titulo;
    $('#ficha-titulo').textContent = l.titulo;
    $('#ficha-autores').textContent = l.autores.join(', ');
    $('#ficha-anio').textContent = l.anio || '—';
    $('#ficha-isbn').textContent = l.isbn || '—';
    $('#ficha-genero').textContent = l.genero || '—';
    const estado = $('#ficha-estado');
    if (l.disponible) { estado.textContent = 'Disponible'; estado.className = 'estado ok'; }
    else { estado.className = 'estado no'; estado.textContent = l.prestamo ? `Prestado · vuelve el ${fechaCorta(l.prestamo.fechaDevolucion)}` : 'Prestado'; }
    const pedir = $('#form-pedir');
    pedir.action = `/user/prestamos/solicitar/${l.id}`;
    pedir.hidden = !l.disponible;
    const fav = $('#btn-favorito');
    fav.textContent = l.favorito ? '★ Quitar de favoritos' : '☆ Añadir a favoritos';
    fav.setAttribute('aria-pressed', l.favorito ? 'true' : 'false');
    fav.onclick = () => alternarFavorito(g);
    $('#ficha').hidden = false;
    $('#ficha .cerrar').focus({ preventScroll: true });
  }

  // Ficha de préstamo de cartulina: sale del bolsillo pegado en la contratapa.
  function fichaReal(g) {
    const l = g.userData.libro;
    const f = $('#ficha-real');
    const apellido = (l.autores[0] || '').split(' ').slice(-1)[0] || '';
    $('#fr-signatura').textContent = `${CODIGO[l.genero] || 'NOV'} · ${quitarTildes(apellido).slice(0, 3).toUpperCase()} · ${l.anio || 's/f'}`;
    $('#fr-registro').textContent = 'Nº ' + String(l.id).padStart(5, '0');
    $('#fr-autor').textContent = l.autores.join(' / ');
    $('#fr-titulo').textContent = l.titulo;
    $('#fr-genero').textContent = l.genero || '—';
    $('#fr-isbn').textContent = l.isbn || '—';

    // Renglones: el préstamo activo (sellado) y renglones vacíos para los siguientes.
    const filasHtml = [];
    if (l.prestamo) {
      filasHtml.push(`<tr><td class="sello-fecha">${fechaLarga(l.prestamo.fechaPrestamo)}</td><td class="sello-fecha ${l.prestamo.vencido ? 'vencida' : ''}">${fechaLarga(l.prestamo.fechaDevolucion)}</td><td class="firma">en préstamo</td></tr>`);
    }
    while (filasHtml.length < 6) filasHtml.push('<tr><td>&nbsp;</td><td></td><td></td></tr>');
    $('#fr-renglones').innerHTML = filasHtml.join('');

    const estado = $('#fr-estado');
    estado.textContent = l.disponible ? 'DISPONIBLE' : (l.prestamo && l.prestamo.vencido ? 'PRESTADO · VENCIDO' : 'PRESTADO');
    estado.className = 'fr-estado ' + (l.disponible ? 'ok' : 'no');

    const sellar = $('#fr-sellar');
    sellar.hidden = !l.disponible;
    sellar.onclick = () => sellarPrestamo(l);
    const clip = $('#fr-favorito');
    clip.textContent = l.favorito ? '★ En mis favoritos (quitar)' : '☆ Guardar en favoritos';
    clip.setAttribute('aria-pressed', l.favorito ? 'true' : 'false');
    clip.onclick = () => alternarFavorito(g);
    $('#fr-clip').hidden = !l.favorito;

    const img = $('#fr-portada');
    if (g.userData.portadaId) { img.src = urlPortada(g.userData.portadaId, 'M'); img.hidden = false; } else img.hidden = true;

    f.hidden = false;
    // Reiniciar la animación de salida del bolsillo.
    void f.offsetWidth; f.classList.add('sale');
    setTimeout(() => $('#fr-cerrar').focus({ preventScroll: true }), quieto ? 0 : 700);
  }

  // Sello de goma: baja sobre el primer renglón libre, deja la tinta y después se envía el préstamo.
  function sellarPrestamo(l) {
    const hoy = new Date(), vuelta = new Date(Date.now() + 14 * 86400000);
    const fila = [...document.querySelectorAll('#fr-renglones tr')].find((tr) => !tr.dataset.usada && !tr.querySelector('.sello-fecha'));
    if (fila) {
      fila.dataset.usada = '1';
      fila.innerHTML = `<td class="sello-fecha nuevo">${fechaLarga(iso(hoy))}</td><td class="sello-fecha nuevo">${fechaLarga(iso(vuelta))}</td><td class="firma nuevo">${esc(socio)}</td>`;
    }
    const sello = $('#fr-sello');
    sello.querySelector('b').textContent = 'DEVOLVER ANTES DEL ' + fechaLarga(iso(vuelta)).toUpperCase();
    sello.hidden = false; sello.classList.remove('golpe'); void sello.offsetWidth; sello.classList.add('golpe');
    $('#fr-sellar').disabled = true;
    const form = $('#form-pedir');
    form.action = `/user/prestamos/solicitar/${l.id}`;
    setTimeout(() => form.submit(), quieto ? 300 : 1500);
  }

  async function alternarFavorito(g) {
    const l = g.userData.libro;
    const r = await fetch(`/user/favoritos/${l.id}`, { method: 'POST', headers: { [csrf.header]: csrf.token } });
    if (!r.ok) return;
    l.favorito = !l.favorito;
    decorar(g);
    mostrarFicha(g);
  }
}

// Cinta de favorito (seda roja que cuelga del lomo) y etiqueta de "prestado".
function decorar(g) {
  const { libro, alto, grosor, fondo } = g.userData;
  ['cinta', 'etiqueta'].forEach((n) => { const o = g.getObjectByName(n); if (o) g.remove(o); });
  if (libro.favorito) {
    const cinta = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(0.007, grosor * 0.4), 0.075),
      new THREE.MeshPhysicalMaterial({ color: 0x9e1b22, roughness: 0.35, sheen: 1, sheenColor: 0xff6a6a, side: THREE.DoubleSide }));
    cinta.name = 'cinta';
    cinta.position.set(0, alto / 2 - 0.03, fondo / 2 + 0.0035);
    cinta.rotation.z = 0.06;
    cinta.castShadow = true;
    g.add(cinta);
  }
  if (!libro.disponible) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#f3ecd9'; x.fillRect(0, 0, 128, 256);
    x.fillStyle = '#a3262c'; x.fillRect(0, 0, 128, 52);
    x.fillStyle = '#fff'; x.font = '700 26px Arial'; x.textAlign = 'center'; x.fillText('PRESTADO', 64, 36);
    x.fillStyle = '#2a2018'; x.font = '600 22px Arial';
    if (libro.prestamo) { x.fillText('vuelve el', 64, 110); x.font = '700 30px Arial'; x.fillText(fechaCorta(libro.prestamo.fechaDevolucion), 64, 150); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.056), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
    etiqueta.name = 'etiqueta';
    etiqueta.position.set(0, alto / 2 - 0.045, fondo / 2 + 0.004);
    etiqueta.rotation.z = -0.08;
    etiqueta.castShadow = true;
    g.add(etiqueta);
  }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(s) { const [a, m, d] = s.split('-'); return `${d}/${m}`; }
function fechaLarga(s) { const [a, m, d] = s.split('-'); return `${d} ${MESES[Number(m) - 1]} ${a}`; }
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function quitarTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
