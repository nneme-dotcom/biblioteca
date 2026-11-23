// Biblioteca 3D: piezas comunes para la estantería del socio y el panel del admin.
// Todo se mide en metros, como en la vida real: un libro mide ~22 cm de alto.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------------------
// Movimiento reducido: se lee en vivo, así si cambiás la preferencia del sistema se respeta al toque.
// ---------------------------------------------------------------------------
const _mqQuieto = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const prefiereQuieto = () => !!(_mqQuieto && _mqQuieto.matches);

// ---------------------------------------------------------------------------
// Texturas de canvas nítidas en pantallas HiDPI. Todas las texturas dibujadas (lomos, placas,
// ficha de préstamo, insignias) pasan por acá: mismo espacio de color, mipmaps y anisotropía.
// Dibujás en píxeles "lógicos" y el canvas real se multiplica por la densidad de la pantalla
// (máximo x2), sin pasarse de maxLado para no reventar la memoria de la GPU.
// ---------------------------------------------------------------------------
export const densidad = () => Math.min(window.devicePixelRatio || 1, 2);

export function lienzoHD(w, h, { maxLado = 2048 } = {}) {
  const f = Math.min(densidad(), maxLado / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * f)); c.height = Math.max(1, Math.round(h * f));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
  return [c, g];
}

