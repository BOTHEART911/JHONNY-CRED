/* ============================================================
   CREDENCIAL PÚBLICA — JHONNY PERDOMO
   El QR físico codifica:  HTTPS://BOTHEART911.GITHUB.IO/JHONNY-CRED/JPXXXXXXXX
   GitHub Pages sirve 404.html para esa ruta (copia de index.html) y aquí
   sacamos el ID del propio pathname. También sirve  ?i=JPXXXXXXXX

   22/07 — botón "Volver a escanear": abre la cámara DENTRO de la página
   (no navega, no recarga) para revisar tarjeta tras tarjeta al imprimir.
   Motor igual al de JHONNY VOTACIÓN: BarcodeDetector del sistema, y jsQR
   desde CDN como respaldo en iPhone/Safari.

   La CREDENCIAL la ve cualquiera (esa es la gracia del QR). El ESCÁNER
   pide la clave del equipo: se valida en el servidor (nunca viaja aquí)
   y el celular queda habilitado por unos días con un pase firmado.
   ============================================================ */
const API_URL = 'https://script.google.com/macros/s/AKfycbw9CZ9ra6q1KI88M3U9IsYP861JOCFD4-xrV1b0UFYhL1amBjAqTTmtNXi42vwLI_h6Hw/exec';
const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---- ID desde texto (URL de la tarjeta nueva o ID pelado de la vieja) ---- */
function sacarId(txt) {
  const m = String(txt || '').match(/JP[A-Z0-9]{8}/i);
  return m ? m[0].toUpperCase() : '';
}

/* ---- ID desde la URL (ruta o ?i=) ---- */
function idDeUrl() {
  const q = new URLSearchParams(location.search).get('i') || '';
  const fuente = q || decodeURIComponent(location.pathname + location.hash);
  return sacarId(fuente);
}

/* ---- Vistas ---- */
const VISTAS = ['vCargando', 'vOk', 'vReserva', 'vNo', 'vClave', 'vScan'];
let EQUIPO = false;   // ¿hay clave del equipo configurada? lo dice el servidor

function mostrar(id) {
  VISTAS.forEach(v => $('#' + v).classList.toggle('oculto', v !== id));
  const ocupado = id === 'vScan' || id === 'vClave' || id === 'vCargando';
  $('#btnCerrarScan').classList.toggle('oculto', !(id === 'vScan' || id === 'vClave'));
  pintarBoton(ocupado);
}

/* El botón cambia según quién esté mirando:
   - sin clave configurada → no aparece
   - equipo ya habilitado  → "Volver a escanear"
   - cualquier otro        → "Acceso del equipo" (le da identidad y avisa
     que hay clave, sin estorbar a quien solo escaneó por curiosidad) */
function pintarBoton(ocultar) {
  const b = $('#btnScan');
  if (!EQUIPO || ocultar) { b.classList.add('oculto'); return; }
  b.classList.remove('oculto');
  if (paseGuardado()) {
    b.textContent = ultimoId ? 'Volver a escanear' : 'Escanear una tarjeta';
    b.classList.remove('ghost');
  } else {
    b.textContent = 'Acceso del equipo';
    b.classList.add('ghost');
  }
}

function pintarMarca(marca) {
  if (!marca) return;
  EQUIPO = !!marca.equipo;
  if (marca.banner) $('#banner').style.backgroundImage = `url("${marca.banner}")`;
  if (marca.logo) $('#logo').src = marca.logo;
  const cand = marca.candidato || '';
  if (cand) {
    $('#oCandidato').textContent = cand;
    $$('.oCandidato').forEach(e => e.textContent = cand);
    document.title = 'Credencial · ' + cand;
  }
}

function pintarError(titulo, texto, reintentar, neutro) {
  $('#nTitulo').textContent = titulo;
  $('#nTexto').textContent = texto;
  $('#nReintentar').classList.toggle('oculto', !reintentar);
  const sello = $('#nSello');
  sello.classList.toggle('malo', !neutro);
  sello.classList.toggle('aviso', !!neutro);
  mostrar('vNo');
}

/* ============================================================
   CONSULTA AL CORE
   ============================================================ */
let ultimoId = '';

