// Vista cinematográfica del socio: solo la estantería, a pantalla completa.
// - Placas de latón grabadas en cada estante: clic para acercarte a ese género.
// - Insignia dorada en el lomo: clic para añadir o quitar de favoritos.
// - Los libros prestados están un poco hundidos y apagados.
// - Clic en un libro: sale del estante, la cámara se centra en él y se abre hasta la contratapa,
//   donde está pegado el bolsillo con su ficha de préstamo. En la ficha se sella el préstamo.
import * as THREE from 'three';
import {
  crearEscenario, crearLibro, montarEstanteria, vestirConPortada, abrirLibro, crearPlaca,
  suave, prefiereQuieto, webglDisponible,
} from './biblioteca3d.js';

const $ = (s) => document.querySelector(s);
const contenedor = $('#escena');
const tip = $('#tooltip');
const ayuda = $('#ayuda');
const csrf = { token: $('meta[name=_csrf]').content, header: $('meta[name=_csrf_header]').content };
const socio = document.body.dataset.socio || '';
const quieto = prefiereQuieto();
const GENEROS = ['Novela', 'Cuento', 'Clásicos', 'Género'];
const CODIGO = { 'Novela': 'NOV', 'Cuento': 'CUE', 'Clásicos': 'CLA', 'Género': 'GEN' };
const AYUDA_GENERAL = 'Clic en una placa para ir a un género · clic en un libro para abrirlo · ★ en el lomo: favoritos';
const AYUDA_LIBRO = 'Clic en la ficha para sellar el préstamo o marcar favorito · clic fuera del libro (o Esc) para devolverlo';

