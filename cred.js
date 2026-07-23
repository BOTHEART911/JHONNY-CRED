/* ============================================================
   CREDENCIAL PÚBLICA — JHONNY PERDOMO
   El QR físico codifica:  HTTPS://BOTHEART911.GITHUB.IO/JHONNY-CRED/JPXXXXXXXX
   GitHub Pages sirve 404.html para esa ruta (copia de index.html) y aquí
   sacamos el ID del propio pathname. También sirve  ?i=JPXXXXXXXX
   ============================================================ */
const API_URL = 'https://script.google.com/macros/s/AKfycbw9CZ9ra6q1KI88M3U9IsYP861JOCFD4-xrV1b0UFYhL1amBjAqTTmtNXi42vwLI_h6Hw/exec';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---- ID desde la URL (ruta o ?i=) ---- */
function idDeUrl() {
  const q = new URLSearchParams(location.search).get('i') || '';
  const fuente = q || decodeURIComponent(location.pathname + location.hash);
  const m = String(fuente).match(/JP[A-Z0-9]{8}/i);
  return m ? m[0].toUpperCase() : '';
}

/* ---- Vistas ---- */
function mostrar(id) {
  ['vCargando', 'vOk', 'vReserva', 'vNo'].forEach(v => $('#' + v).classList.toggle('oculto', v !== id));
}

function pintarMarca(marca) {
  if (!marca) return;
  if (marca.banner) $('#banner').style.backgroundImage = `url("${marca.banner}")`;
  if (marca.logo) $('#logo').src = marca.logo;
  const cand = marca.candidato || '';
  if (cand) {
    $('#oCandidato').textContent = cand;
    $$('.oCandidato').forEach(e => e.textContent = cand);
    document.title = 'Credencial · ' + cand;
  }
  if (marca.appUrl) { const a = $('#oApp'); a.href = marca.appUrl; a.classList.remove('oculto'); }
}

function pintarError(titulo, texto, reintentar) {
  $('#nTitulo').textContent = titulo;
  $('#nTexto').textContent = texto;
  $('#nReintentar').classList.toggle('oculto', !reintentar);
  mostrar('vNo');
}

/* ---- Consulta al CORE ---- */
async function cargar() {
  mostrar('vCargando');
  const id = idDeUrl();

  if (!id) {
    pintarError('Credencial no válida', 'Escanea el código QR de la tarjeta para ver a quién pertenece.', false);
    return;
  }

  try {
    const url = `${API_URL}?action=qr.credencial&id=${encodeURIComponent(id)}&t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET' });
    const json = await res.json();
    if (!json || !json.ok) throw new Error((json && json.error) || 'Respuesta inválida');

    const d = json.data || {};
    pintarMarca(d.marca);

    if (d.encontrada) {
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

$('#nReintentar').addEventListener('click', cargar);
cargar();
