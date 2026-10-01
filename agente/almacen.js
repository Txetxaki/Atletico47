'use strict';
/* OsmaGym - I/O for the agent's write tools: read the state, PUT it with optimistic `base`,
 * recover from conflicts, and keep the audit log.
 *
 * Why it is built this way (see api-estado.js): the server NEVER rejects a PUT. It stores the
 * write, snapshots it in /api/historial, and only reports `conflicto: true` when the stored
 * version is newer than the `base` we sent. On a conflict the server stores a record-level merge
 * (merge.js), which can bring back records the other writer deleted. So we still recover the other
 * writer's version from the snapshot, re-apply our (small, targeted) change on top of it and PUT
 * again as a fast-forward; if anything fails we restore the other version instead of leaving ours. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashEstado } = require('./escritura');

const CLAVE = 'a47v1';
const DISPOSITIVO = 'agente-entrenador';
const TIMEOUT_MS = 8000;

function rutaAuditoria(env) {
  return (env && env.OSMAGYM_AUDIT) || path.join(__dirname, '..', 'datos', 'agente-auditoria.jsonl');
}

async function pedir(ctx, ruta, init) {
  const res = await ctx.fetchFn(ctx.base + ruta, Object.assign({ signal: AbortSignal.timeout(TIMEOUT_MS) }, init));
  if (res.status === 404 && /\/api\/estado\//.test(ruta)) throw new Error('todavia no hay datos de OsmaGym sincronizados en la Pi: la app aun no ha subido su estado (abrela con Tailscale activo)');
  if (!res.ok) throw new Error('la API de OsmaGym respondio ' + res.status);
  return res.json();
}

function interpretar(cuerpo) {
  const raw = typeof cuerpo.valor === 'string' ? cuerpo.valor : JSON.stringify(cuerpo.valor);
  const valor = JSON.parse(raw);
  if (!valor || typeof valor !== 'object') throw new Error('estado vacio o ilegible');
  return { raw, valor, actualizado: Number(cuerpo.actualizado) || 0 };
}

async function leerCrudo(ctx) {
  return interpretar(await pedir(ctx, '/api/estado/' + CLAVE));
}

function subir(ctx, raw, base) {
  return pedir(ctx, '/api/estado/' + CLAVE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor: raw, actualizado: Math.max(Date.now(), Number(base) + 1), dispositivo: DISPOSITIVO, base })
  });
}

async function buscarSnapshot(ctx, anterior) {
  if (!anterior) return null;
  const lista = await pedir(ctx, '/api/historial/' + CLAVE);
  const h = (Array.isArray(lista) ? lista : []).find(x => x.actualizado === anterior.actualizado && x.dispositivo === anterior.dispositivo);
  return h ? interpretar(await pedir(ctx, '/api/historial/' + CLAVE + '/' + h.id)) : null;
}

function anadirAuditoria(ruta, rec) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.appendFileSync(ruta, JSON.stringify(rec) + '\n');
}

function leerAuditoria(ruta) {
  let txt;
  try { txt = fs.readFileSync(ruta, 'utf8'); } catch (e) { return []; }
  return txt.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(r => r && typeof r === 'object');
}

// Last agent write that has an inverse and was not already undone.
function ultimoDeshacible(ruta) {
  const recs = leerAuditoria(ruta);
  const deshechos = new Set(recs.map(r => r.deshace).filter(Boolean));
  for (let i = recs.length - 1; i >= 0; i--) {
    const r = recs[i];
    if (r.inverso && r.id && !r.deshace && !deshechos.has(r.id)) return r;
  }
  return null;
}

/* transformar(valor) -> { estado, cambio, inverso }. Runs on the current state and, after a
 * conflict, again on the other writer's snapshot. Returns { cambio, conflicto, aviso? }. */
async function escribir(ctx, meta, transformar) {
  const cur = await leerCrudo(ctx);
  const t = transformar(cur.valor);
  if (t.cambio && t.cambio.sinCambios) return { cambio: t.cambio, conflicto: false };
  let final = t, baseRaw = cur.raw, raw = JSON.stringify(t.estado);
  let r = await subir(ctx, raw, cur.actualizado);
  let conflicto = false;
  if (r.conflicto) {
    conflicto = true;
    const snap = await buscarSnapshot(ctx, r.anterior);
    if (!snap) throw new Error('conflicto con otro dispositivo y no se pudo recuperar su version del historial; revisa /api/historial (mi escritura quedo aplicada)');
    const volver = async (motivo) => {
      const rr = await subir(ctx, snap.raw, r.actualizado);
      throw new Error('conflicto con otro dispositivo: ' + motivo + (rr.conflicto ? '; ademas hubo otro cambio, revisa /api/historial' : '; se restauro la version del otro dispositivo'));
    };
    try { final = transformar(snap.valor); } catch (e) { return volver(e.message); }
    if (final.cambio && final.cambio.sinCambios) return volver('mi cambio ya no hace falta');
    baseRaw = snap.raw;
    raw = JSON.stringify(final.estado);
    const r2 = await subir(ctx, raw, r.actualizado);
    if (r2.conflicto) throw new Error('conflicto repetido con otro dispositivo; no reintento. Revisa /api/historial (instantaneas del agente y del otro dispositivo)');
  }
  const rec = Object.assign({
    id: crypto.randomUUID().slice(0, 8), ts: new Date().toISOString(), tool: meta.tool, args: meta.args,
    antes: hashEstado(baseRaw), despues: hashEstado(raw), cambio: final.cambio, inverso: final.inverso || null
  }, meta.extra || {});
  if (conflicto) rec.conflicto = true;
  const out = { cambio: final.cambio, conflicto, id: rec.id };
  try { anadirAuditoria(ctx.auditoria, rec); } catch (e) { out.aviso = 'el cambio se aplico pero no se pudo escribir el log de auditoria: ' + e.message; }
  return out;
}

module.exports = { escribir, leerCrudo, leerAuditoria, ultimoDeshacible, rutaAuditoria, CLAVE, DISPOSITIVO };
