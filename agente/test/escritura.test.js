'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../escritura');
const { RANGOS } = require('../metricas');
const { estado, HOY } = require('./fixtures');

test('hoyMadrid: Madrid calendar date, not UTC', () => {
  assert.equal(W.hoyMadrid(new Date('2026-09-30T22:30:00Z')), '2026-10-01');
  assert.equal(W.hoyMadrid(new Date('2026-09-30T10:00:00Z')), '2026-09-30');
});

test('validarCuerpo: accepts known fields, defaults date to today', () => {
  assert.deepEqual(W.validarCuerpo({ peso: 78.5, rodD: 4 }, HOY), { f: HOY, campos: { peso: 78.5, rodD: 4 } });
  assert.equal(W.validarCuerpo({ fecha: '2026-09-20', sueN: 5 }, HOY).f, '2026-09-20');
});
test('validarCuerpo: ranges come from RANGOS and are strict', () => {
  Object.keys(RANGOS).forEach(k => {
    assert.throws(() => W.validarCuerpo({ [k]: RANGOS[k].max + 1 }, HOY), /fuera de rango/, k);
    assert.throws(() => W.validarCuerpo({ [k]: RANGOS[k].min - 1 }, HOY), /fuera de rango/, k);
  });
  assert.throws(() => W.validarCuerpo({ rodD: 2.5 }, HOY), /entero/);
  assert.throws(() => W.validarCuerpo({ cig: 3.5 }, HOY), /entero/);
  assert.throws(() => W.validarCuerpo({ peso: '80' }, HOY), /numero/);
  assert.throws(() => W.validarCuerpo({ peso: NaN }, HOY), /numero/);
});
test('validarCuerpo: unknown fields, bad dates, empty input, bad tension pair', () => {
  assert.throws(() => W.validarCuerpo({ peso: 80, nota: 'x' }, HOY), /no permitido/);
  assert.throws(() => W.validarCuerpo({ peso: 80, codigo: 'x' }, HOY), /no permitido/);
  assert.throws(() => W.validarCuerpo({}, HOY), /al menos una/);
  assert.throws(() => W.validarCuerpo({ fecha: '2026-02-30', peso: 80 }, HOY), /fecha/);
  assert.throws(() => W.validarCuerpo({ fecha: '2026-10-01', peso: 80 }, HOY), /futuro/);
  assert.throws(() => W.validarCuerpo({ sis: 80, dia: 90 }, HOY), /sis/);
  assert.throws(() => W.validarCuerpo(null, HOY), /objeto/);
  assert.throws(() => W.validarCuerpo([], HOY), /objeto/);
});

test('aplicarCuerpo: updates an existing day touching only the given fields, input untouched', () => {
  const e = estado(), copia = structuredClone(e);
  const r = W.aplicarCuerpo(e, { f: '2026-09-29', campos: { peso: 78.4, cig: 5 } });
  assert.deepEqual(e, copia);
  assert.deepEqual(r.cambio, { f: '2026-09-29', creada: false, antes: { peso: 79, cig: 8 }, despues: { peso: 78.4, cig: 5 } });
  const ent = r.estado.cuerpo[2];
  assert.equal(ent.peso, 78.4); assert.equal(ent.cig, 5); assert.equal(ent.cint, 92); assert.equal(ent.sueN, 5.5);
  assert.equal(r.estado.cuerpo.length, 3);
  assert.deepEqual(r.estado.hist, e.hist);
});
test('aplicarCuerpo: creates a full app-shaped entry, kept sorted', () => {
  const r = W.aplicarCuerpo(estado(), { f: '2026-09-20', campos: { sueN: 6, rodD: 3 } });
  assert.deepEqual(r.estado.cuerpo.map(c => c.f), ['2026-09-01', '2026-09-15', '2026-09-20', '2026-09-29']);
  assert.deepEqual(r.estado.cuerpo[2], { f: '2026-09-20', peso: null, cint: null, rodD: 3, rodI: 0, mun: 0, cad: 0, sueN: 6, sueS: null, cig: null, sis: null, dia: null, nota: '' });
  assert.equal(r.cambio.creada, true);
  assert.deepEqual(r.cambio.antes, { sueN: null, rodD: 0 });
});
test('aplicarCuerpo: identical values are a no-op', () => {
  const r = W.aplicarCuerpo(estado(), { f: '2026-09-29', campos: { peso: 79, rodD: 2 } });
  assert.deepEqual(r.cambio, { f: '2026-09-29', sinCambios: true });
  assert.equal(r.inverso, null);
});
test('aplicarCuerpo: works on a state with no cuerpo list', () => {
  const r = W.aplicarCuerpo({}, { f: HOY, campos: { peso: 80 } });
  assert.equal(r.estado.cuerpo.length, 1);
});

