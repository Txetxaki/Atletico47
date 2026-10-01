'use strict';
/* OsmaGym - record-level merge of two app states (pure, no I/O).
 *
 * Used by api-estado.js only when a PUT arrives from a STALE base, i.e. a real conflict between two
 * devices that both changed the state since they last synced. A fast-forward write never goes
 * through here: it is stored verbatim, so deletions keep working.
 *
 * Identity per field, decided from how sitio/app.js and sitio/motor.js write each one:
 *  - hist, padel, cuerpo: ONE record per date (sesDe/padelDe/cuerpoDe replace by `f`), keyed by `f`.
 *  - comidas, notas.comida: several records share a date, so they are keyed by the record content
 *    (keying them by date would silently drop a meal or a note).
 *  - coachLog: several entries per date, and an entry changes state in place (propuesta -> aplicado,
 *    deshacer), so it is keyed by (f, accion, input), the part that never changes. Newest first.
 *  - movil: a set of dates (strings), unioned.
 *  - hoy: an OBJECT MAP date -> {rod, sue, padel}; unioned by date.
 *  - any other array of objects that all carry an `id` is keyed by `id`.
 * When the same identity exists on both sides, the record (or map value) from the newer blob wins whole.
 *
 * Everything else (perfil, cfg, equipo, artic, coachCfg, platos, plan, regen, ejCustom, ui, scalars)
 * is taken whole from the newer blob: plan/regen are this week's schedule, where removing an
 * adjustment must stick. Fields only the older blob has are kept.
 * Order: the newer blob's order, unseen older records appended; if both sides were sorted by date in
 * the field's natural direction, the result is sorted that way (stable).
 * Never throws: on garbage input the newer blob is returned as is.
 */

const POR_FECHA = ['hist', 'padel', 'cuerpo'];   // one record per date
const MAPAS = ['hoy'];                            // date -> value maps
const CONJUNTOS = ['movil'];                      // sets of dates
const CONTENEDORES = ['notas'];                   // objects whose inner arrays are logs too
const DESCENDENTE = ['coachLog'];                 // newest first (unshift)

function esObjeto(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

// Stable, key-sorted serialisation so content identity does not depend on key order.
function canonico(x) {
  if (Array.isArray(x)) return '[' + x.map(canonico).join(',') + ']';
  if (esObjeto(x)) return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonico(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}

const fechaDe = (r) => (typeof r === 'string' ? r : r.f);

function ordenado(arr, desc) {
  for (let i = 0; i < arr.length; i++) {
    if (typeof fechaDe(arr[i]) !== 'string') return false;
    if (i > 0 && (desc ? fechaDe(arr[i - 1]) < fechaDe(arr[i]) : fechaDe(arr[i - 1]) > fechaDe(arr[i]))) return false;
  }
  return true;
}

// Returns the identity function for a pair of arrays, or null when they are not mergeable logs.
function claveDe(campo, viejo, nuevo) {
  const todos = viejo.concat(nuevo);
  if (!todos.length) return null;
  if (CONJUNTOS.indexOf(campo) >= 0) return todos.every(r => typeof r === 'string') ? r => r : null;
  if (!todos.every(esObjeto)) return null;
  const conFecha = todos.every(r => typeof r.f === 'string');
  if (POR_FECHA.indexOf(campo) >= 0 && conFecha) return r => 'f:' + r.f;
  if (campo === 'coachLog' && conFecha) return r => 'l:' + r.f + ':' + canonico(r.accion) + ':' + canonico(r.input);
  if (todos.every(r => typeof r.id === 'string' || typeof r.id === 'number')) return r => 'id:' + typeof r.id + ':' + r.id;
  if (conFecha) return r => 'c:' + canonico(r);
  return null;
}

function unir(campo, viejo, nuevo) {
  const clave = claveDe(campo, viejo, nuevo);
  if (!clave) return nuevo;
  const vistos = new Set(nuevo.map(clave));
  const out = nuevo.slice();
  viejo.forEach(r => { const k = clave(r); if (!vistos.has(k)) { vistos.add(k); out.push(r); } });
  const desc = DESCENDENTE.indexOf(campo) >= 0;
  if (ordenado(viejo, desc) && ordenado(nuevo, desc)) {
    // Array.prototype.sort is stable, so equal dates keep the newer-first order built above.
    out.sort((a, b) => { const x = fechaDe(a), y = fechaDe(b), c = x < y ? -1 : x > y ? 1 : 0; return desc ? -c : c; });
  }
  return out;
}

function unirMapa(viejo, nuevo) {
  const out = Object.assign({}, nuevo);
  Object.keys(viejo).forEach(k => { if (!(k in out)) out[k] = viejo[k]; });
  return out;
}

function unirCampo(campo, viejo, nuevo) {
  if (Array.isArray(viejo) && Array.isArray(nuevo)) return unir(campo, viejo, nuevo);
  if (MAPAS.indexOf(campo) >= 0 && esObjeto(viejo) && esObjeto(nuevo)) return unirMapa(viejo, nuevo);
  if (CONTENEDORES.indexOf(campo) >= 0 && esObjeto(viejo) && esObjeto(nuevo)) {
    const out = {};
    Object.keys(nuevo).forEach(k => { out[k] = Array.isArray(viejo[k]) && Array.isArray(nuevo[k]) ? unir(campo + '.' + k, viejo[k], nuevo[k]) : nuevo[k]; });
    Object.keys(viejo).forEach(k => { if (!(k in out)) out[k] = viejo[k]; });
    return out;
  }
  return nuevo;
}

/* fusionar(almacenado, entrante, { entranteMasNuevo }) -> merged state (a new object; inputs untouched). */
function fusionar(almacenado, entrante, opciones) {
  const entranteGana = !opciones || opciones.entranteMasNuevo !== false;
  const nuevo = entranteGana ? entrante : almacenado;
  const viejo = entranteGana ? almacenado : entrante;
  try {
    if (!esObjeto(nuevo) || !esObjeto(viejo)) return nuevo;
    const out = {};
    Object.keys(nuevo).forEach(k => { out[k] = k in viejo ? unirCampo(k, viejo[k], nuevo[k]) : nuevo[k]; });
    Object.keys(viejo).forEach(k => { if (!(k in out)) out[k] = viejo[k]; });
    return out;
  } catch (e) {
    return nuevo;
  }
}

module.exports = { fusionar };
