// Vista cinematográfica del socio: solo la estantería, a pantalla completa.
// - Placas de latón grabadas en cada estante: clic para acercarte a ese género.
// - Insignia dorada en el lomo: clic para añadir o quitar de favoritos.
// - Los libros prestados están un poco hundidos y apagados.
// - Clic en un libro: sale del estante, la cámara se centra en él y se abre hasta la contratapa,
//   donde está pegado el bolsillo con su ficha de préstamo. En la ficha se sella el préstamo.
// - Filtro discreto (Todos · Disponibles · Mis préstamos · Favoritos): los que no coinciden se
//   apagan y se hunden un poco en el estante.
// - Barra de teclado: un <select> con todos los libros y botones para abrir, sellar, marcar
//   favorito y cerrar (o Esc). Lo que pasa se anuncia en una región aria-live.
import * as THREE from 'three';
import {
  crearEscenario, crearLibro, montarEstanteria, vestirConPortada, abrirLibro, crearPlaca,
  suave, prefiereQuieto, webglDisponible, avisoSin3D, ajustarSombra, lienzoHD, texturaCanvas,
} from './biblioteca3d.js';

const $ = (s) => document.querySelector(s);
const contenedor = $('#escena');
const tip = $('#tooltip');
const ayuda = $('#ayuda');
const csrf = { token: $('meta[name=_csrf]').content, header: $('meta[name=_csrf_header]').content };
const socio = document.body.dataset.socio || '';
const quieto = prefiereQuieto;   // se consulta en vivo
const damp = THREE.MathUtils.damp;
const GENEROS = ['Novela', 'Cuento', 'Clásicos', 'Género'];
const CODIGO = { 'Novela': 'NOV', 'Cuento': 'CUE', 'Clásicos': 'CLA', 'Género': 'GEN' };
const AYUDA_GENERAL = 'Clic en una placa para ir a un género · clic en un libro para abrirlo · ★ en el lomo: favoritos';
const AYUDA_LIBRO = 'Clic en la ficha para sellar el préstamo o marcar favorito · clic fuera del libro (o Esc) para devolverlo';
const FILTROS = {
  todos: { nombre: 'todos los libros', ok: () => true },
  disponibles: { nombre: 'los disponibles', ok: (l) => l.disponible },
  mios: { nombre: 'tus préstamos', ok: (l) => !!(l.prestamo && l.prestamo.propio) },
  favoritos: { nombre: 'tus favoritos', ok: (l) => !!l.favorito },
};

if (!webglDisponible()) {
  avisoSin3D($('#cargando'), 'Tu navegador no puede mostrar la vista cinematográfica (necesita WebGL2).');
  $('#controles').hidden = true;
} else {
  iniciar().catch((e) => {
    console.error(e);
    avisoSin3D($('#cargando'), 'No se pudo cargar la estantería.');
    $('#controles').hidden = true;
  });
}

function anunciar(texto) {
  const a = $('#anuncio');
  a.textContent = '';                     // vaciar y volver a escribir: así se lee aunque se repita
  requestAnimationFrame(() => { a.textContent = texto; });
}

