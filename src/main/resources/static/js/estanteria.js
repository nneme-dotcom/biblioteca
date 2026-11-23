// Catálogo del socio como estantería 3D.
// Pasá el ratón por un lomo y el libro asoma; hacé clic y viene hacia vos mostrando la portada.
import * as THREE from 'three';
import {
  crearEscenario, crearLibro, montarEstanteria, vestirConPortada, urlPortada,
  suave, prefiereQuieto, webglDisponible,
} from './biblioteca3d.js';

const $ = (s) => document.querySelector(s);
const contenedor = $('#escena');
const tip = $('#tooltip');
const ficha = $('#ficha');
const csrf = { token: $('meta[name=_csrf]').content, header: $('meta[name=_csrf_header]').content };
const quieto = prefiereQuieto();

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
  const ctx = crearEscenario(contenedor, { camara: [0.07, 0.48, 1.34], mira: [0, 0.41, 0], limites: { min: 0.55, max: 2.0 } });
  const { escena, cam, controles, renderer, alCuadro } = ctx;

  const grupos = libros.map((l) => crearLibro(l));
  montarEstanteria(ctx, grupos);
  grupos.forEach((g) => decorar(g));
  $('#cargando').hidden = true;
  $('#contador').textContent = `${libros.length} libros · ${libros.filter((l) => l.disponible).length} disponibles`;

  // Portadas de a poco, sin bloquear la escena.
  for (const g of grupos) vestirConPortada(g, renderer);

  // --- Interacción -------------------------------------------------------
  const ray = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const mallas = grupos.flatMap((g) => g.userData.piezas);
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
  $('#cerrar-ficha').addEventListener('click', soltar);

  // Los libros asoman cuando el ratón pasa por encima.
  alCuadro.push((dt, t) => {
    grupos.forEach((g) => {
      if (g === elegido || (anim && anim.g === g)) return;
      const casa = g.userData.casa;
      const objetivo = casa.pos.z + (g === encima ? 0.045 : 0) - (g.userData.libro.disponible ? 0 : 0.03);
      g.position.z += (objetivo - g.position.z) * Math.min(1, dt * (quieto ? 60 : 10));
    });
    if (anim) {
      anim.t = quieto ? 1 : Math.min(1, (performance.now() - anim.inicio) / (anim.dur * 1000));
      const k = suave(anim.t);
      anim.g.position.lerpVectors(anim.desde, anim.hasta, k);
      // un arco: primero sale del estante y luego viene hacia la cámara
      anim.g.position.z += Math.sin(k * Math.PI) * 0.12 * (anim.ida ? 1 : 0.5);
      anim.g.quaternion.slerpQuaternions(anim.qDesde, anim.qHasta, k);
      if (anim.t >= 1) { const fin = anim.fin; anim = null; fin && fin(); }
    } else if (elegido && !quieto) {
      // el libro elegido flota y gira apenas, como si lo tuvieras en la mano
      const base = elegido.userData.enMano;
      elegido.position.y = base.pos.y + Math.sin(t * 1.4) * 0.004;
      elegido.quaternion.copy(base.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(t * 0.7) * 0.12, Math.sin(t * 0.9) * 0.02)));
    }
  });

  function poseEnMano() {
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const derecha = new THREE.Vector3().crossVectors(dir, cam.up).normalize();
    const anchoFicha = window.innerWidth > 760 ? 0.09 : 0;
    const pos = cam.position.clone().addScaledVector(dir, 0.56).addScaledVector(derecha, -anchoFicha);
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
    contenedor.parentElement.classList.add('con-ficha');
  }

  function soltar(inmediato) {
    const g = elegido; if (!g) return;
    elegido = null; ficha.hidden = true; controles.enabled = true;
    contenedor.parentElement.classList.remove('con-ficha');
    const casa = g.userData.casa;
    const qCasa = new THREE.Quaternion().setFromEuler(casa.rot);
    if (inmediato) { g.position.copy(casa.pos); g.quaternion.copy(qCasa); return; }
    anim = { g, t: 0, inicio: performance.now(), dur: 0.75, ida: false, desde: g.position.clone(), hasta: casa.pos.clone(), qDesde: g.quaternion.clone(), qHasta: qCasa };
  }

  // --- Ficha del libro (HTML, siempre legible) ---------------------------
  function mostrarFicha(g) {
    const l = g.userData.libro;
    const img = $('#ficha-portada');
    if (g.userData.portadaId) { img.src = urlPortada(g.userData.portadaId, 'L'); img.hidden = false; } else img.hidden = true;
    img.alt = 'Portada de ' + l.titulo;
    $('#ficha-titulo').textContent = l.titulo;
    $('#ficha-autores').textContent = l.autores.join(', ');
    $('#ficha-anio').textContent = l.anio || '—';
    $('#ficha-isbn').textContent = l.isbn || '—';
    const estado = $('#ficha-estado');
    if (l.disponible) { estado.textContent = 'Disponible'; estado.className = 'estado ok'; }
    else {
      estado.className = 'estado no';
      estado.textContent = l.prestamo ? `Prestado · vuelve el ${fecha(l.prestamo.fechaDevolucion)}` : 'Prestado';
    }
    const pedir = $('#form-pedir');
    pedir.action = `/user/prestamos/solicitar/${l.id}`;
    pedir.hidden = !l.disponible;
    const fav = $('#btn-favorito');
    fav.textContent = l.favorito ? '★ Quitar de favoritos' : '☆ Añadir a favoritos';
    fav.setAttribute('aria-pressed', l.favorito ? 'true' : 'false');
    fav.onclick = () => alternarFavorito(g);
    ficha.hidden = false;
    $('#cerrar-ficha').focus({ preventScroll: true });
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
    if (libro.prestamo) { x.fillText('vuelve el', 64, 110); x.font = '700 30px Arial'; x.fillText(fecha(libro.prestamo.fechaDevolucion), 64, 150); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.056), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
    etiqueta.name = 'etiqueta';
    etiqueta.position.set(0, alto / 2 - 0.045, fondo / 2 + 0.004);
    etiqueta.rotation.z = -0.08;
    etiqueta.castShadow = true;
    g.add(etiqueta);
  }
}

function fecha(iso) { const [a, m, d] = iso.split('-'); return `${d}/${m}`; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
