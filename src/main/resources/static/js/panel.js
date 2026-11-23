// Vista cinematográfica del admin: panel de control de préstamos en 3D.
// Una línea de tiempo sobre una rejilla: HOY en el centro, los vencidos a la izquierda (rojo),
// los que vencen en 3 días o menos (ámbar) y los que están en plazo (verde) a la derecha.
// Cada préstamo es una tarjeta con la portada sobre un haz de luz; clic para ver quién lo tiene.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { idPortada, urlPortada, prefiereQuieto, webglDisponible } from './biblioteca3d.js';

const $ = (s) => document.querySelector(s);
const COLOR = { vencido: 0xff4d4d, pronto: 0xffb020, ok: 0x2bd99a };
const quieto = prefiereQuieto();
const DIA = 0.16;            // metros de escena por día
const ANCHO = 0.46, ALTO = 0.69; // tarjeta (proporción de portada)

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
  const prestados = libros.filter((l) => l.prestamo).sort((a, b) => a.prestamo.diasRestantes - b.prestamo.diasRestantes);

  // Resumen arriba a la izquierda.
  const cuenta = (e) => prestados.filter((l) => estadoDe(l.prestamo) === e).length;
  $('#k-vencidos').textContent = cuenta('vencido');
  $('#k-pronto').textContent = cuenta('pronto');
  $('#k-ok').textContent = cuenta('ok');
  $('#k-estante').textContent = libros.length - prestados.length;

  // --- Escena -----------------------------------------------------------------
  const cont = $('#escena');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  cont.appendChild(renderer.domElement);
  const capa = new CSS2DRenderer(); capa.domElement.className = 'capa-etiquetas'; cont.appendChild(capa.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x070b12);
  escena.fog = new THREE.FogExp2(0x070b12, 0.075);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
  cam.position.set(0, 2.6, 7.2);
  const controles = new OrbitControls(cam, renderer.domElement);
  controles.target.set(0, 1.1, 0);
  controles.enableDamping = true; controles.enablePan = false;
  controles.minDistance = 3; controles.maxDistance = 11;
  controles.minPolarAngle = 0.6; controles.maxPolarAngle = 1.45;
  controles.minAzimuthAngle = -0.9; controles.maxAzimuthAngle = 0.9;
  escena.add(new THREE.AmbientLight(0x8fa6c8, 0.7));
  const luz = new THREE.DirectionalLight(0xffffff, 1.2); luz.position.set(2, 6, 5); escena.add(luz);

  // Rango de la línea de tiempo.
  const minD = Math.min(-15, ...prestados.map((l) => l.prestamo.diasRestantes)) - 3;
  const maxD = Math.max(15, ...prestados.map((l) => l.prestamo.diasRestantes)) + 3;
  const x = (d) => d * DIA;

  // Rejilla del suelo y franjas de color por zona.
  const rejilla = new THREE.GridHelper(40, 80, 0x1d3550, 0x10202f); escena.add(rejilla);
  const franja = (d0, d1, color, op) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x(d1) - x(d0), 3.4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((x(d0) + x(d1)) / 2, 0.002, -0.9); escena.add(m);
  };
  franja(minD, 0, COLOR.vencido, 0.1);
  franja(0, 3, COLOR.pronto, 0.14);
  franja(3, maxD, COLOR.ok, 0.08);

  // Eje con marcas cada 5 días.
  const eje = new THREE.Mesh(new THREE.BoxGeometry(x(maxD) - x(minD), 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x5b7ea6 }));
  eje.position.set((x(minD) + x(maxD)) / 2, 0.01, 0.75); escena.add(eje);
  for (let d = Math.ceil(minD / 5) * 5; d <= maxD; d += 5) {
    const marca = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.16), new THREE.MeshBasicMaterial({ color: 0x5b7ea6 }));
    marca.position.set(x(d), 0.01, 0.75); escena.add(marca);
    if (d !== 0) etiqueta(`<span class="tick">${d > 0 ? '+' : ''}${d} d</span>`, x(d), 0.02, 1.0);
  }
  // HOY: plano de luz vertical.
  const hoy = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 3.2),
    new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55, depthWrite: false }));
  hoy.position.set(0, 1.6, -0.9); escena.add(hoy);
  const hoyBase = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 3.4), new THREE.MeshBasicMaterial({ color: 0x9fd0ff }));
  hoyBase.position.set(0, 0.01, -0.9); escena.add(hoyBase);
  const ahora = new Date();
  etiqueta(`<span class="hoy">HOY · ${String(ahora.getDate()).padStart(2, '0')} ${MESES[ahora.getMonth()]}</span>`, 0, 3.35, -0.9);
  etiqueta('<span class="zona vencido">◀ VENCIDOS</span>', x(minD) + 0.9, 0.02, 1.35);
  etiqueta('<span class="zona ok">EN PLAZO ▶</span>', x(maxD) - 0.9, 0.02, 1.35);
  etiqueta('<span class="zona pronto">VENCEN PRONTO</span>', x(1.5), 0.02, 1.35);

  function etiqueta(html, px, py, pz) {
    const d = document.createElement('div'); d.innerHTML = html;
    const o = new CSS2DObject(d); o.position.set(px, py, pz); escena.add(o); return o;
  }

  // --- Una tarjeta por préstamo --------------------------------------------------
  const tarjetas = [];
  const ocupadas = []; // para apilar en filas las que caen cerca
  const cargador = new THREE.TextureLoader().setCrossOrigin('anonymous');
  prestados.forEach((l, i) => {
    const p = l.prestamo, e = estadoDe(p), color = COLOR[e];
    const px = x(p.diasRestantes);
    let fila = 0; while (ocupadas.some((o) => o.fila === fila && Math.abs(o.x - px) < ANCHO * 1.15)) fila++;
    ocupadas.push({ fila, x: px });
    // las que caen en días cercanos se apilan hacia arriba, sin taparse
    const pz = 0, alturaBase = 0.42 + fila * 1.02;

    const g = new THREE.Group(); g.position.set(px, alturaBase + ALTO / 2, pz);
    // marco luminoso + portada
    const marco = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO + 0.05, ALTO + 0.05), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    marco.position.z = -0.002;
    const portadaMat = new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.6, emissive: 0x111111 });
    const portada = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO, ALTO), portadaMat);
    g.add(marco, portada);
    const dorso = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO + 0.05, ALTO + 0.05), new THREE.MeshBasicMaterial({ color: 0x0d1520 }));
    dorso.rotation.y = Math.PI; dorso.position.z = -0.004; g.add(dorso);
    portada.userData.tarjeta = marco.userData.tarjeta = l.id;
    escena.add(g);
    // título provisional mientras llega la portada
    portadaMat.map = tapaTexto(l); portadaMat.color.set(0xffffff); portadaMat.needsUpdate = true;
    idPortada(l).then((id) => {
      if (!id) return;
      cargador.load(urlPortada(id, 'M'), (t) => {
        if (t.image.width < 10) return;
        t.colorSpace = THREE.SRGBColorSpace; portadaMat.map = t; portadaMat.needsUpdate = true;
      });
    });
    // haz de luz desde el suelo y anillo en la base
    const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, alturaBase, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    haz.position.set(px, alturaBase / 2, pz); escena.add(haz);
    const anillo = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    anillo.rotation.x = -Math.PI / 2; anillo.position.set(px, 0.006, pz); escena.add(anillo);
    // rótulo corto debajo
    const r = etiqueta(`<div class="rotulo ${e}"><strong>${esc(l.titulo)}</strong><em>${textoDias(p)}</em></div>`, px, alturaBase - 0.12, pz);
    tarjetas.push({ l, g, marco, haz, anillo, rotulo: r, e, base: g.position.clone(), fase: i * 0.7 });
  });
  $('#cargando').hidden = true;
  if (!prestados.length) $('#ayuda').textContent = 'No hay libros prestados ahora mismo.';

  const tip = $('#tooltip');
  // --- Ficha del socio (se despliega al hacer clic en una tarjeta) ---------------
  const ficha = document.createElement('div'); ficha.className = 'ficha-socio'; ficha.hidden = true;
  const fichaObj = new CSS2DObject(ficha); escena.add(fichaObj);
  let elegida = null;
  function abrirFicha(t) {
    elegida = t;
    const { l } = t, p = l.prestamo;
    ficha.className = 'ficha-socio ' + t.e;
    ficha.innerHTML = `
      <button type="button" class="cerrar-ficha" aria-label="Cerrar">✕</button>
      <span class="estado-socio">${textoDias(p)}</span>
      <h3>${esc(l.titulo)}</h3>
      <p class="autor">${esc(l.autores.join(', '))}</p>
      <dl>
        <dt>Lo tiene</dt><dd><strong>${esc(p.socio)}</strong></dd>
        <dt>Teléfono</dt><dd>${p.telefono ? `<a href="tel:${esc(p.telefono)}">${esc(p.telefono)}</a>` : '—'}</dd>
        <dt>Email</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd>
        <dt>Prestado el</dt><dd>${fecha(p.fechaPrestamo)}</dd>
        <dt>Devolver antes del</dt><dd>${fecha(p.fechaDevolucion)}</dd>
      </dl>`;
    ficha.querySelector('.cerrar-ficha').addEventListener('click', cerrarFicha);
    fichaObj.position.copy(t.base).add(new THREE.Vector3(ANCHO / 2 + 0.12, 0.1, 0));
    tip.hidden = true;
    ficha.hidden = false;
    // la cámara se acerca a la tarjeta
    volar(new THREE.Vector3(t.base.x + 1.3, t.base.y + 0.6, t.base.z + 3.6), new THREE.Vector3(t.base.x + 0.75, t.base.y, t.base.z));
  }
  function cerrarFicha() { elegida = null; ficha.hidden = true; volar(vista0.pos, vista0.mira); }

  // --- Cámara, animación e interacción -----------------------------------------
  const vista0 = { pos: cam.position.clone(), mira: controles.target.clone() };
  let viaje = null;
  function volar(pos, mira) { viaje = { t0: performance.now(), dur: quieto ? 1 : 1100, a: cam.position.clone(), b: pos, ma: controles.target.clone(), mb: mira }; }
  const ray = new THREE.Raycaster(), puntero = new THREE.Vector2();
  let encima = null;
  function tarjetaBajo(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(puntero, cam);
    const h = ray.intersectObjects(tarjetas.flatMap((t) => t.g.children), false)[0];
    return h ? tarjetas.find((t) => t.g === h.object.parent) : null;
  }
  renderer.domElement.addEventListener('pointermove', (ev) => {
    const t = tarjetaBajo(ev); encima = t;
    renderer.domElement.style.cursor = t ? 'pointer' : 'grab';
    if (t && t !== elegida) {
      tip.innerHTML = `<strong>${esc(t.l.titulo)}</strong><span>${esc(t.l.prestamo.socio)}</span><em class="${t.e}">${textoDias(t.l.prestamo)}</em><span>Clic para ver los datos del socio</span>`;
      tip.style.left = Math.min(ev.clientX + 16, window.innerWidth - 300) + 'px'; tip.style.top = ev.clientY + 12 + 'px'; tip.hidden = false;
    } else tip.hidden = true;
  });
  let abajo = null;
  renderer.domElement.addEventListener('pointerdown', (ev) => { abajo = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (!abajo || Math.hypot(ev.clientX - abajo[0], ev.clientY - abajo[1]) > 5) return;
    const t = tarjetaBajo(ev);
    if (t) abrirFicha(t); else if (elegida) cerrarFicha();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && elegida) cerrarFicha(); });

  function ajustar() {
    const w = cont.clientWidth, h = cont.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); capa.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(cont); ajustar();

  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = reloj.getElapsedTime();
    if (viaje) {
      const k = Math.min(1, (performance.now() - viaje.t0) / viaje.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      cam.position.lerpVectors(viaje.a, viaje.b, e); controles.target.lerpVectors(viaje.ma, viaje.mb, e);
      if (k >= 1) viaje = null;
    }
    tarjetas.forEach((c) => {
      const activo = c === encima || c === elegida;
      if (!quieto) c.g.position.y = c.base.y + Math.sin(t * 1.2 + c.fase) * 0.025;
      const s = activo ? 1.12 : 1; c.g.scale.setScalar(c.g.scale.x + (s - c.g.scale.x) * 0.15);
      // las tarjetas miran siempre a la cámara (solo giran sobre el eje vertical)
      c.g.rotation.y = Math.atan2(cam.position.x - c.g.position.x, cam.position.z - c.g.position.z);
      if (c.e === 'vencido' && !quieto) {
        const pulso = 0.55 + Math.sin(t * 4) * 0.35;
        c.haz.material.opacity = pulso; c.anillo.material.opacity = pulso; c.anillo.scale.setScalar(1 + (Math.sin(t * 4) + 1) * 0.15);
      }
    });
    controles.update();
    renderer.render(escena, cam); capa.render(escena, cam);
  });
}

// Tapa provisional con el título, por si la portada tarda o no existe.
function tapaTexto(l) {
  const c = document.createElement('canvas'); c.width = 300; c.height = 450;
  const x = c.getContext('2d');
  x.fillStyle = '#2b3444'; x.fillRect(0, 0, 300, 450);
  x.strokeStyle = '#9fb3cc'; x.lineWidth = 4; x.strokeRect(16, 16, 268, 418);
  x.fillStyle = '#e8eef6'; x.textAlign = 'center'; x.font = '700 30px Georgia, serif';
  const palabras = l.titulo.split(' '); const lineas = []; let linea = '';
  palabras.forEach((p) => { const prueba = linea ? linea + ' ' + p : p; if (x.measureText(prueba).width > 240) { lineas.push(linea); linea = p; } else linea = prueba; });
  lineas.push(linea);
  lineas.forEach((t, i) => x.fillText(t, 150, 170 + i * 38));
  x.font = '400 20px Georgia, serif'; x.fillText(l.autores.join(', '), 150, 380);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
