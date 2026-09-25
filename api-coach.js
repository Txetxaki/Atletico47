/* OsmaGym — proxy del Coach (MiniMax) para la Raspberry
 *
 * La app NO habla con la API de MiniMax directamente: lo hace este proceso, con
 * la clave leída de coach.json (fuera de git) o de MINIMAX_API_KEY. Así la clave
 * nunca viaja al navegador ni vive en el HTML. Comparte toda la lógica con la
 * función de Vercel a través de coach-core.js: mismo modelo, mismas
 * herramientas, misma validación de código.
 *
 *   POST /api/coach   <- { messages: [{role, content}, ...] }
 *                        cabecera x-coach-code, solo si coach.json trae "codigo"
 *                     -> { texto, acciones }   200
 *                     -> { error }             401 código incorrecto, 503 sin clave, 502/504 si MiniMax falla
 *
 * coach.json (fuera de git):
 *   { "clave": "...", "modelo": "MiniMax-M3", "max_tokens": 1500, "codigo": "" }
 * "codigo" es opcional: si se deja vacío, la Pi no exige x-coach-code (ya está
 * detrás de Tailscale). En Vercel, público, el código SÍ es obligatorio.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { procesarCoach } = require('./coach-core.js');

const CFG = path.join(__dirname, 'coach.json');
const MAX_CUERPO = 512 * 1024;

function cfg() {
 let c = {};
 try { c = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (_) { /* sin coach.json: coach sin configurar */ }
 return {
  clave: process.env.MINIMAX_API_KEY || c.clave,
  modelo: process.env.MINIMAX_MODEL || c.modelo,
  max_tokens: Number(process.env.MINIMAX_MAX_TOKENS || c.max_tokens) || 1500,
  codigo: process.env.COACH_CODE || c.codigo || ''
 };
}
function configurado() { return !!cfg().clave; }

function json(res, codigo, cuerpo) {
 const txt = JSON.stringify(cuerpo);
 res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(txt), 'Cache-Control': 'no-store' });
 res.end(txt);
}
function leerCuerpo(req) {
 return new Promise((resolve, reject) => {
  let total = 0; const trozos = [];
  req.on('data', (d) => { total += d.length; if (total > MAX_CUERPO) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; } trozos.push(d); });
  req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
  req.on('error', reject);
 });
}

async function manejar(req, res) {
 if (req.method !== 'POST') return json(res, 405, { error: 'metodo no permitido' });
 const c = cfg();
 let cuerpoTexto;
 try { cuerpoTexto = await leerCuerpo(req); } catch (e) { return json(res, 400, { error: 'cuerpo demasiado grande' }); }
 const resultado = await procesarCoach({
  cuerpoTexto,
  apiKey: c.clave,
  modelo: c.modelo,
  maxTokens: c.max_tokens,
  codigoCoach: c.codigo,
  codigoRecibido: req.headers['x-coach-code']
 });
 return json(res, resultado.status, resultado.body);
}

module.exports = { manejar, configurado };