// Arma (o refresca) la textura de un canvas con la configuración común.
export function texturaCanvas(c, previa = null, { color = true } = {}) {
  const t = previa && previa.image === c ? previa : new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;                       // three lo recorta al máximo que soporte la placa
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// Contraste WCAG: elegimos tinta oscura o clara según la luminancia relativa del fondo y,
// si ninguna llega a 4.5:1, corremos el fondo un poco hasta que una llegue.
// THREE.Color guarda los colores en lineal, que es justo lo que pide la fórmula de la WCAG.
// ---------------------------------------------------------------------------
export const TINTA_OSCURA = '#120e0a', TINTA_CLARA = '#fbf6ea';
const _col = new THREE.Color(), _blanco = new THREE.Color(1, 1, 1);
const luminancia = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
export const contraste = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
const L_OSCURA = luminancia(new THREE.Color(TINTA_OSCURA)), L_CLARA = luminancia(new THREE.Color(TINTA_CLARA));

export function tintaLegible(fondo, minimo = 4.5) {
  _col.set(fondo);
  for (let i = 0; i < 16; i++) {
    const L = luminancia(_col);
    const cO = contraste(L, L_OSCURA), cC = contraste(L, L_CLARA);
    if (Math.max(cO, cC) >= minimo) return { fondo: '#' + _col.getHexString(), tinta: cO >= cC ? TINTA_OSCURA : TINTA_CLARA };
    // gana la oscura → aclaramos el fondo; gana la clara → lo oscurecemos
    if (cO >= cC) _col.lerp(_blanco, 0.15); else _col.multiplyScalar(0.82);
  }
  return { fondo: '#3a2e24', tinta: TINTA_CLARA };
}

// ---------------------------------------------------------------------------
// Descargas con cola: como mucho 6 a la vez, cada una con 6 s de tope, y caché en memoria.
// Así las 55 portadas no saturan la red ni se quedan colgadas.
// ---------------------------------------------------------------------------
const MAX_DESCARGAS = 6, ESPERA_MAX = 6000;
let descargasActivas = 0;
const enEspera = [];
function enCola(tarea) {
  return new Promise((ok, mal) => { enEspera.push({ tarea, ok, mal }); siguienteDescarga(); });
}
function siguienteDescarga() {
  while (descargasActivas < MAX_DESCARGAS && enEspera.length) {
    const { tarea, ok, mal } = enEspera.shift();
    descargasActivas++;
    Promise.resolve().then(tarea).then(ok, mal).finally(() => { descargasActivas--; siguienteDescarga(); });
  }
}

// Open Library devuelve un pixel transparente de 1x1 cuando no tiene portada; con default=false da 404.
export function sinPixelVacio(url) {
  if (!/openlibrary\.org/.test(url) || /[?&]default=/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'default=false';
}

const imagenes = new Map();
export function cargarImagen(url) {
  const u = sinPixelVacio(url);
  if (!imagenes.has(u)) {
    imagenes.set(u, enCola(() => new Promise((ok, mal) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; img.decoding = 'async';
      const fin = (error) => { clearTimeout(reloj); img.onload = img.onerror = null; if (error) mal(error); else ok(img); };
      const reloj = setTimeout(() => { fin(new Error('La portada tardó demasiado')); img.src = ''; }, ESPERA_MAX);
      img.onload = () => fin(img.width > 2 && img.height > 2 ? null : new Error('Portada vacía'));
      img.onerror = () => fin(new Error('No se pudo bajar la portada'));
      img.src = u;
    })));
  }
  return imagenes.get(u);
}

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
  'cien anos de soledad': 12808734,
  'la casa de los espiritus': 15117595,
  'pedro paramo': 14032826,
  'la ciudad y los perros': 12521098,
  'el amor en los tiempos del colera': 12192837,
  'cronica de una muerte anunciada': 15182511,
  'la tregua': 7993929,
  'los detectives salvajes': 15215334,
  'como agua para chocolate': 10584001,
  'el llano en llamas': 1047470,
  'cuentos de amor de locura y de muerte': 99816,
  'final del juego': 1047767,
  'el libro de arena': 12774154,
  'las cosas que perdimos en el fuego': 15147880,
  'doce cuentos peregrinos': 4923387,
  'historias de cronopios y de famas': 13874898,
  'pajaros en la boca': 14861046,
  'los peligros de fumar en la cama': 13145673,
  'el informe de brodie': 7995065,
  'don quijote de la mancha': 7260092,
  'ana karenina': 12327215,
  'guerra y paz': 1047136,
  'madame bovary': 13500156,
  'orgullo y prejuicio': 15240603,
  'moby dick': 15128534,
  'la metamorfosis': 13209436,
  'el proceso': 12334469,
  'hamlet': 13919410,
  'los miserables': 13482823,
  'fahrenheit 451': 15140929,
  'cronicas marcianas': 13147157,
  '1984': 8745958,
  'un mundo feliz': 14132626,
  'frankenstein': 8078328,
  'dracula': 12216503,
  'el resplandor': 15265008,
  'asesinato en el orient express': 12996484,
  'el sabueso de los baskerville': 14279159,
  'el nombre de la rosa': 12446667,
  'fundacion': 13540538,
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
    const d = await enCola(async () => {
      const r = await fetch('https://openlibrary.org/search.json?' + p, { signal: AbortSignal.timeout(ESPERA_MAX) });
      return r.json();
    });
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

// Grano: trabaja sobre los píxeles reales del canvas (en los HiDPI son más que los lógicos).
function ruido(ctx, w, h, alfa) {
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
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

// Grano de papel (relieve muy fino) para las hojas, la guarda de la contratapa y la ficha.
// Desde three r151 el bumpScale no depende del tamaño del objeto sino de cuánto cambia la textura
// entre píxeles de pantalla: con 0.004 el grano no se ve, por eso el valor queda en una constante.
export const RELIEVE_PAPEL = 0.05;
let _papel;
function bumpPapel() {
  if (_papel) return _papel;
  const [c, g] = lienzo(256, 256);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  ruido(g, 256, 256, 70);
  for (let i = 0; i < 90; i++) { // fibras sueltas
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + Math.random() * 0.08})`;
    g.lineWidth = 0.6; g.beginPath();
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * Math.PI;
    g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke();
  }
  _papel = new THREE.CanvasTexture(c); _papel.wrapS = _papel.wrapT = THREE.RepeatWrapping; _papel.repeat.set(5, 5);
  return _papel;
}

// Latón cepillado: rayas finas horizontales en el color y en la rugosidad (el reflejo se "estira").
function cepillado(ctx, w, h, clara, oscura) {
  for (let i = 0; i < h * 1.4; i++) {
    const y = Math.random() * h, largo = w * (0.25 + Math.random() * 0.75), x = Math.random() * (w - largo);
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? clara : oscura},${0.03 + Math.random() * 0.09})`;
    ctx.fillRect(x, y, largo, 0.6 + Math.random() * 0.9);
  }
}
let _rugLaton;
function rugosidadLaton() {
  if (_rugLaton) return _rugLaton;
  const [c, g] = lienzo(512, 512);
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, 512, 512);    // rugosidad base x0.8 aprox.
  cepillado(g, 512, 512, '255,255,255', '90,90,90');
  _rugLaton = new THREE.CanvasTexture(c); _rugLaton.wrapS = _rugLaton.wrapT = THREE.RepeatWrapping;
  return _rugLaton;
}
export function materialLaton(extra = {}) {
  return new THREE.MeshStandardMaterial({ color: 0xc19a52, metalness: 0.85, roughness: 0.32, roughnessMap: rugosidadLaton(), ...extra });
}

