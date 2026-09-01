/* Atlético 47 — proxy del Coach
 *
 * La app NO habla con la API de Claude directamente: lo hace este proceso,
 * con la clave leída de coach.json (fuera de git) o de ANTHROPIC_API_KEY.
 * Así la clave nunca viaja al navegador ni vive en el HTML.
 *
 *   POST /api/coach   <- { messages: [{role, content}, ...] }
 *                     -> { texto }        200
 *                     -> { error }        503 si no hay clave, 502 si la API falla
 *
 * Instalar la dependencia una vez en la Pi:  npm install   (usa package.json)
 *
 * coach.json:
 *   { "clave": "sk-ant-...", "modelo": "claude-opus-5", "max_tokens": 1500 }
 */

const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, 'coach.json');
const MAX_CUERPO = 512 * 1024;
const SYSTEM = 'Eres el coach de fuerza y salud de un hombre de 47 años con varias operaciones y artrosis. El primer mensaje del usuario lleva su perfil completo, sus restricciones innegociables y sus datos reales: respétalos siempre. No eres médico ni fisio: deriva cuando toque. Español, sinceridad extrema, sin halagos.';

function cfg() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (_) {}
  const clave = process.env.ANTHROPIC_API_KEY || c.clave;
  return { clave, modelo: c.modelo || 'claude-opus-5', max_tokens: Number(c.max_tokens) || 1500 };
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
    req.on('data', d => { total += d.length; if (total > MAX_CUERPO) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; } trozos.push(d); });
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    req.on('error', reject);
  });
}

let Anthropic = null;
function sdk() {
  if (Anthropic) return Anthropic;
  try { Anthropic = require('@anthropic-ai/sdk'); } catch (_) { Anthropic = null; }
  return Anthropic;
}

async function manejar(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'metodo no permitido' });
  const c = cfg();
  if (!c.clave) return json(res, 503, { error: 'coach no configurado: falta la clave en coach.json' });
  const SDK = sdk();
  if (!SDK) return json(res, 503, { error: 'coach no configurado: falta npm install (@anthropic-ai/sdk)' });

  let cuerpo;
  try { cuerpo = JSON.parse(await leerCuerpo(req)); } catch (e) { return json(res, 400, { error: 'cuerpo no valido' }); }
  const messages = Array.isArray(cuerpo.messages) ? cuerpo.messages : null;
  if (!messages || !messages.length) return json(res, 400, { error: 'faltan messages' });
  for (const m of messages) {
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return json(res, 400, { error: 'mensaje mal formado' });
  }

  const client = new SDK({ apiKey: c.clave });
  try {
    const r = await client.messages.create({
      model: c.modelo,
      max_tokens: c.max_tokens,
      system: SYSTEM,
      messages
    });
    if (r.stop_reason === 'refusal') return json(res, 200, { texto: 'No puedo responder a eso. Si es una duda clínica, tu médico.' });
    const texto = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return json(res, 200, { texto });
  } catch (e) {
    const status = e && e.status;
    console.error('coach:', status || '', e && e.message);
    if (status === 401) return json(res, 502, { error: 'clave de API rechazada' });
    if (status === 429) return json(res, 502, { error: 'límite de la API, prueba en un minuto' });
    return json(res, 502, { error: 'la API no ha respondido' });
  }
}

module.exports = { manejar, configurado };