async function iniciar() {
  const libros = await (await fetch('/libros/datos', { headers: { Accept: 'application/json' } })).json();
  const ctx = crearEscenario(contenedor, {
    camara: [0.08, 0.8, 2.5], mira: [0, 0.72, 0], limites: { min: 0.45, max: 3.0, polarMin: 1.05, polarMax: 1.8 },
  });
  const { escena, cam, controles, renderer, alCuadro, foco } = ctx;
  foco.position.set(0.5, 2.7, 2.1); foco.target.position.set(0, 0.7, 0); foco.angle = 0.55;
  // Luz de lectura: se enciende cuando abrís un libro.
  const lectura = new THREE.PointLight(0xffe2b8, 0, 1.6, 2);
  escena.add(lectura);

  const grupos3d = libros.map((l) => crearLibro(l));
  const porGenero = GENEROS.map((nombre) => ({ nombre, libros: grupos3d.filter((g) => (g.userData.libro.genero || 'Novela') === nombre) }))
    .filter((gr) => gr.libros.length);
  const { filas, fondoMueble, mueble } = montarEstanteria(ctx, grupos3d, { grupos: porGenero });
  ajustarSombra(foco, mueble);   // la sombra del foco cubre justo el mueble
  $('#cargando').hidden = true;
  ayuda.textContent = AYUDA_GENERAL;

  // Placas de latón centradas en el canto de cada estante.
  const placas = [];
  const vistos = new Set();
  filas.forEach((f) => {
    if (!f.nombre || vistos.has(f.nombre)) return; vistos.add(f.nombre);
    const placa = crearPlaca(f.nombre, 0.24, 0.036);
    placa.position.set(0, f.yBase - 0.013, fondoMueble / 2 + 0.004);
    placa.userData.fila = f;
    escena.add(placa); placas.push(placa);
  });

  // Insignia de favorito en cada lomo, estado de préstamo y portadas.
  // Las portadas se piden todas juntas: la cola de biblioteca3d.js baja de a 6 como mucho.
  const insignias = grupos3d.map((g) => crearInsignia(g));
  grupos3d.forEach((g) => { g.userData.filtroK = 1; estadoEnEstante(g); });
  grupos3d.forEach((g) => vestirConPortada(g, renderer));

  // --- Cámara ---------------------------------------------------------------
  let viaje = null;
  const vistaGeneral = { pos: cam.position.clone(), mira: controles.target.clone() };
  function volarA(pos, mira, dur = 1100) {
    viaje = { t0: performance.now(), dur: quieto() ? 1 : dur, dePos: cam.position.clone(), deMira: controles.target.clone(), aPos: pos.clone(), aMira: mira.clone() };
  }
  let generoActual = null;
  function enfocar(f) {
    if (f && generoActual === f.nombre) f = null; // segundo clic en la misma placa: vista general
    generoActual = f ? f.nombre : null;
    if (!f) volarA(vistaGeneral.pos, vistaGeneral.mira);
    else volarA(new THREE.Vector3(0.05, f.yCentro + 0.04, 1.22), new THREE.Vector3(0, f.yCentro, 0));
  }

  // --- Interacción ----------------------------------------------------------
  const ray = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const mallas = grupos3d.flatMap((g) => g.userData.piezas);
  let encima = null, abierto = null, ocupado = false, zonaResaltada = null;

  function apuntar(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(puntero, cam);
    return ray.intersectObjects([...insignias, ...placas, ...mallas], false)[0] || null;
  }
  const libroDe = (obj) => { let o = obj; while (o && !o.userData.libro) o = o.parent; return o; };
  const selloDe = (g) => (g.userData.libro.prestamo && g.userData.libro.prestamo.propio ? 1 : 0);

  // Resalta (o apaga) la zona activa de la ficha; solo redibuja si cambió.
  function resaltarZona(zona) {
    if (!abierto || zona === zonaResaltada || ocupado) return;
    zonaResaltada = zona;
    dibujarContratapa(abierto, { sello: selloDe(abierto), resaltar: zona });
  }

  renderer.domElement.addEventListener('pointermove', (ev) => {
    const hit = apuntar(ev);
    if (abierto) {
      // Raycast sobre la contratapa: con la coordenada UV sabemos si estás sobre el sello o la estrella.
      const zona = hit && hit.object === abierto.userData.partes.trasera ? zonaEn(abierto, hit.uv) : null;
      renderer.domElement.style.cursor = zona ? 'pointer' : 'default';
      resaltarZona(zona);
      tip.hidden = true; return;
    }
    encima = null;
    if (!hit) { renderer.domElement.style.cursor = 'grab'; tip.hidden = true; return; }
    renderer.domElement.style.cursor = 'pointer';
    let html;
    if (hit.object.userData.placa) html = `<strong>${esc(hit.object.userData.placa)}</strong><span>${generoActual === hit.object.userData.placa ? 'Clic para ver toda la estantería' : 'Clic para acercarte a este estante'}</span>`;
    else if (hit.object.userData.insignia) {
      const l = libroDe(hit.object).userData.libro;
      encima = libroDe(hit.object);
      html = `<strong>${l.favorito ? '★ En tus favoritos' : '☆ Añadir a favoritos'}</strong><span>${esc(l.titulo)}</span>`;
    } else {
      const g = libroDe(hit.object); encima = g;
      const l = g.userData.libro;
      let estado = '<em class="ok">Disponible</em>';
      if (!l.disponible) estado = l.prestamo && l.prestamo.propio
        ? `<em class="mio">Lo tenés vos · devolvelo antes del ${fechaCorta(l.prestamo.fechaDevolucion)}</em>`
        : `<em class="no">Prestado${l.prestamo ? ' · vuelve el ' + fechaCorta(l.prestamo.fechaDevolucion) : ''}</em>`;
      html = `<strong>${esc(l.titulo)}</strong><span>${esc(l.autores.join(', '))}${l.anio ? ' · ' + l.anio : ''}</span>${estado}`;
    }
    tip.innerHTML = html;
    tip.style.left = Math.min(ev.clientX + 16, window.innerWidth - 300) + 'px'; tip.style.top = ev.clientY + 12 + 'px';
    tip.hidden = false;
  });
  renderer.domElement.addEventListener('pointerleave', () => { encima = null; tip.hidden = true; resaltarZona(null); });

  let abajo = null;
  renderer.domElement.addEventListener('pointerdown', (ev) => { abajo = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (!abajo || Math.hypot(ev.clientX - abajo[0], ev.clientY - abajo[1]) > 5 || ocupado) return; // fue un arrastre
    const hit = apuntar(ev);
    if (abierto) {
      if (hit && hit.object === abierto.userData.partes.trasera) {
        const zona = zonaEn(abierto, hit.uv);
        if (zona === 'sellar') sellar(abierto);
        else if (zona === 'favorito') alternarFavorito(abierto);
      } else if (!hit || libroDe(hit.object) !== abierto) cerrar();
      return;
    }
    if (!hit) return;
    tip.hidden = true;
    if (hit.object.userData.placa) enfocar(hit.object.userData.fila);
    else if (hit.object.userData.insignia) alternarFavorito(libroDe(hit.object));
    else abrir(libroDe(hit.object));
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && abierto && !ocupado) cerrar(); });

  // --- Filtro discreto ----------------------------------------------------------
  let filtro = 'todos';
  $('#filtro').addEventListener('change', (ev) => {
    if (!ev.target.matches('input[name=filtro]')) return;
    filtro = ev.target.value;
    const n = grupos3d.filter((g) => FILTROS[filtro].ok(g.userData.libro)).length;
    anunciar(`Mostrando ${FILTROS[filtro].nombre}: ${n} ${n === 1 ? 'libro' : 'libros'}.`);
  });

  // Atenúa los materiales propios del libro (el filtro multiplica sobre su color real).
  function tono(g) {
    const u = g.userData, f = 0.3 + 0.7 * u.filtroK;
    u.mats.tela.color.copy(u.tonos.tela).multiplyScalar(f);
    u.mats.tapaFrente.color.copy(u.tonos.tapa).multiplyScalar(f);
    u.mats.lomoMat.color.copy(u.tonos.lomo).multiplyScalar(f);
    u.insignia.material.opacity = u.opacidadInsignia * (0.25 + 0.75 * u.filtroK);
  }

  // --- Barra de teclado ------------------------------------------------------------
  const sel = $('#sel-libro');
  const porId = new Map(grupos3d.map((g) => [String(g.userData.libro.id), g]));
  const textoOpcion = (l) => {
    const estado = l.disponible ? 'disponible' : l.prestamo && l.prestamo.propio ? 'lo tenés vos' : 'prestado';
    return `${l.titulo} — ${l.autores.join(', ')} (${estado}${l.favorito ? ', ★ favorito' : ''})`;
  };
  porGenero.forEach((gr) => {
    const og = document.createElement('optgroup'); og.label = gr.nombre;
    gr.libros.forEach((g) => og.append(new Option(textoOpcion(g.userData.libro), g.userData.libro.id)));
    sel.append(og);
  });
  const refrescarOpcion = (g) => {
    const o = sel.querySelector(`option[value="${g.userData.libro.id}"]`);
    if (o) o.textContent = textoOpcion(g.userData.libro);
  };
  const btnAbrir = $('#btn-abrir'), btnSellar = $('#btn-sellar'), btnFav = $('#btn-fav'), btnCerrar = $('#btn-cerrar');
  function actualizarBarra() {
    const l = abierto && abierto.userData.libro;
    btnSellar.hidden = !(l && l.disponible);
    btnFav.hidden = !l; btnCerrar.hidden = !l;
    if (l) {
      btnFav.setAttribute('aria-pressed', l.favorito ? 'true' : 'false');
      btnFav.textContent = l.favorito ? '★ Quitar de favoritos' : '☆ Añadir a favoritos';
    }
  }
  btnAbrir.addEventListener('click', async () => {
    const g = porId.get(sel.value);
    if (!g) { anunciar('Elegí un libro de la lista.'); return; }
    if (ocupado || abierto === g) return;
    if (abierto) await cerrar();
    abrir(g);
  });
  sel.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); btnAbrir.click(); } });
  btnSellar.addEventListener('click', () => { if (abierto) sellar(abierto); });
  btnFav.addEventListener('click', () => { if (abierto) alternarFavorito(abierto); });
  btnCerrar.addEventListener('click', () => { if (abierto && !ocupado) cerrar(); });

  // --- Animaciones por cuadro (todas dependen del tiempo, no de los FPS) -------------------
  const tareas = [];
  const animar = (dur, paso) => new Promise((ok) => tareas.push({ t0: performance.now(), dur: quieto() ? 1 : dur, paso, ok }));
  alCuadro.push((dt) => {
    if (viaje) {
      const k = suave(Math.min(1, (performance.now() - viaje.t0) / viaje.dur));
      cam.position.lerpVectors(viaje.dePos, viaje.aPos, k);
      controles.target.lerpVectors(viaje.deMira, viaje.aMira, k);
      if (k >= 1) viaje = null;
    }
    for (let i = tareas.length - 1; i >= 0; i--) {
      const t = tareas[i]; const k = Math.min(1, (performance.now() - t.t0) / t.dur);
      t.paso(k);
      if (k >= 1) { tareas.splice(i, 1); t.ok(); }
    }
    const ya = quieto();
    grupos3d.forEach((g) => {
      const u = g.userData;
      const meta = u.enMano || FILTROS[filtro].ok(u.libro) ? 1 : 0;
      u.filtroK = ya ? meta : damp(u.filtroK, meta, 6, dt);
      tono(g);
      if (u.enMano) return;
      const objetivo = u.casa.pos.z + (g === encima ? 0.04 : 0) - (u.libro.disponible ? 0 : 0.028) - (1 - u.filtroK) * 0.045;
      g.position.z = ya ? objetivo : damp(g.position.z, objetivo, 10, dt);
    });
  });

  // --- Abrir y cerrar un libro --------------------------------------------------
  let vueltaCamara = null;
  async function abrir(g) {
    ocupado = true; tip.hidden = true; controles.enabled = false;
    g.userData.enMano = true; abierto = g; zonaResaltada = null;
    sel.value = String(g.userData.libro.id);
    dibujarContratapa(g, { sello: selloDe(g) });
    vueltaCamara = { pos: cam.position.clone(), mira: controles.target.clone() };
    const { fondo, grosor } = g.userData;
    // Posición de lectura: delante del mueble, a la altura de la vista actual.
    const y = THREE.MathUtils.clamp(controles.target.y, 0.35, 1.15);
    const lector = new THREE.Vector3(fondo / 2, y, 0.46);
    const qLector = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
    const centro = new THREE.Vector3(0, y, 0.46 + grosor);
    // El libro abierto mide dos tapas de ancho: la cámara se aleja lo justo para verlo entero.
    const dist = Math.max(0.32, (g.userData.alto * 1.08) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))));
    volarA(new THREE.Vector3(0, y + 0.01, centro.z + dist), centro, 1300);
    lectura.position.set(0.15, y + 0.25, centro.z + 0.35);
    const l = g.userData.libro;
    anunciar(`Abriendo «${l.titulo}», de ${l.autores.join(', ')}.`);

    // 1) asoma del estante  2) viaja a la posición de lectura  3) se abre hasta la contratapa
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    const p1 = p0.clone().add(new THREE.Vector3(0, 0.01, 0.16));
    await animar(380, (k) => g.position.lerpVectors(p0, p1, suave(k)));
    await animar(950, (k) => {
      const e = suave(k);
      g.position.lerpVectors(p1, lector, e);
      g.position.z += Math.sin(e * Math.PI) * 0.08;
      g.quaternion.slerpQuaternions(q0, qLector, e);
      lectura.intensity = 0.25 * e;
    });
    await animar(3200, (k) => abrirLibro(g, k));
    ayuda.textContent = AYUDA_LIBRO;
    ocupado = false;
    actualizarBarra();
    anunciar(`«${l.titulo}» abierto en la ficha de préstamo. ${estadoTexto(l)}` +
      `${l.disponible ? ' Podés sellar el préstamo.' : ''} Escape para devolverlo al estante.`);
  }

  async function cerrar() {
    const g = abierto; if (!g) return;
    ocupado = true; zonaResaltada = null;
    ayuda.textContent = AYUDA_GENERAL;
    await animar(1600, (k) => abrirLibro(g, 1 - k));
    volarA(vueltaCamara.pos, vueltaCamara.mira, 1100);
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    const casa = g.userData.casa;
    const qCasa = new THREE.Quaternion().setFromEuler(casa.rot);
    await animar(900, (k) => {
      const e = suave(k);
      g.position.lerpVectors(p0, casa.pos, e);
      g.position.z += Math.sin(e * Math.PI) * 0.1;
      g.quaternion.slerpQuaternions(q0, qCasa, e);
      lectura.intensity = 0.25 * (1 - e);
    });
    g.userData.enMano = false; abierto = null; ocupado = false; controles.enabled = true;
    liberarContratapa(g);   // ya no se ve: se suelta la textura grande de la ficha
    estadoEnEstante(g);
    // si el foco del teclado estaba en un botón que ahora se oculta, vuelve a la lista de libros
    const barra = $('#controles');
    const enfocado = document.activeElement;
    actualizarBarra();
    if (!enfocado || enfocado === document.body || (barra.contains(enfocado) && enfocado.hidden)) sel.focus();
    anunciar(`Devolviste «${g.userData.libro.titulo}» al estante.`);
  }

  // --- Acciones de la ficha ------------------------------------------------------
  async function sellar(g) {
    const l = g.userData.libro;
    if (!l.disponible || ocupado) return;
    ocupado = true;
    const r = await fetch(`/user/api/prestamos/${l.id}`, { method: 'POST', headers: { [csrf.header]: csrf.token, Accept: 'application/json' } });
    const d = r.ok ? await r.json() : { ok: false, mensaje: 'No se pudo registrar el préstamo.' };
    if (!d.ok) { aviso(d.mensaje, true); ocupado = false; return; }
    l.disponible = false;
    l.prestamo = { fechaPrestamo: d.fechaPrestamo, fechaDevolucion: d.fechaDevolucion, diasRestantes: d.diasRestantes, vencido: false, propio: true };
    // El sello baja sobre la ficha y deja la tinta.
    await animar(700, (k) => dibujarContratapa(g, { sello: k }));
    dibujarContratapa(g, { sello: 1, resaltar: zonaResaltada === 'favorito' ? 'favorito' : null });
    aviso(`Préstamo registrado. Devolvé «${l.titulo}» antes del ${fechaLarga(d.fechaDevolucion)}.`);
    ocupado = false;
    refrescarOpcion(g); actualizarBarra();
  }

  async function alternarFavorito(g) {
    const l = g.userData.libro;
    const r = await fetch(`/user/api/favoritos/${l.id}`, { method: 'POST', headers: { [csrf.header]: csrf.token, Accept: 'application/json' } });
    if (!r.ok) return;
    l.favorito = (await r.json()).favorito;
    pintarInsignia(g);
    if (abierto === g) dibujarContratapa(g, { sello: selloDe(g), resaltar: zonaResaltada });
    aviso(l.favorito ? `«${l.titulo}» está en tus favoritos.` : `Quitaste «${l.titulo}» de favoritos.`);
    refrescarOpcion(g); actualizarBarra();
  }
}