// ---------------------------------------------------------------------------
// Escenario: renderer físicamente correcto, luz cálida de biblioteca, sala y cámara.
// ---------------------------------------------------------------------------
export function crearEscenario(contenedor, { camara = [0, 0.62, 1.55], mira = [0, 0.46, 0], limites = {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  contenedor.appendChild(renderer.domElement);

  // Etiquetas HTML encima del 3D (texto nítido y legible, no dibujado en la escena).
  // La capa entera deja pasar los clics a la escena; solo lo interactivo de adentro los toma.
  const etiquetas = new CSS2DRenderer();
  etiquetas.domElement.className = 'capa-etiquetas';
  etiquetas.domElement.style.pointerEvents = 'none';
  contenedor.appendChild(etiquetas.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x141712);
  escena.fog = new THREE.Fog(0x141712, 2.6, 6);
  // Reflejos realistas (IBL) sin bajar ningún HDR: un "cuarto" virtual prefiltrado con PMREM.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();
  escena.environment = envRT.texture;
  escena.environmentIntensity = 0.55;

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
  // Valores de partida; ajustarSombra() los recalibra cuando ya está montado el mueble o el escritorio.
  foco.shadow.bias = -0.00015; foco.shadow.normalBias = 0.012;
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
  const observador = new ResizeObserver(ajustar);
  observador.observe(contenedor); ajustar();

  const alCuadro = [];
  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05);   // tope: si la pestaña se congela, nada pega un salto
    controles.update();
    alCuadro.forEach((f) => f(dt, reloj.elapsedTime));
    renderer.render(escena, cam);
    etiquetas.render(escena, cam);
  });

  const ctx = { THREE, renderer, escena, cam, controles, foco, alCuadro, envRT, etiquetas, observador };
  // Al irte de la página se libera todo lo de la GPU. Si el navegador la guarda en caché (bfcache)
  // y volvés con "atrás", se recarga para rearmar la escena.
  window.addEventListener('pagehide', () => liberarEscenaWebGL(ctx));
  window.addEventListener('pageshow', (ev) => { if (ev.persisted && ctx.liberada) location.reload(); });
  return ctx;
}

// Libera geometrías, materiales, texturas, el entorno IBL y el renderer.
export function liberarEscenaWebGL(ctx) {
  if (!ctx || ctx.liberada) return;
  ctx.liberada = true;
  ctx.renderer.setAnimationLoop(null);
  if (ctx.observador) ctx.observador.disconnect();
  if (ctx.controles) ctx.controles.dispose();
  const hechos = new Set();
  const soltarTextura = (t) => { if (t && t.isTexture && !hechos.has(t)) { hechos.add(t); t.dispose(); } };
  ctx.escena.traverse((o) => {
    if (o.geometry && !hechos.has(o.geometry)) { hechos.add(o.geometry); o.geometry.dispose(); }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      if (hechos.has(m)) return;
      hechos.add(m);
      Object.values(m).forEach(soltarTextura);
      m.dispose();
    });
  });
  soltarTextura(ctx.escena.background);
  if (ctx.envRT) ctx.envRT.dispose();
  texturasPortada.clear(); imagenes.clear();
  ctx.renderer.dispose();
  if (ctx.etiquetas) ctx.etiquetas.domElement.remove();
}

