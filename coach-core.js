/* OsmaGym — núcleo compartido del Coach (MiniMax, API compatible con Anthropic)
 *
 * Lo usan tanto la función serverless de Vercel (api/coach.js) como el proxy de
 * la Raspberry (api-coach.js): mismo modelo, mismas herramientas, misma
 * validación de cabecera. Sin SDK: fetch a pelo (Node >= 18 lo trae global).
 *
 * Proveedor: MiniMax Token Plan, API compatible con la de Anthropic.
 *   Base:    https://api.minimax.io/anthropic        (env MINIMAX_BASE_URL la sobreescribe)
 *   Ruta:    POST {base}/v1/messages
 *   Cabeceras: x-api-key: <clave>, anthropic-version: 2023-06-01
 *   Modelo:  MiniMax-M3                               (env MINIMAX_MODEL la sobreescribe)
 *   Clave:   env MINIMAX_API_KEY (o coach.json en la Pi)
 *
 * El modelo puede responder con texto y/o "tool_use" (herramientas, ver TOOLS).
 * Este módulo NO aplica nada: solo llama a la API y devuelve {texto, acciones}.
 * Quien valida cada acción contra las reglas reales del plan y la aplica es el
 * cliente (sitio/app.js + sitio/motor.js) — el servidor nunca toca los datos de
 * Osma, solo los lee del contexto que manda el propio cliente en el mensaje.
 */
'use strict';

const crypto = require('crypto');

const BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic';
const MODELO_DEF = process.env.MINIMAX_MODEL || 'MiniMax-M3';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM = [
 'Eres el coach de fuerza y salud de un hombre de 47 años con cinco operaciones y artrosis.',
 'El primer mensaje del usuario lleva su perfil completo, sus restricciones innegociables y sus datos reales: respétalos siempre.',
 'No eres médico ni fisio: deriva cuando toque. Español, sinceridad extrema, sin halagos.',
 'Cuando el cambio sea real (un ejercicio le duele, hay que tocar la semana, marcar una articulación en fase mala, cambiar objetivos de comida, dejar una nota para el futuro, o adelantar la descarga), usa las herramientas en vez de solo describirlo en texto: el cliente valida cada llamada contra las reglas del plan (material, articulaciones, nivel desbloqueado, nunca subir carga en las 4 primeras semanas, nunca tocar el pasado) y la aplica o la rechaza con motivo. Si nada de esto encaja, contesta solo en texto.'
].join(' ');

/* Herramientas al estilo Anthropic (name, description, input_schema). Los
   nombres y argumentos deben coincidir exactamente con los que valida
   coachProcesarAcciones() en sitio/app.js. */
const TOOLS = [
 {
  name: 'sustituir_ejercicio',
  description: 'Cambia un ejercicio por otro disponible (mismo patrón o alternativa marcada). alcance decide si el cambio es permanente, solo para hoy, o para el resto de la semana actual.',
  input_schema: {
   type: 'object',
   properties: {
    original_id: { type: 'string', description: 'id del ejercicio a sustituir, tal como aparece en el contexto' },
    nuevo_id: { type: 'string', description: 'id del ejercicio que lo sustituye' },
    alcance: { type: 'string', enum: ['permanente', 'solo_hoy', 'semana'] },
    motivo: { type: 'string' }
   },
   required: ['original_id', 'nuevo_id', 'alcance']
  }
 },
 {
  name: 'ajustar_ejercicio',
  description: 'Ajusta el peso propuesto (kg) y/o el número de series de un ejercicio concreto para una fecha de hoy en adelante. Nunca para una fecha pasada.',
  input_schema: {
   type: 'object',
   properties: {
    ejercicio_id: { type: 'string' },
    fecha: { type: 'string', description: 'AAAA-MM-DD, hoy o futura; si se omite, hoy' },
    peso_kg: { type: 'number' },
    series: { type: 'integer' },
    motivo: { type: 'string' }
   },
   required: ['ejercicio_id']
  }
 },
 {
  name: 'marcar_articulacion',
  description: 'Marca o desmarca una articulación como "en fase mala": el motor saca del plan los ejercicios que la cargan hasta que se desmarque.',
  input_schema: {
   type: 'object',
   properties: {
    articulacion: { type: 'string', enum: ['rodD', 'rodI', 'cadera', 'munI', 'hombI', 'codoD'] },
    en_fase_mala: { type: 'boolean' },
    motivo: { type: 'string' }
   },
   required: ['articulacion', 'en_fase_mala']
  }
 },
 {
  name: 'ajustar_semana',
  description: 'Mueve o convierte un día concreto de la semana actual (hoy o futuro, sin registrar todavía): por ejemplo pasar un día de fuerza a descanso, o al revés.',
  input_schema: {
   type: 'object',
   properties: {
    fecha: { type: 'string', description: 'AAAA-MM-DD, hoy o futura' },
    tipo: { type: 'string', enum: ['fuerza', 'padel', 'movil'] },
    plantilla: { type: 'string', enum: ['A', 'B'], description: 'solo si tipo es fuerza' },
    motivo: { type: 'string' }
   },
   required: ['fecha', 'tipo']
  }
 },
 {
  name: 'regenerar_semana',
  description: 'Regenera los ejercicios de todas las sesiones de fuerza de la semana actual que aún no se han registrado, con las mismas reglas de disponibilidad de siempre.',
  input_schema: { type: 'object', properties: { motivo: { type: 'string' } } }
 },
 {
  name: 'ajustar_objetivos_comida',
  description: 'Cambia el objetivo orientativo de kcal y/o proteína al día.',
  input_schema: {
   type: 'object',
   properties: {
    kcal: { type: 'integer' },
    proteina_g: { type: 'integer' },
    motivo: { type: 'string' }
   }
  }
 },
 {
  name: 'anadir_nota_plan',
  description: 'Deja una nota corta para que quede en el historial del Coach y se tenga en cuenta en próximas revisiones (tuyas o de Osma).',
  input_schema: {
   type: 'object',
   properties: { texto: { type: 'string' } },
   required: ['texto']
  }
 },
 {
  name: 'programar_descarga',
  description: 'Adelanta la semana de descarga (85% de peso, una serie menos) a la semana actual.',
  input_schema: { type: 'object', properties: { motivo: { type: 'string' } } }
 }
];