async function cargar(idForzado) {
  const id = (idForzado === undefined ? idDeUrl() : idForzado);
  ultimoId = id;
  mostrar('vCargando');

  try {
    /* Se consulta aun sin código: así la página base también trae banner,
       logo y el nombre del candidato en vez de verse pelada. */
    const url = `${API_URL}?action=qr.credencial&id=${encodeURIComponent(id)}&t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET' });
    const json = await res.json();
    if (!json || !json.ok) throw new Error((json && json.error) || 'Respuesta inválida');

    const d = json.data || {};
    pintarMarca(d.marca);

    if (!id) {
      pintarError('Escanea una tarjeta', 'Aquí verás a quién pertenece la credencial.', false, true);
    } else if (d.encontrada) {
      $('#oNombre').textContent = (d.nombre || '').toLowerCase();
      $('#oDoc').textContent = d.documento ? ('CC ' + d.documento) : '';
      $('#oDoc').classList.toggle('oculto', !d.documento);
      mostrar('vOk');
    } else if (d.motivo === 'RESERVA') {
      mostrar('vReserva');
    } else {
      pintarError('Credencial no válida', 'Este código no corresponde a ninguna credencial registrada.', false);
    }
  } catch (e) {
    pintarError('No pudimos verificar', 'Revisa tu conexión a internet e inténtalo de nuevo.', true);
  }
}

/* ============================================================
   ACCESO DEL EQUIPO
   La clave NO está en esta página: se manda al servidor (por POST, no
   por la URL) y él devuelve un pase firmado que se guarda en el celular.
   Si la clave se cambia en CONFIG, todos los pases dejan de servir.
   ============================================================ */
const LS_PASE = 'cred_pase';
const LS_DEV = 'cred_dev';

function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function leer(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function borrar(k) { try { localStorage.removeItem(k); } catch (e) {} }

function paseGuardado() { return leer(LS_PASE); }

function idDispositivo() {
  let d = leer(LS_DEV);
  if (!d) {
    d = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    guardar(LS_DEV, d);
  }
  return d;
}

async function acceso(cuerpo) {
  const body = Object.assign({ dev: idDispositivo() }, cuerpo);
  const res = await fetch(`${API_URL}?action=cred.acceso`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // evita el preflight de CORS
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json || !json.ok) throw new Error((json && json.error) || 'Respuesta inválida');
  return json.data || {};
}

/* Pulsar el botón: si el celular ya está habilitado va derecho a la
   cámara; si no, se le explica que es del equipo y se le pide la clave. */
async function alPulsarEscanear() {
  const pase = paseGuardado();
  if (!pase) return pedirClave();

  $('#btnScan').textContent = 'Comprobando acceso…';
  try {
    const r = await acceso({ pase });
    if (r.ok) return scanAbrir();
    borrar(LS_PASE);
    pedirClave(r.msg || '');
  } catch (e) {
    pintarBoton(false);
    pintarError('Sin conexión', 'No pudimos comprobar tu acceso. Revisa el internet e inténtalo otra vez.', true);
  }
}

function pedirClave(msg) {
  mostrar('vClave');
  const err = $('#clErr');
  err.textContent = msg || '';
  err.classList.toggle('oculto', !msg);
  const i = $('#clInput');
  i.value = ''; i.classList.remove('mal');
  try { i.focus(); } catch (e) {}
}

async function enviarClave() {
  const i = $('#clInput');
  const clave = i.value.trim();
  const err = $('#clErr');
  if (!clave) { i.classList.add('mal'); return; }

  const btn = $('#clEntrar');
  btn.disabled = true; btn.textContent = 'Comprobando…';
  try {
    const r = await acceso({ clave });
    if (r.ok && r.pase) {
      guardar(LS_PASE, r.pase);
      btn.disabled = false; btn.textContent = 'Entrar';
      return scanAbrir();
    }
    i.classList.remove('mal'); void i.offsetWidth; i.classList.add('mal');
    i.value = '';
    err.textContent = r.msg || 'Clave incorrecta.';
    err.classList.remove('oculto');
  } catch (e) {
    err.textContent = 'No pudimos comprobar la clave. Revisa tu conexión.';
    err.classList.remove('oculto');
  }
  btn.disabled = false; btn.textContent = 'Entrar';
}

/* ============================================================
   ESCÁNER EN LA PÁGINA
   ============================================================ */
const SC = { on: false, stream: null, det: null, raf: null, busy: false };

async function scanAbrir() {
  if (SC.on) return;
  mostrar('vScan');
  $('#scMsg').textContent = 'Pidiendo permiso de cámara…';

  try {
    SC.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (e) {
    scanCerrar();
    pintarError('Sin cámara',
      'El navegador no dio permiso o el equipo no tiene cámara. Revisa el candado de la barra de direcciones y permite la cámara.', false);
    return;
  }

  const video = $('#scVideo');
  video.srcObject = SC.stream;
  try { await video.play(); } catch (e) {}

  try { await prepararDetector(); } catch (e) {
    scanCerrar();
    pintarError('No se pudo iniciar el lector', 'Revisa la conexión y vuelve a intentarlo.', true);
    return;
  }

  SC.on = true;
  $('#scMsg').textContent = 'Apunta la cámara al QR de la tarjeta.';
  loop();
}

function scanCerrar() {
  SC.on = false;
  if (SC.raf) { cancelAnimationFrame(SC.raf); SC.raf = null; }
  if (SC.stream) { SC.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); SC.stream = null; }
  const v = $('#scVideo'); if (v) v.srcObject = null;
  limpiarMarco();
  $('#vScan').querySelector('.cam').classList.remove('leido');
}

/* BarcodeDetector del sistema (Android/Chrome, el más rápido). Si no está,
   jsQR desde CDN (iPhone/Safari). */
async function prepararDetector() {
  if (SC.det) return;
  if ('BarcodeDetector' in window) {
    try {
      const fmts = await window.BarcodeDetector.getSupportedFormats();
      if (fmts.indexOf('qr_code') >= 0) {
        SC.det = { tipo: 'nativo', d: new window.BarcodeDetector({ formats: ['qr_code'] }) };
        return;
      }
    } catch (e) {}
  }
  await cargarJsQR();
  SC.det = { tipo: 'jsqr', canvas: document.createElement('canvas') };
}

function cargarJsQR() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = JSQR_CDN; s.onload = () => res(); s.onerror = () => rej(new Error('jsQR'));
    document.head.appendChild(s);
  });
}

async function leerFrame(video) {
  if (!SC.det) return { raw: '', pts: null, vw: 0, vh: 0 };
  const vw = video.videoWidth, vh = video.videoHeight;

  if (SC.det.tipo === 'nativo') {
    const codes = await SC.det.d.detect(video);
    const c0 = codes && codes[0];
    if (!c0 || !c0.rawValue) return { raw: '', pts: null, vw, vh };
    let pts = null;
    if (c0.cornerPoints && c0.cornerPoints.length === 4) {
      pts = c0.cornerPoints.map(p => ({ x: p.x, y: p.y }));
    } else if (c0.boundingBox) {
      const b = c0.boundingBox;
      pts = [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y },
             { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }];
    }
    return { raw: String(c0.rawValue), pts, vw, vh };
  }

  if (!vw || !vh) return { raw: '', pts: null, vw, vh };
  const c = SC.det.canvas;
  const escala = Math.min(1, 640 / Math.max(vw, vh));
  c.width = Math.round(vw * escala); c.height = Math.round(vh * escala);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  if (!r || !r.data) return { raw: '', pts: null, vw, vh };
  const L = r.location;
  let pts = null;
  if (L && L.topLeftCorner && L.bottomRightCorner) {
    pts = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner]
      .map(p => ({ x: p.x / escala, y: p.y / escala }));
  }
  return { raw: String(r.data), pts, vw, vh };
}

async function loop() {
  if (!SC.on) return;
  const video = $('#scVideo');
  if (video && video.readyState >= 2 && !SC.busy) {
    SC.busy = true;
    try {
      const r = await leerFrame(video);
      pintarMarco(r.pts, r.vw, r.vh);
      if (r.raw) {
        const id = sacarId(r.raw);
        if (id) { SC.busy = false; return acertar(id); }
        $('#scMsg').textContent = 'Ese código no es una credencial. Prueba con otra tarjeta.';
      }
    } catch (e) { /* un fotograma malo no puede tumbar el lector */ }
    SC.busy = false;
  }
  SC.raf = requestAnimationFrame(loop);
}

function acertar(id) {
  const cam = $('#vScan').querySelector('.cam');
  cam.classList.add('leido');
  try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
  pitar();
  setTimeout(() => { scanCerrar(); cargar(id); }, 260);
}

/* Pitido corto sin archivo de sonido: sirve para marcar tarjetas sin mirar. */
function pitar() {
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    const ctx = new A();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.18);
    o.onended = () => { try { ctx.close(); } catch (e) {} };
  } catch (e) {}
}

/* ---- Marco verde sobre el QR detectado ---- */
function pintarMarco(pts, vw, vh) {
  const cv = $('#scMarco');
  const cam = cv.parentElement;
  const W = cam.clientWidth, H = cam.clientHeight;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (!pts || !vw || !vh) return;

  /* el video va con object-fit:cover ⇒ misma cuenta para ubicar los puntos */
  const esc = Math.max(W / vw, H / vh);
  const dx = (W - vw * esc) / 2, dy = (H - vh * esc) / 2;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = p.x * esc + dx, y = p.y * esc + dy;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1E9E6A';
  ctx.shadowColor = 'rgba(30,158,106,.9)'; ctx.shadowBlur = 10;
  ctx.stroke();
}

function limpiarMarco() {
  const cv = $('#scMarco');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
}

/* ============================================================
   ARRANQUE
   ============================================================ */
$('#nReintentar').addEventListener('click', () => cargar(ultimoId));
$('#btnScan').addEventListener('click', alPulsarEscanear);
$('#btnCerrarScan').addEventListener('click', () => { scanCerrar(); cargar(ultimoId); });
$('#clEntrar').addEventListener('click', enviarClave);
$('#clInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarClave(); });

/* si el usuario se va de la pestaña, se suelta la cámara */
document.addEventListener('visibilitychange', () => { if (document.hidden && SC.on) { scanCerrar(); cargar(ultimoId); } });
window.addEventListener('pagehide', scanCerrar);

cargar();
