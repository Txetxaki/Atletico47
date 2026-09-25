/* OsmaGym — función serverless de Vercel: proxy del Coach (MiniMax)
 *
 * GitHub Pages es estático y no tiene servidor, así que cuando la PWA se sirve
 * desde *.github.io, storage-remote.js y app.js apuntan aquí en vez de a
 * /api/coach relativo. Comparte toda la lógica con la Pi a través de
 * coach-core.js: mismo modelo, mismas herramientas, misma validación.
 *
 *   POST /api/coach   <- { messages: [{role, content}, ...] }, cabecera x-coach-code
 *                     -> { texto, acciones }   200
 *                     -> { error }             401 código incorrecto, 503 sin clave, 502/504 si MiniMax falla
 *
 * Variables de entorno (Vercel → Project Settings → Environment Variables):
 *   MINIMAX_API_KEY   clave de la cuenta de MiniMax Token Plan (obligatoria)
 *   COACH_CODE        código que debe mandar el cliente en x-coach-code (recomendado en Vercel: es público)
 *   MINIMAX_MODEL     opcional, por defecto MiniMax-M3
 *   MINIMAX_MAX_TOKENS opcional, por defecto 1500
 */
'use strict';

const { procesarCoach } = require('../coach-core.js');

const ORIGEN_PAGES = 'https://txetxaki.github.io';
const MAX_CUERPO = 512 * 1024;

function origenPermitido(origen) {
 if (!origen) return false;
 if (origen === ORIGEN_PAGES) return true;
 try { return /\.vercel\.app$/.test(new URL(origen).hostname); } catch (_) { return false; }
}

function cors(res, origen) {
 res.setHeader('Access-Control-Allow-Origin', origenPermitido(origen) ? origen : ORIGEN_PAGES);
 res.setHeader('Vary', 'Origin');
 res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-coach-code');
 res.setHeader('Access-Control-Max-Age', '86400');
}

function leerCuerpo(req) {
 return new Promise((resolve, reject) => {
  let total = 0; const trozos = [];
  req.on('data', (d) => { total += d.length; if (total > MAX_CUERPO) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; } trozos.push(d); });
  req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
  req.on('error', reject);
 });
}

module.exports = async function handler(req, res) {
 cors(res, req.headers.origin);
 if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
 if (req.method !== 'POST') {
  res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'método no permitido' }));
  return;
 }

 let cuerpoTexto;
 try { cuerpoTexto = await leerCuerpo(req); }
 catch (e) {
  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'cuerpo demasiado grande' }));
  return;
 }

 const resultado = await procesarCoach({
  cuerpoTexto,
  apiKey: process.env.MINIMAX_API_KEY,
  modelo: process.env.MINIMAX_MODEL,
  maxTokens: Number(process.env.MINIMAX_MAX_TOKENS) || 1500,
  codigoCoach: process.env.COACH_CODE,
  codigoRecibido: req.headers['x-coach-code']
 });
 res.writeHead(resultado.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
 res.end(JSON.stringify(resultado.body));
};