class ErrorCoach extends Error {
 constructor(codigoHttp, mensaje) { super(mensaje); this.codigoHttp = codigoHttp; }
}

/* Llama a MiniMax con timeout. Devuelve el JSON de la respuesta o lanza ErrorCoach. */
async function llamarMiniMax({ apiKey, modelo, maxTokens, system, messages, tools, timeoutMs }) {
 const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
 const reloj = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 25000) : null;
 let r;
 try {
  r = await fetch(BASE_URL + '/v1/messages', {
   method: 'POST',
   headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
   body: JSON.stringify({ model: modelo || MODELO_DEF, max_tokens: maxTokens || 1500, system, messages, tools }),
   signal: ctrl ? ctrl.signal : undefined
  });
 } catch (e) {
  if (reloj) clearTimeout(reloj);
  if (e && e.name === 'AbortError') throw new ErrorCoach(504, 'el Coach ha tardado demasiado en responder, prueba otra vez');
  throw new ErrorCoach(502, 'no se ha podido contactar con el Coach: ' + (e && e.message));
 }
 if (reloj) clearTimeout(reloj);
 let cuerpo = null;
 try { cuerpo = await r.json(); } catch (_) { /* respuesta sin JSON válido */ }
 if (!r.ok) {
  if (r.status === 401) throw new ErrorCoach(502, 'clave de MiniMax rechazada');
  if (r.status === 429) throw new ErrorCoach(502, 'límite de la API de MiniMax, prueba en un minuto');
  const msg = (cuerpo && cuerpo.error && (cuerpo.error.message || cuerpo.error)) || ('HTTP ' + r.status);
  throw new ErrorCoach(502, 'la API de MiniMax no ha respondido bien: ' + msg);
 }
 return cuerpo;
}

/* Extrae texto y llamadas a herramientas de una respuesta con forma Anthropic. */
function extraer(respuesta) {
 const bloques = (respuesta && respuesta.content) || [];
 const texto = bloques.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
 const acciones = bloques.filter(function (b) { return b.type === 'tool_use'; }).map(function (b) { return { id: b.id, name: b.name, input: b.input || {} }; });
 const rehusado = respuesta && respuesta.stop_reason === 'refusal';
 return { texto: texto, acciones: acciones, rehusado: rehusado };
}

/* Comparación en tiempo constante. timingSafeEqual exige la misma longitud, así
   que comparamos siempre contra un hash de longitud fija: así una clave más
   corta o más larga tampoco se distingue por el tiempo de respuesta. */
function compararSeguro(a, b) {
 const ha = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
 const hb = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
 try { return crypto.timingSafeEqual(ha, hb); } catch (_) { return false; }
}

/* Punto de entrada único para ambos adaptadores (Vercel y Pi). Recibe el cuerpo
   crudo de la petición (string) y la configuración ya resuelta, y devuelve
   {status, body} listo para escribir en la respuesta HTTP. */
async function procesarCoach({ cuerpoTexto, apiKey, modelo, maxTokens, codigoCoach, codigoRecibido }) {
 if (!apiKey) return { status: 503, body: { error: 'coach no configurado: falta la clave de MiniMax (MINIMAX_API_KEY)' } };
 if (codigoCoach) {
  if (!codigoRecibido || !compararSeguro(codigoRecibido, codigoCoach)) {
   return { status: 401, body: { error: 'código del Coach incorrecto' } };
  }
 }
 let cuerpo;
 try { cuerpo = JSON.parse(cuerpoTexto); } catch (e) { return { status: 400, body: { error: 'cuerpo no válido' } }; }
 const messages = Array.isArray(cuerpo.messages) ? cuerpo.messages : null;
 if (!messages || !messages.length) return { status: 400, body: { error: 'faltan messages' } };
 for (const m of messages) {
  if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
   return { status: 400, body: { error: 'mensaje mal formado' } };
  }
 }
 try {
  const r = await llamarMiniMax({ apiKey, modelo, maxTokens, system: SYSTEM, messages, tools: TOOLS });
  const ex = extraer(r);
  if (ex.rehusado) return { status: 200, body: { texto: 'No puedo responder a eso. Si es una duda clínica, tu médico.', acciones: [] } };
  return { status: 200, body: { texto: ex.texto, acciones: ex.acciones } };
 } catch (e) {
  const codigo = (e && e.codigoHttp) || 502;
  return { status: codigo, body: { error: (e && e.message) || 'la API no ha respondido' } };
 }
}

module.exports = { SYSTEM, TOOLS, ErrorCoach, llamarMiniMax, extraer, procesarCoach, compararSeguro, BASE_URL, MODELO_DEF };
