/* Atlético 47 — proxy del Coach
 *
 * La app NO habla con ninguna API de IA directamente: lo hace este proceso,
 * con la clave leída de coach.json (fuera de git). La clave nunca viaja al
 * navegador ni vive en el HTML ni en GitHub.
 *
 *   GET  /api/coach/estado  -> { configurado, proveedor, modelo, error }
 *   POST /api/coach         <- { messages: [{role:'user'|'assistant', content}] }
 *                           -> { texto }   200
 *                           -> { error }   503 sin configurar · 502 si la API falla
 *
 * coach.json admite dos proveedores:
 *
 *   Anthropic (SDK oficial; npm install en la raíz):
 *   { "proveedor": "anthropic", "clave": "sk-ant-...", "modelo": "claude-opus-5" }
 *
 *   Cualquier API compatible con OpenAI (MiniMax, OpenRouter, Groq, Ollama…), sin dependencias:
 *   { "proveedor": "openai", "clave": "...", "modelo": "MiniMax-M2",
 *     "url": "https://api.minimax.io/v1" }
 *
 * También vale ANTHROPIC_API_KEY en el entorno, que manda sobre coach.json.
 */

const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, 'coach.json');
const MAX_CUERPO = 512 * 1024;
const SYSTEM = 'Eres el coach de fuerza y salud de un hombre de 47 años con varias operaciones y artrosis. El primer mensaje del usuario lleva su perfil completo, sus restricciones innegociables y sus datos reales: respétalos siempre. No eres médico ni fisio: deriva cuando toque. Español, sinceridad extrema, sin halagos.';

function cfg() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (_) {}
  const env = process.env.ANTHROPIC_API_KEY;
  const proveedor = env ? 'anthropic' : (c.proveedor || 'anthropic');
  return {
    proveedor,
    clave: env || c.clave,
    modelo: c.modelo || (proveedor === 'anthropic' ? 'claude-opus-5' : ''),
    url: (c.url || '').replace(/\/+$/, ''),
    max_tokens: Number(c.max_tokens) || 1500
  };
}
function estado() {
  const c = cfg();
  if (!c.clave) return { configurado: false, error: 'falta la clave en coach.json' };
  if (c.proveedor === 'anthropic' && !sdk()) return { configurado: false, error: 'falta npm install (@anthropic-ai/sdk)' };
  if (c.proveedor === 'openai' && (!c.url || !c.modelo)) return { configurado: false, error: 'faltan url o modelo en coach.json' };
  return { configurado: true, proveedor: c.proveedor, modelo: c.modelo };
}
function configurado() { return estado().configurado; }

function json(res, codigo, cuerpo) {
  const txt = JSON.stringify(cuerpo);
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(txt), 'Cache-Control': 'no-store' });
  res.end(txt);
}
function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let total = 0; const trozos = [];
    req.on('data', d => { total += d.length; if (total > MAX_CUERPO) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; } trozos.push(d); });
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    req.on('error', reject);
  });
}

let Anthropic = null, sdkProbado = false;
function sdk() {
  if (!sdkProbado) { sdkProbado = true; try { Anthropic = require('@anthropic-ai/sdk'); } catch (_) { Anthropic = null; } }
  return Anthropic;
}

async function preguntarAnthropic(c, messages) {
  const client = new (sdk())({ apiKey: c.clave });
  const r = await client.messages.create({ model: c.modelo, max_tokens: c.max_tokens, system: SYSTEM, messages });
  if (r.stop_reason === 'refusal') return 'No puedo responder a eso. Si es una duda clínica, tu médico.';
  return (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

async function preguntarOpenAI(c, messages) {
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(c.url + '/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.clave },
      body: JSON.stringify({ model: c.modelo, max_tokens: c.max_tokens, messages: [{ role: 'system', content: SYSTEM }].concat(messages) })
    });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    const d = await r.json();
    const m = d.choices && d.choices[0] && d.choices[0].message;
    return m ? (typeof m.content === 'string' ? m.content : (m.content || []).map(x => x.text || '').join('')) : '';
  } finally { clearTimeout(reloj); }
}

async function manejar(req, res, ruta) {
  if (ruta === '/api/coach/estado') return json(res, 200, estado());
  if (req.method !== 'POST') return json(res, 405, { error: 'metodo no permitido' });
  const est = estado();
  if (!est.configurado) return json(res, 503, { error: 'coach no configurado: ' + est.error });

  let cuerpo;
  try { cuerpo = JSON.parse(await leerCuerpo(req)); } catch (e) { return json(res, 400, { error: 'cuerpo no valido' }); }
  const messages = Array.isArray(cuerpo.messages) ? cuerpo.messages : null;
  if (!messages || !messages.length) return json(res, 400, { error: 'faltan messages' });
  for (const m of messages) {
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return json(res, 400, { error: 'mensaje mal formado' });
  }

  const c = cfg();
  try {
    const texto = c.proveedor === 'anthropic' ? await preguntarAnthropic(c, messages) : await preguntarOpenAI(c, messages);
    return json(res, 200, { texto });
  } catch (e) {
    const status = e && e.status;
    console.error('coach:', status || '', e && e.message);
    if (status === 401 || status === 403) return json(res, 502, { error: 'clave de API rechazada' });
    if (status === 429) return json(res, 502, { error: 'límite de la API, prueba en un minuto' });
    if (status === 404) return json(res, 502, { error: 'modelo o url no encontrados' });
    return json(res, 502, { error: 'la API no ha respondido' });
  }
}

module.exports = { manejar, configurado, estado };