test('validarNota: cleans control chars and spaces, caps length, only text allowed', () => {
  assert.deepEqual(W.validarNota({ texto: '  no me\u0000 gusta   el pescado\n ' }), { texto: 'no me gusta el pescado' });
  assert.throws(() => W.validarNota({ texto: '' }), /vacio/);
  assert.throws(() => W.validarNota({ texto: 'x'.repeat(501) }), /largo/);
  assert.throws(() => W.validarNota({ texto: 3 }), /cadena/);
  assert.throws(() => W.validarNota({ texto: 'a', tipo: 'general' }), /no permitido/);
});
test('aplicarNota: appends {t,f} to notas.comida only', () => {
  const r = W.aplicarNota(estado(), { texto: 'cena ligera' }, HOY);
  assert.deepEqual(r.estado.notas.comida, [{ t: 'cena ligera', f: HOY }]);
  assert.deepEqual(r.cambio, { nota: { t: 'cena ligera', f: HOY }, total: 1 });
  assert.deepEqual(W.aplicarNota({}, { texto: 'x' }, HOY).estado.notas.comida.length, 1);
});

test('aplicarInverso: undoes an update, restoring only what the agent changed', () => {
  const e = estado();
  const r = W.aplicarCuerpo(e, { f: '2026-09-29', campos: { peso: 70 } });
  r.estado.cuerpo[2].cint = 90;   // the user changed another field meanwhile
  const u = W.aplicarInverso(r.estado, r.inverso);
  assert.equal(u.estado.cuerpo[2].peso, 79);
  assert.equal(u.estado.cuerpo[2].cint, 90);
});
test('aplicarInverso: undoing a creation removes the pristine entry, keeps an edited one', () => {
  const r = W.aplicarCuerpo(estado(), { f: '2026-09-20', campos: { sueN: 6 } });
  assert.deepEqual(W.aplicarInverso(r.estado, r.inverso).estado, estado());
  r.estado.cuerpo[2].peso = 80;
  const u = W.aplicarInverso(r.estado, r.inverso);
  assert.equal(u.estado.cuerpo[2].peso, 80);
  assert.equal(u.estado.cuerpo[2].sueN, null);
});
test('aplicarInverso: refuses when the user changed that same value, or the entry vanished', () => {
  const r = W.aplicarCuerpo(estado(), { f: '2026-09-29', campos: { peso: 70 } });
  r.estado.cuerpo[2].peso = 75;
  assert.throws(() => W.aplicarInverso(r.estado, r.inverso), /cambiad/);
  r.estado.cuerpo.splice(2, 1);
  assert.throws(() => W.aplicarInverso(r.estado, r.inverso), /ya no existe/);
});
test('aplicarInverso: undoes a note, refuses if gone, rejects garbage', () => {
  const r = W.aplicarNota(estado(), { texto: 'a' }, HOY);
  assert.deepEqual(W.aplicarInverso(r.estado, r.inverso).estado.notas.comida, []);
  assert.throws(() => W.aplicarInverso(estado(), r.inverso), /ya no existe/);
  assert.throws(() => W.aplicarInverso(estado(), { tipo: 'otro' }), /inverso/);
  assert.throws(() => W.aplicarInverso(estado(), null), /inverso/);
});
test('hashEstado: stable sha256 hex', () => {
  assert.equal(W.hashEstado('a'), 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
});