function estadoTexto(l) {
  if (l.disponible) return 'Disponible para préstamo por 14 días.';
  if (l.prestamo && l.prestamo.propio) return `Lo tenés vos: devolvelo antes del ${fechaLarga(l.prestamo.fechaDevolucion)}.`;
  return l.prestamo ? `Está prestado: vuelve el ${fechaLarga(l.prestamo.fechaDevolucion)}.` : 'Está prestado.';
}

// ---------------------------------------------------------------------------------
// Insignia dorada de favorito, en lo alto del lomo.
// ---------------------------------------------------------------------------------
function crearInsignia(g) {
  const { alto, fondo, grosor } = g.userData;
  const r = Math.min(0.0075, grosor * 0.36);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.0016, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.3, transparent: true }));
  m.rotation.x = Math.PI / 2;
  m.position.set(0, alto / 2 - 0.022, fondo / 2 + 0.0012);
  m.userData.insignia = true;
  g.add(m); g.userData.insignia = m;
  pintarInsignia(g);
  return m;
}

function pintarInsignia(g) {
  const m = g.userData.insignia, fav = g.userData.libro.favorito;
  const [c, x] = lienzoHD(128, 128, { maxLado: 256 });
  const rg = x.createRadialGradient(50, 45, 8, 64, 64, 64);
  rg.addColorStop(0, fav ? '#fff0b8' : '#e6d6a8'); rg.addColorStop(1, fav ? '#b8892e' : '#8d7a52');
  x.fillStyle = rg; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(60,40,10,.7)'; x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.stroke();
  estrella(x, 64, 66, 38, 16);
  if (fav) { x.fillStyle = '#9e1b22'; x.fill(); } else { x.strokeStyle = 'rgba(60,40,10,.85)'; x.lineWidth = 6; x.stroke(); }
  if (m.material.map) m.material.map.dispose();
  m.material.map = texturaCanvas(c); m.material.needsUpdate = true;
  g.userData.opacidadInsignia = fav ? 1 : 0.55;
  m.material.opacity = g.userData.opacidadInsignia;
  // la cara con el dibujo es la tapa del cilindro que mira al frente
  m.rotation.y = 0;
}

