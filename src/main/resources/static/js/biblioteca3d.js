// Biblioteca 3D: piezas comunes para la estantería del socio y el panel del admin.
// Todo se mide en metros, como en la vida real: un libro mide ~22 cm de alto.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------------------------------------------------------------------------
// Portadas reales (Open Library). Los ISBN de los datos de ejemplo no coinciden con los de
// Open Library, así que dejamos fijado el id de portada de cada libro por su título.
// Los libros nuevos se buscan al momento por título y autor (y se guardan en el navegador).
// ---------------------------------------------------------------------------
const PORTADAS = {
  'ficciones': 10832290,
  'el aleph': 14408958,
  'rayuela': 1047466,
  'bestiario': 5721778,
  'el tunel': 5517733,
  'sobre heroes y tumbas': 8078732,
  'la invencion de morel': 1046845,
  'seis problemas para don isidro parodi': 6562964,
  'antologia de la literatura fantastica': 10832253,
  'el beso de la mujer arana': 5443170,
  'nuestra parte de noche': 10239068,
  'crimen y castigo': 12328823,
  'los hermanos karamazov': 11609759,
  'el idiota': 12070505,
  'memorias del subsuelo': 6908257,
};

export const normalizar = (s) => (s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

const guardado = {
  leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  escribir(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
};

// Devuelve el id de portada de Open Library (o null si no hay).
export async function idPortada(libro) {
  const clave = normalizar(libro.titulo);
  if (PORTADAS[clave]) return PORTADAS[clave];
  const cache = guardado.leer('portada:' + clave);
  if (cache) return cache === 'no' ? null : Number(cache);
  try {
    const p = new URLSearchParams({ title: libro.titulo, fields: 'cover_i', limit: '5' });
    if (libro.autores && libro.autores[0]) p.set('author', libro.autores[0]);
    const r = await fetch('https://openlibrary.org/search.json?' + p, { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    const doc = (d.docs || []).find((x) => x.cover_i);
    guardado.escribir('portada:' + clave, doc ? String(doc.cover_i) : 'no');
    return doc ? doc.cover_i : null;
  } catch (e) {
    return null;
  }
}

export const urlPortada = (id, tam = 'L') => `https://covers.openlibrary.org/b/id/${id}-${tam}.jpg`;

// Número pseudoaleatorio estable a partir del id: cada libro tiene siempre el mismo tamaño.
export function azar(semilla) {
  let s = (semilla * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ---------------------------------------------------------------------------
// Texturas hechas con canvas (sin descargar imágenes): madera, yeso, papel y tela.
// ---------------------------------------------------------------------------
function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function ruido(ctx, w, h, alfa) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * alfa;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Madera de nogal: vetas largas onduladas, nudos suaves y variación de tono.
export function texturaMadera(renderer, { base = '#5a3a22', claro = '#7a5233', oscuro = '#3a2414', repetir = [1, 1] } = {}) {
  const W = 1024, H = 256;
  const [c, g] = lienzo(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, claro); grad.addColorStop(0.5, base); grad.addColorStop(1, claro);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    const y0 = Math.random() * H, amp = 2 + Math.random() * 7, frec = 0.002 + Math.random() * 0.006, fase = Math.random() * 6;
    g.strokeStyle = Math.random() < 0.55 ? oscuro : claro;
    g.globalAlpha = 0.08 + Math.random() * 0.22;
    g.lineWidth = 0.6 + Math.random() * 2.2;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = y0 + Math.sin(x * frec + fase) * amp + Math.sin(x * frec * 3.1 + fase) * amp * 0.3;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  for (let k = 0; k < 3; k++) { // nudos
    const x = Math.random() * W, y = Math.random() * H, r = 6 + Math.random() * 10;
    const rg = g.createRadialGradient(x, y, 1, x, y, r * 2.5);
    rg.addColorStop(0, oscuro); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.35; g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, r * 2.5, r, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1; ruido(g, W, H, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repetir);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function texturaYeso(renderer) {
  const [c, g] = lienzo(512, 512);
  g.fillStyle = '#3b4a3e'; g.fillRect(0, 0, 512, 512); ruido(g, 512, 512, 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3);
  return t;
}

// Canto de las hojas: rayitas finas color crema.
function texturaPapel(horizontal) {
  const [c, g] = lienzo(256, 256);
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    g.fillStyle = `rgba(110,90,60,${0.05 + Math.random() * 0.12})`;
    horizontal ? g.fillRect(0, i, 256, 1) : g.fillRect(i, 0, 1, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Relieve de tela para tapas y lomos.
let _tela;
function bumpTela() {
  if (_tela) return _tela;
  const [c, g] = lienzo(256, 256);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.08})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 2) { g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.08})`; g.fillRect(x, 0, 1, 256); }
  _tela = new THREE.CanvasTexture(c); _tela.wrapS = _tela.wrapT = THREE.RepeatWrapping; _tela.repeat.set(3, 3);
  return _tela;
}

// ---------------------------------------------------------------------------
// Escenario: renderer físicamente correcto, luz cálida de biblioteca, sala y cámara.
// ---------------------------------------------------------------------------
export function crearEscenario(contenedor, { camara = [0, 0.62, 1.55], mira = [0, 0.46, 0], limites = {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  contenedor.appendChild(renderer.domElement);

  // Etiquetas HTML encima del 3D (texto nítido y legible, no dibujado en la escena).
  const etiquetas = new CSS2DRenderer();
  etiquetas.domElement.className = 'capa-etiquetas';
  contenedor.appendChild(etiquetas.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x141712);
  escena.fog = new THREE.Fog(0x141712, 2.6, 6);
  // Reflejos realistas: un "cuarto" virtual que ilumina los materiales.
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.22;

  const cam = new THREE.PerspectiveCamera(38, 1, 0.02, 30);
  cam.position.set(...camara);

  const controles = new OrbitControls(cam, renderer.domElement);
  controles.target.set(...mira);
  controles.enableDamping = true; controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.minDistance = limites.min ?? 0.7; controles.maxDistance = limites.max ?? 2.6;
  controles.minAzimuthAngle = -(limites.azimut ?? 0.6); controles.maxAzimuthAngle = limites.azimut ?? 0.6;
  controles.minPolarAngle = limites.polarMin ?? 1.15; controles.maxPolarAngle = limites.polarMax ?? 1.72;
  controles.update();

  // Luces: un foco cálido desde arriba (sombras suaves), relleno frío y luz de ambiente baja.
  const foco = new THREE.SpotLight(0xffcf96, 30, 6, 0.5, 0.65, 1.6);
  foco.position.set(0.55, 2.1, 1.6);
  foco.target.position.set(0, 0.45, 0);
  foco.castShadow = true;
  foco.shadow.mapSize.set(2048, 2048);
  foco.shadow.bias = -0.0002; foco.shadow.normalBias = 0.02; foco.shadow.radius = 6;
  escena.add(foco, foco.target);
  const relleno = new THREE.DirectionalLight(0x9fb4ff, 0.18); relleno.position.set(-2, 1.2, 1.5); escena.add(relleno);
  escena.add(new THREE.HemisphereLight(0xffe9cc, 0x2a1a10, 0.12));
  // luz cálida rasante, como una lámpara de lectura delante del mueble
  const lampara = new THREE.PointLight(0xffb86b, 0.9, 2.2, 2); lampara.position.set(-0.55, 0.95, 0.75); escena.add(lampara);

  // Sala: suelo de tablones y pared de yeso.
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({
    map: texturaMadera(renderer, { base: '#4a2e1b', claro: '#5e3b22', oscuro: '#2c1a0e', repetir: [6, 24] }), roughness: 0.55,
  }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; escena.add(suelo);
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshStandardMaterial({ map: texturaYeso(renderer), roughness: 0.95 }));
  pared.position.set(0, 2.5, -0.42); pared.receiveShadow = true; escena.add(pared);

  function ajustar() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); etiquetas.setSize(w, h);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(contenedor); ajustar();

  const alCuadro = [];
  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05);
    controles.update();
    alCuadro.forEach((f) => f(dt, reloj.elapsedTime));
    renderer.render(escena, cam);
    etiquetas.render(escena, cam);
  });

  return { THREE, renderer, escena, cam, controles, foco, alCuadro };
}

// ---------------------------------------------------------------------------
// Libro realista: bloque de hojas, dos tapas con cartón que sobresale, lomo con título.
// Ejes del libro: x = grosor, y = alto, z = fondo. El lomo mira a +z y la tapa delantera a +x.
// ---------------------------------------------------------------------------
const TAPA = 0.0028, VUELO = 0.0025;
const papelV = texturaPapel(false), papelH = texturaPapel(true);
const matPapelV = new THREE.MeshStandardMaterial({ map: papelV, roughness: 0.92 });
const matPapelH = new THREE.MeshStandardMaterial({ map: papelH, roughness: 0.92 });

export function medidasLibro(id) {
  const r = azar(id + 7);
  return { grosor: 0.022 + r() * 0.03, alto: 0.19 + r() * 0.055, fondo: 0.125 + r() * 0.03 };
}

export function crearLibro(libro) {
  const { grosor, alto, fondo } = medidasLibro(libro.id);
  const grupo = new THREE.Group();
  grupo.userData = { libro, grosor, alto, fondo };

  const tela = new THREE.MeshPhysicalMaterial({ color: 0x6b5a48, roughness: 0.72, bumpMap: bumpTela(), bumpScale: 0.6, sheen: 0.4, sheenRoughness: 0.8 });
  const tapaFrente = new THREE.MeshPhysicalMaterial({ color: 0x6b5a48, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  tapaFrente.visible = true;

  // Hojas
  const hojas = new THREE.Mesh(
    new THREE.BoxGeometry(grosor - TAPA * 2, alto - VUELO * 2, fondo - VUELO),
    [tela, tela, matPapelH, matPapelH, tela, matPapelV]);
  hojas.position.z = -VUELO / 2;
  // Tapas (la delantera lleva la portada en su cara +x)
  const geoTapa = new THREE.BoxGeometry(TAPA, alto, fondo);
  const delantera = new THREE.Mesh(geoTapa, [tapaFrente, tela, tela, tela, tela, tela]);
  delantera.position.x = grosor / 2 - TAPA / 2;
  const trasera = new THREE.Mesh(geoTapa, tela);
  trasera.position.x = -grosor / 2 + TAPA / 2;
  // Lomo: un poco redondeado (media caña) con la etiqueta del título
  const lomoMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, bumpMap: bumpTela(), bumpScale: 0.4, sheen: 0.3 });
  const lomo = new THREE.Mesh(new THREE.BoxGeometry(grosor, alto, TAPA * 1.2), [tela, tela, tela, tela, lomoMat, tela]);
  lomo.position.z = fondo / 2 - TAPA * 0.6;

  [hojas, delantera, trasera, lomo].forEach((m) => { m.castShadow = true; m.receiveShadow = true; grupo.add(m); });
  grupo.userData.mats = { tela, tapaFrente, lomoMat };
  grupo.userData.piezas = [hojas, delantera, trasera, lomo];

  pintarLomo(grupo, '#5b4a3a', '#efe6d2');
  return grupo;
}

// Dibuja el lomo: color de fondo, filetes dorados, título en vertical y autor.
export function pintarLomo(grupo, fondo, tinta) {
  const { libro, grosor, alto } = grupo.userData;
  const escala = 2400; // píxeles por metro
  const W = Math.max(64, Math.round(grosor * escala)), H = Math.round(alto * escala);
  const [c, g] = lienzo(W, H);
  g.fillStyle = fondo; g.fillRect(0, 0, W, H);
  ruido(g, W, H, 10);
  // filetes dorados arriba y abajo
  g.fillStyle = '#c9a85a';
  [0.06, 0.075, 0.925, 0.94].forEach((p) => g.fillRect(0, H * p, W, Math.max(2, H * 0.004)));
  g.save();
  g.translate(W / 2, H / 2); g.rotate(Math.PI / 2);
  g.fillStyle = tinta; g.textAlign = 'center'; g.textBaseline = 'middle';
  const titulo = libro.titulo.toUpperCase();
  let tam = Math.min(W * 0.42, 46);
  g.font = `600 ${tam}px Georgia, 'Times New Roman', serif`;
  while (g.measureText(titulo).width > H * 0.62 && tam > 10) { tam -= 1; g.font = `600 ${tam}px Georgia, 'Times New Roman', serif`; }
  const autor = (libro.autores && libro.autores[0]) ? libro.autores[0].split(' ').slice(-1)[0].toUpperCase() : '';
  if (W > 90 && autor) {
    g.fillText(titulo, -H * 0.06, -W * 0.08);
    g.font = `400 ${Math.max(10, tam * 0.55)}px Georgia, serif`;
    g.globalAlpha = 0.85; g.fillText(autor, -H * 0.06, W * 0.22); g.globalAlpha = 1;
  } else {
    g.fillText(titulo, -H * 0.05, 0);
  }
  // pequeño sello de la editorial abajo
  g.restore();
  g.fillStyle = tinta; g.globalAlpha = 0.6;
  g.beginPath(); g.arc(W / 2, H * 0.965, Math.min(W * 0.16, 9), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = grupo.userData.mats.lomoMat;
  if (m.map) m.map.dispose();
  m.map = t; m.needsUpdate = true;
  grupo.userData.mats.tela.color.set(fondo);
}

// Carga la portada real, la pone en la tapa y saca el color del lomo de la propia portada.
const cargador = new THREE.TextureLoader().setCrossOrigin('anonymous');
export async function vestirConPortada(grupo, renderer) {
  const id = await idPortada(grupo.userData.libro);
  if (!id) { grupo.userData.sinPortada = true; tapaGenerica(grupo); return null; }
  return new Promise((ok) => {
    cargador.load(urlPortada(id, 'L'), (tex) => {
      // Open Library devuelve una imagen de 1x1 cuando no tiene portada.
      if (tex.image.width < 10) { tapaGenerica(grupo); ok(null); return; }
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const m = grupo.userData.mats.tapaFrente; m.map = tex; m.color.set(0xffffff); m.needsUpdate = true;
      const [fondo, tinta] = coloresDePortada(tex.image);
      pintarLomo(grupo, fondo, tinta);
      grupo.userData.portadaId = id;
      ok(id);
    }, undefined, () => { tapaGenerica(grupo); ok(null); });
  });
}

function tapaGenerica(grupo) {
  const { libro } = grupo.userData;
  const [c, g] = lienzo(600, 900);
  g.fillStyle = '#5b4a3a'; g.fillRect(0, 0, 600, 900); ruido(g, 600, 900, 10);
  g.strokeStyle = '#c9a85a'; g.lineWidth = 6; g.strokeRect(40, 40, 520, 820);
  g.fillStyle = '#efe6d2'; g.textAlign = 'center';
  g.font = '600 54px Georgia, serif';
  const palabras = libro.titulo.split(' '); const lineas = []; let l = '';
  palabras.forEach((p) => { const prueba = l ? l + ' ' + p : p; if (g.measureText(prueba).width > 460) { lineas.push(l); l = p; } else l = prueba; });
  lineas.push(l);
  lineas.forEach((t, i) => g.fillText(t, 300, 330 + i * 66));
  g.font = '400 32px Georgia, serif'; g.fillText((libro.autores || []).join(', '), 300, 700);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = grupo.userData.mats.tapaFrente; m.map = t; m.needsUpdate = true;
}

// Color medio de la franja izquierda de la portada (la que toca el lomo) y una tinta que contraste.
function coloresDePortada(img) {
  const [c, g] = lienzo(40, 60);
  g.drawImage(img, 0, 0, 40, 60);
  let r = 0, v = 0, a = 0, n = 0;
  try {
    const d = g.getImageData(0, 0, 8, 60).data;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; v += d[i + 1]; a += d[i + 2]; n++; }
  } catch (e) { return ['#5b4a3a', '#efe6d2']; }
  r /= n; v /= n; a /= n;
  // un poco más oscuro y saturado: los lomos de tela suelen serlo
  const k = 0.82;
  const fondo = `rgb(${Math.round(r * k)},${Math.round(v * k)},${Math.round(a * k)})`;
  const lum = 0.2126 * r * k + 0.7152 * v * k + 0.0722 * a * k;
  return [fondo, lum > 140 ? '#1d1712' : '#f3ead8'];
}

// ---------------------------------------------------------------------------
// Mueble: estantes de nogal barnizado. Coloca los libros y devuelve sus posiciones.
// ---------------------------------------------------------------------------
export function montarEstanteria(ctx, libros, { anchoInterior = 0.66, altoHueco = 0.31, estantesMin = 2 } = {}) {
  const { THREE: T, escena, renderer } = ctx;
  const madera = new T.MeshPhysicalMaterial({
    map: texturaMadera(renderer, { repetir: [1, 1] }), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35,
  });
  const maderaV = new T.MeshPhysicalMaterial({
    map: texturaMadera(renderer, { repetir: [1, 1] }), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35,
  });
  maderaV.map.rotation = Math.PI / 2; maderaV.map.center.set(0.5, 0.5);
  const fondoMat = new T.MeshStandardMaterial({ map: texturaMadera(renderer, { base: '#3a2416', claro: '#40281a', oscuro: '#331f12', repetir: [2, 1] }), roughness: 0.75 });

  // Reparto equilibrado en estantes, de arriba abajo y de izquierda a derecha.
  const hueco = 0.0016, margen = 0.035, util = anchoInterior - margen * 2;
  const anchoLibros = libros.reduce((a, g) => a + g.userData.grosor + hueco, 0);
  const nFilas = Math.max(estantesMin, Math.ceil(anchoLibros / (util * 0.92)));
  const porFila = anchoLibros / nFilas;
  const filas = [[]]; let x = 0;
  libros.forEach((g) => {
    const w = g.userData.grosor + hueco;
    const fila = filas[filas.length - 1];
    if (fila.length && (x + w > util || (x + w / 2 > porFila && filas.length < nFilas))) { filas.push([]); x = 0; }
    filas[filas.length - 1].push(g); x += w;
  });
  while (filas.length < estantesMin) filas.push([]);

  const tabla = 0.022, lado = 0.024, fondoMueble = 0.3, zocalo = 0.07;
  const altoTotal = zocalo + filas.length * (altoHueco + tabla) + tabla;
  const anchoTotal = anchoInterior + lado * 2;
  const mueble = new T.Group();
  const caja = (w, h, d, mat, px, py, pz) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; mueble.add(m); return m;
  };
  caja(lado, altoTotal, fondoMueble, maderaV, -anchoTotal / 2 + lado / 2, altoTotal / 2, 0);
  caja(lado, altoTotal, fondoMueble, maderaV, anchoTotal / 2 - lado / 2, altoTotal / 2, 0);
  caja(anchoTotal + 0.03, tabla * 1.4, fondoMueble + 0.025, madera, 0, altoTotal + tabla * 0.7, 0.008); // sombrerete
  caja(anchoInterior, zocalo, fondoMueble - 0.02, fondoMat, 0, zocalo / 2, 0.0);
  caja(anchoInterior, altoTotal, 0.012, fondoMat, 0, altoTotal / 2, -fondoMueble / 2 + 0.006);
  const alturasEstante = [];
  for (let i = 0; i <= filas.length; i++) {
    const y = zocalo + i * (altoHueco + tabla);
    caja(anchoInterior, tabla, fondoMueble - 0.012, madera, 0, y + tabla / 2, 0.004);
    alturasEstante.push(y + tabla);
  }
  escena.add(mueble);

  const laton = new T.MeshStandardMaterial({ color: 0xb08a4a, metalness: 0.9, roughness: 0.32 });
  // Libros: los estantes de arriba primero, ligeras imperfecciones para que no parezcan de catálogo.
  const zFrente = fondoMueble / 2 - 0.012;
  filas.forEach((fila, i) => {
    const yBase = alturasEstante[filas.length - 1 - i];
    let cx = -anchoInterior / 2 + margen;
    fila.forEach((g, j) => {
      const { grosor, alto, fondo, libro } = g.userData;
      const r = azar(libro.id * 3);
      g.position.set(cx + grosor / 2, yBase + alto / 2, zFrente - fondo / 2 - r() * 0.008);
      g.rotation.set(0, (r() - 0.5) * 0.03, (r() - 0.5) * 0.008);
      g.userData.casa = { pos: g.position.clone(), rot: g.rotation.clone() };
      escena.add(g);
      cx += grosor + 0.0016;
    });
    // Sujetalibros de latón al final de cada fila.
    if (fila.length) {
      const sujeta = new T.Group();
      const placa = new T.Mesh(new T.BoxGeometry(0.003, 0.15, 0.11), laton);
      placa.position.set(0.0015, 0.075, 0);
      const pie = new T.Mesh(new T.BoxGeometry(0.075, 0.002, 0.11), laton);
      pie.position.set(-0.035, 0.001, 0);
      [placa, pie].forEach((m) => { m.castShadow = true; m.receiveShadow = true; sujeta.add(m); });
      sujeta.position.set(cx + 0.001, yBase, zFrente - 0.07);
      escena.add(sujeta);
    }
  });

  return { mueble, altoTotal, anchoTotal, alturasEstante, zFrente };
}

// Interpolación suave para las animaciones.
export const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const prefiereQuieto = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function webglDisponible() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