// Ajusta la cámara de sombras de un foco al objeto que tiene que cubrir (mueble o escritorio):
// el cono de la sombra se cierra justo sobre él (shadow.focus) y el plano cercano se acerca todo
// lo posible. Así el mapa de 2048 px se aprovecha entero: sombras más nítidas, sin acné ni
// "peter-panning". (El plano lejano lo fija three con light.distance; no lo tocamos para no cambiar la luz.)
export function ajustarSombra(luz, objeto, { margen = 1.08, bias = -0.00012, normalBias = 0.01 } = {}) {
  luz.updateMatrixWorld(); luz.target.updateMatrixWorld(); objeto.updateMatrixWorld(true);
  const esfera = new THREE.Box3().setFromObject(objeto).getBoundingSphere(new THREE.Sphere());
  const desde = luz.getWorldPosition(new THREE.Vector3());
  const d = desde.distanceTo(esfera.center), r = esfera.radius * margen;
  const sc = luz.shadow.camera;
  sc.near = Math.max(0.05, d - r);
  if (luz.isSpotLight) {
    const eje = luz.target.getWorldPosition(new THREE.Vector3()).sub(desde).normalize();
    const alCentro = esfera.center.clone().sub(desde).normalize();
    const necesario = Math.acos(THREE.MathUtils.clamp(eje.dot(alCentro), -1, 1)) + Math.asin(Math.min(1, r / d));
    luz.shadow.focus = THREE.MathUtils.clamp(necesario / luz.angle, 0.3, 1);
  }
  sc.updateProjectionMatrix();
  luz.shadow.bias = bias; luz.shadow.normalBias = normalBias;
  luz.shadow.needsUpdate = true;
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

// Para poder abrirlo, la tapa delantera cuelga de una bisagra en el lomo y las hojas están en dos
// montones (el de la derecha, sin leer, y el de la izquierda, ya pasado). Al abrir, las hojas
// vuelan de un montón al otro curvándose como papel, hasta dejar a la vista la contratapa.
// Página con renglones de texto tenue, como un libro de verdad (la última dice FIN).
function texturaPagina() {
  const [c, g] = lienzo(512, 800);
  g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, 512, 800);
  g.fillStyle = 'rgba(40,30,20,0.26)';
  for (let y = 70; y < 560; y += 18) {
    const ancho = y > 540 ? 180 : 400 - (Math.random() < 0.12 ? 120 : 0);
    g.fillRect(56, y, ancho, 7);
  }
  g.font = '400 22px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(40,30,20,0.6)';
  g.fillText('FIN', 256, 640);
  g.font = '400 18px Georgia, serif'; g.fillText('— 237 —', 256, 750);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const matPagina = new THREE.MeshStandardMaterial({ map: texturaPagina(), roughness: 0.95, bumpMap: bumpPapel(), bumpScale: RELIEVE_PAPEL });
const matHoja = new THREE.MeshStandardMaterial({ map: texturaPagina(), roughness: 0.92, side: THREE.DoubleSide, bumpMap: bumpPapel(), bumpScale: RELIEVE_PAPEL });
const N_HOJAS = 16, SEG = 28;

export function crearLibro(libro) {
  const { grosor, alto, fondo } = medidasLibro(libro.id);
  const grupo = new THREE.Group();
  grupo.userData = { libro, grosor, alto, fondo };

  const tela = new THREE.MeshPhysicalMaterial({ color: 0x6b5a48, roughness: 0.72, bumpMap: bumpTela(), bumpScale: 0.6, sheen: 0.4, sheenRoughness: 0.8 });
  const tapaFrente = new THREE.MeshPhysicalMaterial({ color: 0x6b5a48, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const guarda = new THREE.MeshStandardMaterial({ color: 0xd6cfbf, roughness: 0.95, envMapIntensity: 0.4, bumpMap: bumpPapel(), bumpScale: RELIEVE_PAPEL });
  const guardaTapa = new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: 0.9 });
  const P = grosor - TAPA * 2;              // grosor total de las hojas
  const largoHoja = fondo - VUELO, altoHoja = alto - VUELO * 2;

  // Montón derecho (hojas sin pasar): apoyado sobre la contratapa.
  const geoMonton = new THREE.BoxGeometry(1, altoHoja, largoHoja);
  const derecho = new THREE.Mesh(geoMonton, [matPagina, matPagina, matPapelH, matPapelH, tela, matPapelV]);
  derecho.position.z = -VUELO / 2;
  // Montón izquierdo (hojas ya pasadas): crece encima de la tapa abierta.
  const izquierdo = new THREE.Mesh(geoMonton, [matPagina, matPagina, matPapelH, matPapelH, matPapelV, tela]);
  izquierdo.visible = false;

  // Tapa delantera (portada en su cara +x, guarda en la -x) con su bisagra.
  const geoTapa = new THREE.BoxGeometry(TAPA, alto, fondo);
  const delantera = new THREE.Mesh(geoTapa, [tapaFrente, guardaTapa, tela, tela, tela, tela]);
  const bisagraTapa = new THREE.Group();
  bisagraTapa.position.set(grosor / 2, 0, fondo / 2);
  delantera.position.set(-TAPA / 2, 0, -fondo / 2);
  bisagraTapa.add(delantera);

  // Contratapa: en su cara interior (+x) va pegado el bolsillo con la ficha de préstamo.
  const trasera = new THREE.Mesh(geoTapa, [guarda, tela, tela, tela, tela, tela]);
  trasera.position.x = -grosor / 2 + TAPA / 2;

  // Hojas que vuelan: mallas flexibles que se curvan mientras pasan.
  // Las normales se calculan a mano en curvarHoja; la esfera envolvente queda fija y generosa.
  const hojas = [];
  for (let i = 0; i < N_HOJAS; i++) {
    const geo = new THREE.PlaneGeometry(1, 1, SEG, 1);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(alto, fondo) * 1.5);
    const m = new THREE.Mesh(geo, matHoja);
    m.visible = false; m.castShadow = true; m.frustumCulled = false;
    hojas.push(m);
  }

  // Lomo con la etiqueta del título.
  const lomoMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, bumpMap: bumpTela(), bumpScale: 0.4, sheen: 0.3 });
  const lomo = new THREE.Mesh(new THREE.BoxGeometry(grosor, alto, TAPA * 1.2), [tela, tela, tela, tela, lomoMat, tela]);
  lomo.position.z = fondo / 2 - TAPA * 0.6;

  [derecho, izquierdo, delantera, trasera, lomo].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  grupo.add(derecho, izquierdo, bisagraTapa, trasera, lomo, ...hojas);
  grupo.userData.mats = { tela, tapaFrente, lomoMat, guarda };
  // Colores "de verdad" de cada material: las vistas los atenúan multiplicando (filtro, prestados).
  grupo.userData.tonos = { tela: tela.color.clone(), tapa: tapaFrente.color.clone(), lomo: new THREE.Color(0xffffff) };
  grupo.userData.piezas = [derecho, izquierdo, delantera, trasera, lomo];
  grupo.userData.partes = { bisagraTapa, trasera, derecho, izquierdo, hojas, P, largoHoja, altoHoja };
  abrirLibro(grupo, 0);
  pintarLomo(grupo, '#5b4a3a', '#efe6d2');
  return grupo;
}

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const suaveS = (t) => t * t * (3 - 2 * t);
// La tapa se abre con un pequeño rebote al apoyarse, como un cartón de verdad.
const conRebote = (t) => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// Dobla una hoja: ángulo en la bisagra "a" y punta rezagada (curvatura del papel).
// La hoja se curva solo en el plano xz, así que la normal de cada columna sale directo de la
// tangente: si la tangente es (sin θ, 0, −cos θ), la normal es (cos θ, 0, sin θ). Sin
// computeVertexNormals(): todo se resuelve en la misma pasada por los vértices.
const _angs = new Float32Array(SEG + 1);
function curvarHoja(m, hx, z0, a, largo, alto) {
  const u = m.userData;
  if (u.ult && Math.abs(u.ult[0] - hx) < 1e-7 && Math.abs(u.ult[1] - a) < 1e-6) return; // ya estaba así
  u.ult = [hx, a];
  const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
  const puntaRezago = Math.sin(a) * 0.95;            // la punta va detrás de la bisagra a mitad de vuelo
  const paso = largo / SEG;
  for (let j = 0; j < SEG; j++) _angs[j] = a - puntaRezago * Math.pow((j + 0.5) / SEG, 1.6);
  let x = hx, z = z0;
  for (let j = 0; j <= SEG; j++) {
    // tangente en el vértice: promedio de los dos tramos que lo tocan
    const th = j === 0 ? _angs[0] : j === SEG ? _angs[SEG - 1] : (_angs[j - 1] + _angs[j]) / 2;
    const nx = Math.cos(th), nz = Math.sin(th);
    // PlaneGeometry(1,1,SEG,1): fila 0 arriba (y=+0.5), fila 1 abajo; índice = fila*(SEG+1)+j.
    pos.setXYZ(j, x, alto / 2, z); pos.setXYZ(SEG + 1 + j, x, -alto / 2, z);
    nor.setXYZ(j, nx, 0, nz); nor.setXYZ(SEG + 1 + j, nx, 0, nz);
    if (j < SEG) { x += Math.sin(_angs[j]) * paso; z -= Math.cos(_angs[j]) * paso; }
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
}

// Abre el libro según k (0 = cerrado, 1 = abierto hasta la contratapa). Es reversible.
export function abrirLibro(grupo, k) {
  const { grosor, fondo } = grupo.userData;
  const { bisagraTapa, derecho, izquierdo, hojas, P, largoHoja, altoHoja } = grupo.userData.partes;
  // 1) la tapa (con movimiento reducido, sin rebote)
  const kt = clamp01(k / 0.26);
  bisagraTapa.rotation.y = -Math.PI * Math.min(1.0, prefiereQuieto() ? suaveS(kt) : conRebote(kt));
  // 2) las hojas pasan de la derecha a la izquierda (más rápido en el medio, como hojeando)
  const kh = clamp01((k - 0.2) / 0.8);
  const f = suaveS(kh);                                // fracción de hojas ya pasadas
  const baseDer = -grosor / 2 + TAPA, baseIzq = grosor / 2 + TAPA;
  const tR = Math.max(0.00001, P * (1 - f)), tL = P * f;
  derecho.scale.x = tR; derecho.position.x = baseDer + tR / 2; derecho.visible = tR > 0.0002;
  izquierdo.scale.x = Math.max(0.00001, tL); izquierdo.position.set(baseIzq + tL / 2, 0, fondo / 2 + VUELO / 2 + largoHoja / 2);
  izquierdo.visible = tL > 0.0002 && kt > 0.6;
  // Abanico: cada hoja vuela en su ventana de tiempo (desfase escalonado) y apoya un poquito más
  // afuera que la anterior, repartiendo una fracción del grosor del lomo. Al salir, la primera va
  // arriba del montón; al llegar, la última queda arriba. Así no se cruzan ni parpadean (z-fighting).
  const capa = Math.min(0.00025, P / (N_HOJAS * 6));
  hojas.forEach((m, i) => {
    const a0 = i / N_HOJAS * 0.86, dur = 0.24;          // cada hoja vuela en su ventana
    const t = clamp01((kh - a0) / dur);
    m.visible = t > 0 && t < 1;
    if (!m.visible) { m.userData.ult = null; return; }
    const e = suaveS(t);
    const separacion = 0.0002 + capa * THREE.MathUtils.lerp(N_HOJAS - 1 - i, i, e);
    const hx = THREE.MathUtils.lerp(baseDer + tR, baseIzq + tL, e) + separacion;
    curvarHoja(m, hx, fondo / 2 - VUELO * 0.2, Math.PI * e, largoHoja, altoHoja);
  });
  grupo.userData.apertura = k;
}

// Dibuja el lomo: color de fondo, filetes dorados, título en vertical y autor.
// La tinta se elige sola para que el título tenga contraste WCAG ≥ 4.5:1 con el fondo
// (si hace falta, el fondo se aclara u oscurece un toque). "tinta" queda por compatibilidad.
export function pintarLomo(grupo, fondoPedido, tinta) { // eslint-disable-line no-unused-vars
  const { libro, grosor, alto } = grupo.userData;
  const { fondo, tinta: tintaOk } = tintaLegible(fondoPedido);
  tinta = tintaOk;
  // 3000 px por metro lógicos; en pantallas HiDPI el canvas se duplica (lienzoHD), así que de
  // cerca se ve igual de nítido que antes y en pantallas normales gasta menos memoria.
  const escala = 3000;
  const W = Math.max(72, Math.round(grosor * escala)), H = Math.round(alto * escala);
  const [c, g] = lienzoHD(W, H);
  g.fillStyle = fondo; g.fillRect(0, 0, W, H);
  ruido(g, W, H, 8);
  // filetes dorados arriba y abajo
  g.fillStyle = '#d4b066';
  [0.05, 0.064, 0.936, 0.95].forEach((p) => g.fillRect(0, H * p, W, Math.max(3, H * 0.004)));
  const serif = "Georgia, 'Times New Roman', serif";
  const titulo = libro.titulo.toUpperCase();
  const autor = (libro.autores && libro.autores[0]) ? libro.autores[0].split(' ').slice(-1)[0].toUpperCase() : '';
  const dosLineas = W > 107 && autor;
  const largo = H * 0.74;                       // espacio para el título a lo largo del lomo
  let tam = Math.min(W * (dosLineas ? 0.4 : 0.62), 64);
  g.font = `700 ${tam}px ${serif}`;
  while (g.measureText(titulo).width > largo && tam > 10) { tam -= 0.5; g.font = `700 ${tam}px ${serif}`; }
  g.save();
  g.translate(W / 2, H * 0.48); g.rotate(Math.PI / 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // contorno fino del color del fondo: el texto se despega y se lee mejor
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, tam * 0.08); g.strokeStyle = fondo;
  const yTit = dosLineas ? -W * 0.12 : 0;
  g.strokeText(titulo, 0, yTit); g.fillStyle = tinta; g.fillText(titulo, 0, yTit);
  if (dosLineas) {
    g.font = `400 ${Math.max(10, tam * 0.6)}px ${serif}`;
    g.fillText(autor, 0, W * 0.24);   // sin transparencia: la transparencia bajaría el contraste
  }
  g.restore();
  // pequeño sello de la editorial abajo
  g.fillStyle = tinta; g.globalAlpha = 0.6;
  g.beginPath(); g.arc(W / 2, H * 0.972, Math.min(W * 0.14, 9), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;

  const m = grupo.userData.mats.lomoMat;
  if (m.map) m.map.dispose();
  m.map = texturaCanvas(c); m.needsUpdate = true;
  grupo.userData.mats.tela.color.set(fondo);
  if (grupo.userData.tonos) grupo.userData.tonos.tela.set(fondo);
  grupo.userData.tintaLomo = tinta;
}

// Carga la portada real, la pone en la tapa y saca el color del lomo de la propia portada.
// Si no hay portada, falla o tarda más de 6 s, se dibuja una tapa de tela con título y autor:
// ningún libro queda con la tapa negra o vacía.
const texturasPortada = new Map();  // url → Promise<Texture>; libros con la misma portada la comparten
export async function vestirConPortada(grupo, renderer) {
  const id = await idPortada(grupo.userData.libro);
  if (!id) { grupo.userData.sinPortada = true; tapaGenerica(grupo); return null; }
  const url = urlPortada(id, 'L');
  if (!texturasPortada.has(url)) {
    texturasPortada.set(url, cargarImagen(url).then((img) => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;
      return tex;
    }));
  }
  try {
    const tex = await texturasPortada.get(url);
    const m = grupo.userData.mats.tapaFrente; m.map = tex; m.color.set(0xffffff); m.needsUpdate = true;
    if (grupo.userData.tonos) grupo.userData.tonos.tapa.set(0xffffff);
    pintarLomo(grupo, colorDePortada(tex.image));
    grupo.userData.portadaId = id;
    return id;
  } catch (e) {
    grupo.userData.sinPortada = true;
    tapaGenerica(grupo);
    return null;
  }
}

// Tapa de tela hecha a mano: color estable por libro, doble filete dorado, ornamento,
// título en versalitas y autor. El lomo usa el mismo color, con tinta de buen contraste.
const TELAS = ['#5b2a2a', '#2f4a3a', '#283c5c', '#5a4126', '#3d2f4f', '#6b3d1f', '#24474a', '#4a4a2a'];
function tapaGenerica(grupo) {
  const { libro } = grupo.userData;
  const { fondo, tinta } = tintaLegible(TELAS[Math.abs(libro.id || 0) % TELAS.length], 7);
  const W = 600, H = 900;
  const [c, g] = lienzoHD(W, H, { maxLado: 1600 });
  // tela con viñeta suave
  g.fillStyle = fondo; g.fillRect(0, 0, W, H); ruido(g, W, H, 14);
  const vi = g.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H / 2, H * 0.75);
  vi.addColorStop(0, 'rgba(255,255,255,0.06)'); vi.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vi; g.fillRect(0, 0, W, H);
  // doble filete dorado
  g.strokeStyle = '#d4b066'; g.lineWidth = 5; g.strokeRect(34, 34, W - 68, H - 68);
  g.lineWidth = 1.5; g.strokeRect(48, 48, W - 96, H - 96);
  // ornamento: rombo con líneas
  const orn = (y) => {
    g.fillStyle = '#d4b066'; g.beginPath(); g.moveTo(W / 2, y - 9); g.lineTo(W / 2 + 9, y); g.lineTo(W / 2, y + 9); g.lineTo(W / 2 - 9, y); g.closePath(); g.fill();
    g.fillRect(W / 2 - 120, y - 0.75, 100, 1.5); g.fillRect(W / 2 + 20, y - 0.75, 100, 1.5);
  };
  // título partido en líneas que entren
  g.fillStyle = tinta; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  let tam = 58;
  const partir = () => {
    g.font = `700 ${tam}px Georgia, 'Times New Roman', serif`;
    const lineas = []; let l = '';
    libro.titulo.toUpperCase().split(' ').forEach((p) => {
      const prueba = l ? l + ' ' + p : p;
      if (g.measureText(prueba).width > W - 150 && l) { lineas.push(l); l = p; } else l = prueba;
    });
    lineas.push(l);
    return lineas;
  };
  let lineas = partir();
  while ((lineas.length > 4 || lineas.some((x) => g.measureText(x).width > W - 130)) && tam > 30) { tam -= 2; lineas = partir(); }
  const alto = tam * 1.18, y0 = H * 0.42 - ((lineas.length - 1) * alto) / 2;
  orn(y0 - tam - 22);
  lineas.forEach((t, i) => g.fillText(t, W / 2, y0 + i * alto));
  orn(y0 + (lineas.length - 1) * alto + 40);
  g.font = `italic 400 32px Georgia, 'Times New Roman', serif`;
  g.fillText((libro.autores || []).join(', '), W / 2, H * 0.78, W - 140);
  const m = grupo.userData.mats.tapaFrente;
  if (m.map && !m.map.image?.src) m.map.dispose(); // la anterior era de canvas: se libera
  m.map = texturaCanvas(c); m.color.set(0xffffff); m.needsUpdate = true;
  if (grupo.userData.tonos) grupo.userData.tonos.tapa.set(0xffffff);
  pintarLomo(grupo, fondo);
}