function estrella(x, cx, cy, R, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
}

// Los prestados quedan un poco hundidos (ver animación) y con el lomo apagado.
function estadoEnEstante(g) {
  const l = g.userData.libro;
  g.userData.tonos.lomo.set(l.disponible ? 0xffffff : 0x8a8580);
  g.userData.mats.lomoMat.color.copy(g.userData.tonos.lomo);
  g.userData.mats.tela.emissive && g.userData.mats.tela.emissive.set(0x000000);
  // hilo verde azulado asomando por arriba: el libro lo tenés vos
  const viejo = g.getObjectByName('mio');
  if (viejo) { g.remove(viejo); viejo.geometry.dispose(); viejo.material.dispose(); }
  if (l.prestamo && l.prestamo.propio) {
    const hilo = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.05), new THREE.MeshStandardMaterial({ color: 0x1f8a78, roughness: 0.4, side: THREE.DoubleSide }));
    hilo.name = 'mio';
    hilo.position.set(0, g.userData.alto / 2 + 0.012, g.userData.fondo / 2 - 0.01);
    g.add(hilo);
  }
}

// ---------------------------------------------------------------------------------
// Contratapa interior: guarda de papel, bolsillo de cartulina y la ficha de préstamo.
// Se dibuja en un canvas HiDPI que se pega como textura. Las "zonas" son los botones de la ficha.
// El canvas y la textura se reutilizan mientras el libro está abierto (el sello se anima sin
// crear una textura por cuadro) y se liberan al devolverlo al estante.
// ---------------------------------------------------------------------------------
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Ficha clásica y sobria: cartulina marfil, tinta negra de máquina de escribir, renglones finos.
// Al sellar, la fecha de devolución se estampa en tinta roja en el primer renglón libre.
function dibujarContratapa(g, { sello = 0, resaltar = null } = {}) {
  const l = g.userData.libro;
  const { fondo, alto } = g.userData;
  const W = 1000, H = Math.round(W * (alto / fondo));
  let cc = g.userData.contratapa;
  if (!cc || cc.W !== W || cc.H !== H) {
    if (cc && cc.tex) cc.tex.dispose();
    const [c, x] = lienzoHD(W, H);
    cc = { c, x, W, H, tex: null };
    g.userData.contratapa = cc;
  }
  const x = cc.x;
  const mono = "'Courier New', Courier, monospace", serif = "Georgia, 'Times New Roman', serif";
  const tinta = '#0e0d0c', gris = '#3d3830', linea = 'rgba(20,18,16,.42)', rojo = '#9a1b22';

  // Guarda de papel liso.
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#efe8d8'; x.fillRect(0, 0, W, H);

  // Ficha.
  const fx = W * 0.09, fy = H * 0.045, fw = W * 0.82, fh = H * 0.7;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 10; x.shadowOffsetY = 3;
  x.fillStyle = '#fbf8f1'; x.fillRect(fx, fy, fw, fh);
  x.restore();
  // sombra interior suave en los bordes de la cartulina (se curva un poco, como la de verdad)
  sombraInterior(x, fx, fy, fw, fh, 16, 0.07);
  const izq = fx + 44, der = fx + fw - 44;
  x.textBaseline = 'alphabetic';

  // Cabecera.
  let yy = fy + 62;
  x.fillStyle = gris; x.font = `400 28px ${serif}`; x.textAlign = 'left';
  x.fillText('B I B L I O T E C A   F P 0 6 5', izq, yy);
  x.textAlign = 'right'; x.fillText('Nº ' + String(l.id).padStart(5, '0'), der - 56, yy);
  // favorito: estrella fina (rellena si es favorito); con el ratón encima, un halo suave
  if (resaltar === 'favorito') {
    x.save(); const hg = x.createRadialGradient(der - 16, yy - 9, 4, der - 16, yy - 9, 42);
    hg.addColorStop(0, 'rgba(201,161,78,.45)'); hg.addColorStop(1, 'rgba(201,161,78,0)');
    x.fillStyle = hg; x.beginPath(); x.arc(der - 16, yy - 9, 42, 0, Math.PI * 2); x.fill(); x.restore();
  }
  x.save(); x.lineWidth = 2.5; x.strokeStyle = tinta; x.fillStyle = l.favorito ? rojo : 'transparent';
  estrella(x, der - 16, yy - 9, 20, 9); x.fill(); x.stroke(); x.restore();
  yy += 22; x.fillStyle = tinta; x.fillRect(izq, yy, der - izq, 2);

  // Datos del libro, en renglones.
  const apellido = (l.autores[0] || '').split(' ').slice(-1)[0] || '';
  const campos = [
    ['Autor', l.autores.join(', ')],
    ['Título', l.titulo],
    ['Signatura', `${CODIGO[l.genero] || 'NOV'} ${quitarTildes(apellido).slice(0, 3).toUpperCase()} ${l.anio || 's/f'}`],
  ];
  x.textAlign = 'left';
  yy += 62;
  campos.forEach(([k, v]) => {
    x.fillStyle = gris; x.font = `italic 28px ${serif}`; x.fillText(k, izq, yy);
    x.fillStyle = tinta; x.font = `700 38px ${mono}`;
    const fin = textoEnLineas(x, v, izq + 170, yy, der - izq - 170, 44);
    for (let r = yy; r <= fin; r += 44) { x.fillStyle = linea; x.fillRect(izq + 160, r + 10, der - izq - 160, 1.5); }
    yy = fin + 60;
  });

  // Tabla de préstamos.
  yy += 4;
  const cols = [izq, izq + (der - izq) * 0.36, izq + (der - izq) * 0.72];
  x.fillStyle = gris; x.font = `400 26px ${serif}`;
  x.fillText('Prestado', cols[0], yy); x.fillText('Devolver antes del', cols[1], yy); x.fillText('Socio', cols[2], yy);
  yy += 12; x.fillStyle = tinta; x.fillRect(izq, yy, der - izq, 2);
  const paso = 56, filas = 5, y0 = yy;
  for (let i = 1; i <= filas; i++) { x.fillStyle = linea; x.fillRect(izq, y0 + i * paso, der - izq, 1.5); }
  [cols[1] - 14, cols[2] - 14].forEach((cx) => { x.fillStyle = linea; x.fillRect(cx, y0, 1.5, paso * filas); });
  if (l.prestamo && (!l.prestamo.propio || sello > 0)) {
    const yl = y0 + paso - 16;
    const k = l.prestamo.propio ? Math.min(1, sello) : 1;
    // fechas estampadas: tinta roja, algo torcidas, aparecen con el golpe del sello
    x.save(); x.globalAlpha = 0.85 * Math.min(1, k * 1.4);
    x.fillStyle = rojo; x.font = `700 30px ${mono}`;
    x.save(); x.translate(cols[0], yl); x.rotate(-0.025); x.fillText(fechaLarga(l.prestamo.fechaPrestamo).toUpperCase(), 0, 0); x.restore();
    const escala = 1 + (1 - k) * 0.6;
    x.save(); x.translate(cols[1], yl); x.rotate(-0.035); x.scale(escala, escala);
    x.fillStyle = l.prestamo.vencido ? rojo : '#7d1d22'; x.fillText(fechaLarga(l.prestamo.fechaDevolucion).toUpperCase(), 0, 0); x.restore();
    x.restore();
    x.fillStyle = tinta; x.font = `italic 30px ${serif}`;
    if (k >= 1) x.fillText(l.prestamo.propio ? 'vos' : '—', cols[2], yl);
  }

  // Estado, en una línea discreta al pie de la ficha.
  x.fillStyle = gris; x.font = `italic 26px ${serif}`;
  const pie = l.disponible ? 'Disponible para préstamo · 14 días'
    : l.prestamo && l.prestamo.propio ? `Lo tenés vos · devolvelo antes del ${fechaLarga(l.prestamo.fechaDevolucion)}`
    : l.prestamo ? `En préstamo · vuelve el ${fechaLarga(l.prestamo.fechaDevolucion)}` : 'En préstamo';
  x.fillText(pie, izq, H * 0.655);

  // Bolsillo de cartulina manila, con sombra interior en la boca (la ficha entra ahí).
  const by = H * 0.68, bx = W * 0.06, bw = W * 0.88, bh = H * 0.29;
  x.save(); x.shadowColor = 'rgba(0,0,0,.2)'; x.shadowBlur = 8; x.shadowOffsetY = -2;
  x.fillStyle = '#dcc79d'; x.fillRect(bx, by, bw, bh);
  x.restore();
  const boca = x.createLinearGradient(0, by, 0, by + 30);
  boca.addColorStop(0, 'rgba(40,28,10,.32)'); boca.addColorStop(1, 'rgba(40,28,10,0)');
  x.fillStyle = boca; x.fillRect(bx, by, bw, 30);
  sombraInterior(x, bx, by, bw, bh, 12, 0.12);
  x.strokeStyle = 'rgba(60,45,20,.35)'; x.lineWidth = 2; x.strokeRect(W * 0.085, by + 18, W * 0.83, bh - 36);
  x.fillStyle = '#3a2d17'; x.textAlign = 'center';
  x.font = `400 30px ${serif}`; x.fillText('B I B L I O T E C A   F P 0 6 5', W / 2, by + 74);
  x.font = `italic 24px ${serif}`; x.fillText('No retire la ficha de este bolsillo', W / 2, by + 112);

  const zonas = {};
  if (l.disponible) {
    const bw2 = W * 0.56, bh2 = 88, bx2 = (W - bw2) / 2, byy = by + 160;
    if (resaltar === 'sellar') { // resaltado sutil: papel un poco más oscuro y marco más grueso
      x.fillStyle = 'rgba(58,45,23,.12)'; x.fillRect(bx2, byy, bw2, bh2);
    }
    x.strokeStyle = '#3a2d17'; x.lineWidth = resaltar === 'sellar' ? 5 : 3; x.strokeRect(bx2, byy, bw2, bh2);
    x.fillStyle = '#3a2d17'; x.font = `700 36px ${mono}`; x.fillText('SELLAR PRÉSTAMO', W / 2, byy + 57);
    zonas.sellar = [bx2, byy, bw2, bh2];
  }
  zonas.favorito = [der - 50, fy + 20, 70, 70];
  g.userData.zonas = { ...zonas, W, H };

  const m = g.userData.mats.guarda;
  const nueva = !cc.tex;
  cc.tex = texturaCanvas(cc.c, cc.tex);
  if (m.map !== cc.tex) { m.map = cc.tex; m.color.set(0xd6cfbf); m.needsUpdate = true; } // un poco más oscuro: con la luz de lectura queda como papel real
  else if (nueva) m.needsUpdate = true;
}

