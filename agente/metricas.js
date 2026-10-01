'use strict';
/* OsmaGym - single source of truth for body-record fields.
 *
 * RANGOS: accepted range per field when the agent WRITES (see escritura.js). They are the
 * fields of the weekly record S.cuerpo[] that sitio/app.js guardarCuerpo() fills in.
 * DEFECTO: the value the app stores for an untouched field (pain selects default to 0, the
 * rest to null), so an entry the agent creates has the same shape as one made in the app.
 * METRICAS: everything the read tool tendencia_cuerpo can chart, weekly (`cuerpo`),
 * derived, or daily (`hoy`, the "como vienes hoy" answers). */

const RANGOS = {
  peso: { min: 30, max: 250, entero: false },
  cint: { min: 40, max: 200, entero: false },
  sis: { min: 70, max: 260, entero: true },
  dia: { min: 40, max: 160, entero: true },
  sueN: { min: 0, max: 14, entero: false },
  sueS: { min: 0, max: 8, entero: false },
  cig: { min: 0, max: 100, entero: true },
  rodD: { min: 0, max: 10, entero: true },
  rodI: { min: 0, max: 10, entero: true },
  mun: { min: 0, max: 10, entero: true },
  cad: { min: 0, max: 10, entero: true }
};

const DEFECTO = { peso: null, cint: null, rodD: 0, rodI: 0, mun: 0, cad: 0, sueN: null, sueS: null, cig: null, sis: null, dia: null, nota: '' };

const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
const max0 = (...xs) => Math.max(...xs.map(x => num(x) || 0));

// fuente 'cuerpo' = S.cuerpo[] (weekly), 'hoy' = S.hoy{date: {...}} (daily). valor(entry) -> number|null.
const FUENTES = {
  peso: { fuente: 'cuerpo', valor: e => num(e.peso) },
  cint: { fuente: 'cuerpo', valor: e => num(e.cint) },
  sis: { fuente: 'cuerpo', valor: e => num(e.sis) },
  dia: { fuente: 'cuerpo', valor: e => num(e.dia) },
  sueN: { fuente: 'cuerpo', valor: e => num(e.sueN) },
  sueS: { fuente: 'cuerpo', valor: e => num(e.sueS) },
  sueTotal: { fuente: 'cuerpo', valor: e => (num(e.sueN) === null ? null : num(e.sueN) + (num(e.sueS) || 0)) },
  cig: { fuente: 'cuerpo', valor: e => num(e.cig) },
  rodD: { fuente: 'cuerpo', valor: e => num(e.rodD) },
  rodI: { fuente: 'cuerpo', valor: e => num(e.rodI) },
  mun: { fuente: 'cuerpo', valor: e => num(e.mun) },
  cad: { fuente: 'cuerpo', valor: e => num(e.cad) },
  dolorMax: { fuente: 'cuerpo', valor: e => max0(e.rodD, e.rodI, e.cad, e.mun) },
  hoyRod: { fuente: 'hoy', valor: e => num(e.rod) },
  hoySue: { fuente: 'hoy', valor: e => num(e.sue) }
};

const METRICAS = Object.keys(FUENTES);

module.exports = { RANGOS, DEFECTO, METRICAS, FUENTES };
