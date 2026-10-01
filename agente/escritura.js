'use strict';
/* OsmaGym - pure, validated state transformations for the agent's write tools.
 * Nothing here does I/O and nothing mutates its input: every apply* returns a new state,
 * a compact `cambio` (what the tool echoes) and an `inverso` (what deshacer needs).
 * Only two places of the app state can be written: S.cuerpo[] (the weekly body record) and
 * S.notas.comida[] (food notes). Nothing else, and never the coach code. */

const crypto = require('crypto');
const { RANGOS, DEFECTO } = require('./metricas');

const MAX_NOTA = 500;

function hoyMadrid(ahora) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora || new Date());
}

function soloClaves(args, permitidas) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('los argumentos deben ser un objeto');
  Object.keys(args).forEach(k => { if (permitidas.indexOf(k) < 0) throw new Error('argumento no permitido: ' + k); });
}

function fechaValida(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(f + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === f;
}

function validarCuerpo(args, hoy) {
  soloClaves(args, ['fecha'].concat(Object.keys(RANGOS)));
  const f = args.fecha === undefined ? hoy : args.fecha;
  if (!fechaValida(f)) throw new Error('fecha no valida: usa YYYY-MM-DD');
  if (f > hoy) throw new Error('fecha en el futuro: ' + f);
  const campos = {};
  Object.keys(RANGOS).forEach(k => {
    if (args[k] === undefined) return;
    const v = args[k], r = RANGOS[k];
    if (typeof v !== 'number' || !isFinite(v)) throw new Error(k + ' debe ser un numero');
    if (v < r.min || v > r.max) throw new Error(k + ' fuera de rango (' + r.min + '-' + r.max + '): ' + v);
    if (r.entero && !Number.isInteger(v)) throw new Error(k + ' debe ser un entero');
    campos[k] = v;
  });
  if (!Object.keys(campos).length) throw new Error('indica al menos una medida: ' + Object.keys(RANGOS).join(', '));
  if (campos.sis !== undefined && campos.dia !== undefined && campos.sis <= campos.dia) throw new Error('sis debe ser mayor que dia');
  return { f, campos };
}

function aplicarCuerpo(estado, val) {
  const nuevo = structuredClone(estado);
  if (!Array.isArray(nuevo.cuerpo)) nuevo.cuerpo = [];
  let entrada = nuevo.cuerpo.find(m => m && m.f === val.f);
  const creada = !entrada;
  const antes = {}, despues = {}, ausentes = [];
  Object.keys(val.campos).forEach(k => {
    const presente = entrada && Object.prototype.hasOwnProperty.call(entrada, k);
    const previo = creada ? DEFECTO[k] : (presente ? entrada[k] : null);
    if (previo !== val.campos[k]) {
      antes[k] = previo; despues[k] = val.campos[k];
      if (!creada && !presente) ausentes.push(k);
    }
  });
  if (!Object.keys(despues).length) return { estado: nuevo, cambio: { f: val.f, sinCambios: true }, inverso: null };
  if (creada) {
    entrada = Object.assign({ f: val.f }, DEFECTO);
    nuevo.cuerpo.push(entrada);
    nuevo.cuerpo.sort((a, b) => (a.f < b.f ? -1 : 1));
  }
  Object.assign(entrada, despues);
  return {
    estado: nuevo,
    cambio: { f: val.f, creada, antes, despues },
    inverso: { tipo: 'cuerpo', f: val.f, creada, antes, ausentes, puesto: despues }
  };
}

function validarNota(args) {
  soloClaves(args, ['texto']);
  if (typeof args.texto !== 'string') throw new Error('texto debe ser una cadena');
  const texto = args.texto.replace(/[\u0000-\u001f\u007f-\u009f]+/g, m => (/[\n\t\r]/.test(m) ? ' ' : '')).replace(/ {2,}/g, ' ').trim();
  if (!texto) throw new Error('texto vacio');
  if (texto.length > MAX_NOTA) throw new Error('texto demasiado largo (maximo ' + MAX_NOTA + ' caracteres)');
  return { texto };
}

function aplicarNota(estado, val, hoy) {
  const nuevo = structuredClone(estado);
  if (!nuevo.notas || typeof nuevo.notas !== 'object') nuevo.notas = {};
  if (!Array.isArray(nuevo.notas.comida)) nuevo.notas.comida = [];
  const nota = { t: val.texto, f: hoy };
  nuevo.notas.comida.push(nota);
  return { estado: nuevo, cambio: { nota, total: nuevo.notas.comida.length }, inverso: { tipo: 'nota', nota } };
}

function esPristina(e) {
  return Object.keys(e).every(k => k === 'f' || k in DEFECTO) && Object.keys(DEFECTO).every(k => e[k] === DEFECTO[k]);
}

function aplicarInverso(estado, inv) {
  if (!inv || typeof inv !== 'object') throw new Error('inverso no valido');
  const nuevo = structuredClone(estado);
  if (inv.tipo === 'cuerpo') {
    const lista = Array.isArray(nuevo.cuerpo) ? nuevo.cuerpo : [];
    const i = lista.findIndex(m => m && m.f === inv.f);
    if (i < 0) throw new Error('el registro del ' + inv.f + ' ya no existe');
    const e = lista[i];
    Object.keys(inv.puesto).forEach(k => {
      if (e[k] !== inv.puesto[k]) throw new Error(k + ' del ' + inv.f + ' fue cambiado desde entonces; no se deshace');
    });
    Object.keys(inv.antes).forEach(k => { if ((inv.ausentes || []).indexOf(k) >= 0) delete e[k]; else e[k] = inv.antes[k]; });
    if (inv.creada && esPristina(e)) lista.splice(i, 1);
    return { estado: nuevo, cambio: { deshecho: 'cuerpo', f: inv.f, restaurado: inv.antes } };
  }
  if (inv.tipo === 'nota' && inv.nota && typeof inv.nota === 'object') {
    const lista = nuevo.notas && Array.isArray(nuevo.notas.comida) ? nuevo.notas.comida : [];
    let i = -1;
    lista.forEach((n, j) => { if (n && n.t === inv.nota.t && n.f === inv.nota.f) i = j; });
    if (i < 0) throw new Error('la nota ya no existe');
    lista.splice(i, 1);
    return { estado: nuevo, cambio: { deshecho: 'nota', nota: inv.nota } };
  }
  throw new Error('inverso no valido');
}

function hashEstado(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

module.exports = { hoyMadrid, validarCuerpo, aplicarCuerpo, validarNota, aplicarNota, aplicarInverso, hashEstado, MAX_NOTA };