function liberarContratapa(g) {
  const cc = g.userData.contratapa;
  if (!cc) return;
  if (cc.tex) cc.tex.dispose();
  const m = g.userData.mats.guarda;
  m.map = null; m.needsUpdate = true;
  g.userData.contratapa = null;
}

// Oscurece apenas los bordes de un rectángulo por dentro (papel con algo de volumen).
function sombraInterior(x, ax, ay, w, h, ancho, alfa) {
  const lados = [
    [ax, ay, ax, ay + ancho, ax, ay, w, ancho],
    [ax, ay + h, ax, ay + h - ancho, ax, ay + h - ancho, w, ancho],
    [ax, ay, ax + ancho, ay, ax, ay, ancho, h],
    [ax + w, ay, ax + w - ancho, ay, ax + w - ancho, ay, ancho, h],
  ];
  lados.forEach(([x0, y0, x1, y1, rx, ry, rw, rh]) => {
    const gr = x.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(60,45,20,${alfa})`); gr.addColorStop(1, 'rgba(60,45,20,0)');
    x.fillStyle = gr; x.fillRect(rx, ry, rw, rh);
  });
}

// Qué botón de la ficha hay bajo el ratón (a partir de la coordenada de textura).
function zonaEn(g, uv) {
  const z = g.userData.zonas; if (!z || !uv) return null;
  const px = uv.x * z.W, py = (1 - uv.y) * z.H;
  for (const n of ['sellar', 'favorito']) {
    const r = z[n]; if (r && px >= r[0] && px <= r[0] + r[2] && py >= r[1] && py <= r[1] + r[3]) return n;
  }
  return null;
}

function textoEnLineas(x, texto, cx, cy, ancho, alto) {
  const palabras = String(texto).split(' '); let linea = '', y = cy;
  palabras.forEach((p) => {
    const prueba = linea ? linea + ' ' + p : p;
    if (x.measureText(prueba).width > ancho && linea) { x.fillText(linea, cx, y); linea = p; y += alto; } else linea = prueba;
  });
  x.fillText(linea, cx, y);
  return y;
}

let temporizador;
function aviso(texto, error) {
  const a = document.querySelector('#aviso');
  a.textContent = texto; a.className = 'aviso-cine' + (error ? ' error' : ''); a.hidden = false;
  clearTimeout(temporizador); temporizador = setTimeout(() => { a.hidden = true; }, 4500);
}

function fechaCorta(s) { const [, m, d] = s.split('-'); return `${d}/${m}`; }
function fechaLarga(s) { const [a, m, d] = s.split('-'); return `${d} ${MESES[Number(m) - 1]} ${a}`; }
function quitarTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