if (!webglDisponible()) {
  $('#cargando').innerHTML = 'Tu navegador no puede mostrar la vista cinematográfica. <a href="/vista/tradicional">Ir a la vista tradicional</a>';
} else {
  iniciar().catch((e) => {
    console.error(e);
    $('#cargando').innerHTML = 'No se pudo cargar la estantería. <a href="/vista/tradicional">Ir a la vista tradicional</a>';
  });
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
  const { filas, fondoMueble } = montarEstanteria(ctx, grupos3d, { grupos: porGenero });
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

  // Insignia de favorito en cada lomo, estado de préstamo y portadas (de a poco).
  const insignias = grupos3d.map((g) => crearInsignia(g));
  grupos3d.forEach((g) => estadoEnEstante(g));
  (async () => { for (const g of grupos3d) { vestirConPortada(g, renderer); await new Promise((r) => setTimeout(r, 60)); } })();

  // --- Cámara ---------------------------------------------------------------
  let viaje = null;
  const vistaGeneral = { pos: cam.position.clone(), mira: controles.target.clone() };
  function volarA(pos, mira, dur = 1100) {
    viaje = { t0: performance.now(), dur: quieto ? 1 : dur, dePos: cam.position.clone(), deMira: controles.target.clone(), aPos: pos.clone(), aMira: mira.clone() };
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
  let encima = null, abierto = null, ocupado = false;

  function apuntar(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(puntero, cam);
    return ray.intersectObjects([...insignias, ...placas, ...mallas], false)[0] || null;
  }
  const libroDe = (obj) => { let o = obj; while (o && !o.userData.libro) o = o.parent; return o; };

  renderer.domElement.addEventListener('pointermove', (ev) => {
    const hit = apuntar(ev);
    if (abierto) {
      const zona = hit && hit.object === abierto.userData.partes.trasera ? zonaEn(abierto, hit.uv) : null;
      renderer.domElement.style.cursor = zona ? 'pointer' : 'default';
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
  renderer.domElement.addEventListener('pointerleave', () => { encima = null; tip.hidden = true; });

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

  // --- Animaciones por cuadro -------------------------------------------------
  const tareas = [];
  const animar = (dur, paso) => new Promise((ok) => tareas.push({ t0: performance.now(), dur: quieto ? 1 : dur, paso, ok }));
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
    grupos3d.forEach((g) => {
      if (g.userData.enMano) return;
      const casa = g.userData.casa;
      const objetivo = casa.pos.z + (g === encima ? 0.04 : 0) - (g.userData.libro.disponible ? 0 : 0.028);
      g.position.z += (objetivo - g.position.z) * Math.min(1, dt * (quieto ? 60 : 10));
    });
  });

  // --- Abrir y cerrar un libro --------------------------------------------------
  let vueltaCamara = null;
  async function abrir(g) {
    ocupado = true; tip.hidden = true; controles.enabled = false;
    g.userData.enMano = true; abierto = g;
    dibujarContratapa(g, { sello: g.userData.libro.prestamo && g.userData.libro.prestamo.propio ? 1 : 0 });
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
  }

  async function cerrar() {
    const g = abierto; if (!g) return;
    ocupado = true;
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
    estadoEnEstante(g);
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
    dibujarContratapa(g, { sello: 1 });
    aviso(`Préstamo registrado. Devolvé «${l.titulo}» antes del ${fechaLarga(d.fechaDevolucion)}.`);
    ocupado = false;
  }

  async function alternarFavorito(g) {
    const l = g.userData.libro;
    const r = await fetch(`/user/api/favoritos/${l.id}`, { method: 'POST', headers: { [csrf.header]: csrf.token, Accept: 'application/json' } });
    if (!r.ok) return;
    l.favorito = (await r.json()).favorito;
    pintarInsignia(g);
    if (abierto === g) dibujarContratapa(g, { sello: l.prestamo && l.prestamo.propio ? 1 : 0 });
    aviso(l.favorito ? `«${l.titulo}» está en tus favoritos.` : `Quitaste «${l.titulo}» de favoritos.`);
  }
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
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const rg = x.createRadialGradient(50, 45, 8, 64, 64, 64);
  rg.addColorStop(0, fav ? '#fff0b8' : '#e6d6a8'); rg.addColorStop(1, fav ? '#b8892e' : '#8d7a52');
  x.fillStyle = rg; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(60,40,10,.7)'; x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.stroke();
  estrella(x, 64, 66, 38, 16);
  if (fav) { x.fillStyle = '#9e1b22'; x.fill(); } else { x.strokeStyle = 'rgba(60,40,10,.85)'; x.lineWidth = 6; x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (m.material.map) m.material.map.dispose();
  m.material.map = t; m.material.needsUpdate = true;
  m.material.opacity = fav ? 1 : 0.55;
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
  g.userData.mats.lomoMat.color.set(l.disponible ? 0xffffff : 0x8a8580);
  g.userData.mats.tela.emissive && g.userData.mats.tela.emissive.set(0x000000);
  // hilo verde azulado asomando por arriba: el libro lo tenés vos
  const viejo = g.getObjectByName('mio'); if (viejo) g.remove(viejo);
  if (l.prestamo && l.prestamo.propio) {
    const hilo = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.05), new THREE.MeshStandardMaterial({ color: 0x1f8a78, roughness: 0.4, side: THREE.DoubleSide }));
    hilo.name = 'mio';
    hilo.position.set(0, g.userData.alto / 2 + 0.012, g.userData.fondo / 2 - 0.01);
    g.add(hilo);
  }
}

// ---------------------------------------------------------------------------------
// Contratapa interior: guarda de papel, bolsillo de cartulina y la ficha de préstamo.
// Se dibuja en un canvas que se pega como textura. Las "zonas" son los botones de la ficha.
// ---------------------------------------------------------------------------------
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Ficha clásica y sobria: cartulina marfil, tinta negra de máquina de escribir, renglones finos.
// Al sellar, la fecha de devolución se estampa en tinta roja en el primer renglón libre.
function dibujarContratapa(g, { sello = 0 } = {}) {
  const l = g.userData.libro;
  const { fondo, alto } = g.userData;
  const W = 1000, H = Math.round(W * (alto / fondo));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const mono = "'Courier New', Courier, monospace", serif = "Georgia, 'Times New Roman', serif";
  const tinta = '#0e0d0c', gris = '#3d3830', linea = 'rgba(20,18,16,.42)', rojo = '#9a1b22';

  // Guarda de papel liso.
  x.fillStyle = '#efe8d8'; x.fillRect(0, 0, W, H);

  // Ficha.
  const fx = W * 0.09, fy = H * 0.045, fw = W * 0.82, fh = H * 0.7;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 10; x.shadowOffsetY = 3;
  x.fillStyle = '#fbf8f1'; x.fillRect(fx, fy, fw, fh);
  x.restore();
  const izq = fx + 44, der = fx + fw - 44;
  x.textBaseline = 'alphabetic';

  // Cabecera.
  let yy = fy + 62;
  x.fillStyle = gris; x.font = `400 28px ${serif}`; x.textAlign = 'left';
  x.fillText('B I B L I O T E C A   F P 0 6 5', izq, yy);
  x.textAlign = 'right'; x.fillText('Nº ' + String(l.id).padStart(5, '0'), der - 56, yy);
  // favorito: estrella fina (rellena si es favorito)
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

  // Bolsillo de cartulina manila, sencillo.
  const by = H * 0.68;
  x.save(); x.shadowColor = 'rgba(0,0,0,.2)'; x.shadowBlur = 8; x.shadowOffsetY = -2;
  x.fillStyle = '#dcc79d'; x.fillRect(W * 0.06, by, W * 0.88, H * 0.29);
  x.restore();
  x.strokeStyle = 'rgba(60,45,20,.35)'; x.lineWidth = 2; x.strokeRect(W * 0.085, by + 18, W * 0.83, H * 0.29 - 36);
  x.fillStyle = '#3a2d17'; x.textAlign = 'center';
  x.font = `400 30px ${serif}`; x.fillText('B I B L I O T E C A   F P 0 6 5', W / 2, by + 74);
  x.font = `italic 24px ${serif}`; x.fillText('No retire la ficha de este bolsillo', W / 2, by + 112);

  const zonas = {};
  if (l.disponible) {
    const bw = W * 0.56, bh = 88, bx = (W - bw) / 2, byy = by + 160;
    x.strokeStyle = '#3a2d17'; x.lineWidth = 3; x.strokeRect(bx, byy, bw, bh);
    x.fillStyle = '#3a2d17'; x.font = `700 36px ${mono}`; x.fillText('SELLAR PRÉSTAMO', W / 2, byy + 57);
    zonas.sellar = [bx, byy, bw, bh];
  }
  zonas.favorito = [der - 50, fy + 20, 70, 70];
  g.userData.zonas = { ...zonas, W, H };

  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  const m = g.userData.mats.guarda;
  if (m.map) m.map.dispose();
  m.map = tex; m.color.set(0xd6cfbf); m.needsUpdate = true; // un poco más oscuro: con la luz de lectura queda como papel real
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
function redondo(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

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