// Color medio de la franja izquierda de la portada (la que toca el lomo), un poco más oscuro:
// los lomos de tela suelen serlo. La tinta la elige pintarLomo según el contraste.
function colorDePortada(img) {
  const [, g] = lienzo(40, 60);
  g.drawImage(img, 0, 0, 40, 60);
  let r = 0, v = 0, a = 0, n = 0;
  try {
    const d = g.getImageData(0, 0, 8, 60).data;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; v += d[i + 1]; a += d[i + 2]; n++; }
  } catch (e) { return '#5b4a3a'; }
  r /= n; v /= n; a /= n;
  const k = 0.82;
  return `rgb(${Math.round(r * k)},${Math.round(v * k)},${Math.round(a * k)})`;
}

// ---------------------------------------------------------------------------
// Mueble: estantes de nogal barnizado. Coloca los libros y devuelve sus posiciones.
// ---------------------------------------------------------------------------
export function montarEstanteria(ctx, libros, { anchoInterior = 0.66, altoHueco = 0.31, estantesMin = 2, grupos = null } = {}) {
  const { THREE: T, escena, renderer } = ctx;
  const madera = new T.MeshPhysicalMaterial({
    map: texturaMadera(renderer, { repetir: [1, 1] }), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35,
  });
  const maderaV = new T.MeshPhysicalMaterial({
    map: texturaMadera(renderer, { repetir: [1, 1] }), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35,
  });
  maderaV.map.rotation = Math.PI / 2; maderaV.map.center.set(0.5, 0.5);
  const fondoMat = new T.MeshStandardMaterial({ map: texturaMadera(renderer, { base: '#3a2416', claro: '#40281a', oscuro: '#331f12', repetir: [2, 1] }), roughness: 0.75 });

  // Reparto en estantes. Con "grupos" (géneros) cada grupo empieza en un estante nuevo;
  // si no entra en uno, sigue en el siguiente. Sin grupos, se reparte equilibrado.
  const hueco = 0.0016, margen = 0.035, util = anchoInterior - margen * 2;
  const filas = [], nombres = [];
  const llenar = (lista, nombre, porFila) => {
    let fila = [], x = 0;
    lista.forEach((g) => {
      const w = g.userData.grosor + hueco;
      if (fila.length && (x + w > util || (porFila && x + w / 2 > porFila))) { filas.push(fila); nombres.push(nombre); fila = []; x = 0; }
      fila.push(g); x += w;
    });
    filas.push(fila); nombres.push(nombre);
  };
  if (grupos) {
    grupos.forEach((gr) => llenar(gr.libros, gr.nombre, 0));
  } else {
    const ancho = libros.reduce((a, g) => a + g.userData.grosor + hueco, 0);
    const n = Math.max(estantesMin, Math.ceil(ancho / (util * 0.92)));
    llenar(libros, null, ancho / n);
  }
  while (filas.length < estantesMin) { filas.push([]); nombres.push(null); }

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

  const laton = materialLaton();
  // Libros: los estantes de arriba primero, ligeras imperfecciones para que no parezcan de catálogo.
  const zFrente = fondoMueble / 2 - 0.012;
  const infoFilas = [];
  filas.forEach((fila, i) => {
    const yBase = alturasEstante[filas.length - 1 - i];
    infoFilas.push({ nombre: nombres[i], yBase, yCentro: yBase + altoHueco / 2, libros: fila });
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

  return { mueble, altoTotal, anchoTotal, alturasEstante, zFrente, filas: infoFilas, fondoMueble };
}

// Interpolación suave para las animaciones.
export const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// three r170 solo funciona con WebGL2 (el soporte de WebGL1 se quitó en r163).
export function webglDisponible() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
}

// Aviso accesible cuando no hay 3D: lo anuncia el lector de pantalla y lleva a la vista tradicional.
export function avisoSin3D(el, texto) {
  el.hidden = false;
  el.setAttribute('role', 'alert');
  el.innerHTML = `${texto} <a href="/vista/tradicional">Ir a la vista tradicional</a>`;
}

// ---------------------------------------------------------------------------
// Placa de latón con el nombre grabado (relieve hundido), dos tornillos y biselado.
// ---------------------------------------------------------------------------
export function crearPlaca(nombre, ancho = 0.17, alto = 0.03) {
  const W = 1400, H = Math.round(W * alto / ancho);
  const [c, g] = lienzoHD(W, H);      // color
  const [cb, gb] = lienzoHD(W, H);    // relieve (blanco = alto, negro = hundido)
  const [cr, gr] = lienzoHD(W, H);    // rugosidad: el cepillado estira el reflejo a lo largo
  // Latón cepillado: degradado cálido y miles de rayitas horizontales de largo variable.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#f1d58f'); grad.addColorStop(0.45, '#c9a14e'); grad.addColorStop(1, '#9c7531');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  cepillado(g, W, H, '255,240,200', '80,55,15');
  gr.fillStyle = '#d6d6d6'; gr.fillRect(0, 0, W, H);
  cepillado(gr, W, H, '255,255,255', '110,110,110');
  gb.fillStyle = '#fff'; gb.fillRect(0, 0, W, H);
  // Filete grabado alrededor.
  const m = H * 0.14;
  const grabar = (dibujar) => {
    g.save(); g.translate(-2, -2); g.strokeStyle = g.fillStyle = 'rgba(70,45,10,0.95)'; dibujar(g); g.restore();
    g.save(); g.translate(2, 2); g.strokeStyle = g.fillStyle = 'rgba(255,245,210,0.55)'; dibujar(g); g.restore();
    g.save(); g.strokeStyle = g.fillStyle = '#5a3d10'; dibujar(g); g.restore();
    gb.save(); gb.strokeStyle = gb.fillStyle = '#000'; dibujar(gb); gb.restore();
    // dentro del grabado el metal queda mate (más rugoso)
    gr.save(); gr.strokeStyle = gr.fillStyle = '#ffffff'; dibujar(gr); gr.restore();
  };
  grabar((x) => { x.lineWidth = 5; x.strokeRect(m, m, W - m * 2, H - m * 2); });
  // Texto en versalitas, con espaciado de imprenta.
  const texto = nombre.toUpperCase().split('').join(String.fromCharCode(8202));
  grabar((x) => {
    x.font = `700 ${Math.round(H * 0.5)}px Georgia, 'Times New Roman', serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(texto, W / 2, H / 2 + H * 0.03);
  });
  // Tornillos.
  [m * 2.2, W - m * 2.2].forEach((cx) => {
    const r = H * 0.13;
    const rg = g.createRadialGradient(cx - r / 3, H / 2 - r / 3, 1, cx, H / 2, r);
    rg.addColorStop(0, '#fff3c8'); rg.addColorStop(1, '#7d5a1f');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, H / 2, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a320c'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - r * 0.7, H / 2 - r * 0.3); g.lineTo(cx + r * 0.7, H / 2 + r * 0.3); g.stroke();
    gb.fillStyle = '#000'; gb.beginPath(); gb.arc(cx, H / 2, r * 1.05, 0, Math.PI * 2); gb.stroke();
  });
  const mapa = texturaCanvas(c);
  const relieve = texturaCanvas(cb, null, { color: false });
  const rugosidad = texturaCanvas(cr, null, { color: false });
  const mat = new THREE.MeshStandardMaterial({
    map: mapa, bumpMap: relieve, bumpScale: 1.2, roughnessMap: rugosidad, metalness: 0.85, roughness: 0.32,
  });
  const placa = new THREE.Mesh(new RoundedBoxGeometry(ancho, alto, 0.0035, 3, 0.0012), mat);
  placa.castShadow = true;
  placa.userData.placa = nombre;
  return placa;
}
