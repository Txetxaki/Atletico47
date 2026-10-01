'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../analisis');
const { METRICAS } = require('../metricas');
const { estado, HOY, NOMBRES } = require('./fixtures');

const O = { hoy: HOY, nombres: NOMBRES };

test('diasSinEntrenar: strength, padel and anything, ignoring nothing but "X" for strength', () => {
  assert.deepEqual(A.diasSinEntrenar(estado(), O), {
    fuerza: { dias: 2, ultima: '2026-09-28' },
    padel: { dias: 6, ultima: '2026-09-24' },
    cualquiera: { dias: 2, ultima: '2026-09-28' }
  });
});
test('diasSinEntrenar: an X session counts as activity but not as strength', () => {
  const e = estado();
  e.hist = e.hist.filter(h => h.f !== '2026-09-28');
  e.hist.push({ f: '2026-09-29', s: 'X', ej: [] });
  const r = A.diasSinEntrenar(e, O);
  assert.deepEqual(r.fuerza, { dias: 9, ultima: '2026-09-21' });
  assert.deepEqual(r.cualquiera, { dias: 1, ultima: '2026-09-29' });
});
test('diasSinEntrenar: empty state gives nulls', () => {
  assert.deepEqual(A.diasSinEntrenar({ hist: [], padel: [] }, O), {
    fuerza: { dias: null, ultima: null }, padel: { dias: null, ultima: null }, cualquiera: { dias: null, ultima: null }
  });
  assert.equal(A.diasSinEntrenar({}, O).fuerza.dias, null);
});

test('adherencia: strength and padel per week, current week only up to today', () => {
  const r = A.adherencia(estado(), { semanas: 3 }, O);
  assert.deepEqual(r.semanas.map(s => [s.lunes, s.fuerza.planificadas, s.fuerza.hechas, s.padel.planificados, s.padel.jugados, s.padel.minutos]), [
    ['2026-09-14', 2, 2, 2, 1, 90],
    ['2026-09-21', 2, 1, 2, 2, 180],
    ['2026-09-28', 1, 1, 1, 0, 0]
  ]);
  assert.equal(r.semanas[2].enCurso, true);
  assert.deepEqual(r.fuerza, { hechas: 4, planificadas: 5, porcentaje: 80 });
  assert.deepEqual(r.padel, { jugados: 3, planificados: 5, porcentaje: 60 });
});
test('adherencia: X sessions do not count as strength', () => {
  const r = A.adherencia(estado(), { semanas: 2 }, O);
  assert.equal(r.semanas[1].fuerza.hechas, 1);   // week of 09-21 has an X on 09-23
});
test('adherencia: streak counts completed weeks, skipping an unfinished current week', () => {
  const e = estado();
  e.hist.push({ f: '2026-09-25', s: 'B', ej: [] });
  assert.equal(A.adherencia(e, { semanas: 3 }, O).racha, 3);
  assert.equal(A.adherencia(estado(), { semanas: 3 }, O).racha, 1);   // week of 09-21 broke it; current week is complete so far
});
test('adherencia: summer turns padel planning off; cfg.creado bounds the plan; plan overrides win', () => {
  const e = estado();
  e.cfg.verano = true;
  assert.equal(A.adherencia(e, { semanas: 3 }, O).padel.planificados, 0);
  const e2 = estado();
  e2.cfg.creado = '2026-09-28';
  assert.equal(A.adherencia(e2, { semanas: 3 }, O).fuerza.planificadas, 1);
  const e3 = estado();
  e3.plan['2026-09-29'] = { tipo: 'fuerza', k: 'B', motivo: 'cambio' };
  assert.equal(A.adherencia(e3, { semanas: 1 }, O).semanas[0].fuerza.planificadas, 2);
});
test('adherencia: weeks argument is clamped and defaults to 4', () => {
  assert.equal(A.adherencia(estado(), {}, O).semanas.length, 4);
  assert.equal(A.adherencia(estado(), { semanas: 999 }, O).semanas.length, 26);
  assert.equal(A.adherencia({}, {}, O).fuerza.porcentaje, null);
});

test('tendenciaCuerpo: weekly series, stats and slope per week', () => {
  const r = A.tendenciaCuerpo(estado(), { metrica: 'peso', dias: 60 }, O);
  assert.deepEqual(r.serie, [['2026-09-01', 81], ['2026-09-15', 80], ['2026-09-29', 79]]);
  assert.equal(r.n, 3);
  assert.equal(r.min, 79); assert.equal(r.max, 81); assert.equal(r.media, 80);
  assert.equal(r.pendienteSemana, -0.5);
});
test('tendenciaCuerpo: derived and daily metrics', () => {
  const e = estado();
  assert.deepEqual(A.tendenciaCuerpo(e, { metrica: 'sueTotal' }, O).serie.map(p => p[1]), [6, 6, 6.5]);
  assert.deepEqual(A.tendenciaCuerpo(e, { metrica: 'dolorMax' }, O).serie.map(p => p[1]), [3, 3, 3]);
  assert.deepEqual(A.tendenciaCuerpo(e, { metrica: 'hoyRod' }, O).serie, [['2026-09-29', 2], ['2026-09-30', 3]]);
  assert.deepEqual(A.tendenciaCuerpo(e, { metrica: 'hoySue' }, O).serie, [['2026-09-29', 5], ['2026-09-30', 4.5]]);
});
test('tendenciaCuerpo: skips nulls, honours the window, rejects unknown metrics', () => {
  assert.deepEqual(A.tendenciaCuerpo(estado(), { metrica: 'sis' }, O).serie, [['2026-09-01', 128]]);
  assert.equal(A.tendenciaCuerpo(estado(), { metrica: 'peso', dias: 10 }, O).n, 1);
  assert.equal(A.tendenciaCuerpo(estado(), { metrica: 'sis', dias: 10 }, O).pendienteSemana, null);
  assert.throws(() => A.tendenciaCuerpo(estado(), { metrica: 'altura' }, O), /metrica/);
  assert.equal(METRICAS.includes('cer'), false);
});

test('historialEjercicio: by id or accent-insensitive name fragment, newest first', () => {
  const r = A.historialEjercicio(estado(), { ejercicio: 'SENTADILLA', n: 2 }, O);
  assert.equal(r.ejercicio.id, 'sent_banco');
  assert.equal(r.total, 4);
  assert.deepEqual(r.sesiones.map(s => s.f), ['2026-09-28', '2026-09-21']);
  assert.deepEqual(r.sesiones[0], { f: '2026-09-28', peso: 24, reps: [10, 10, 10], rpe: 8 });
});
test('historialEjercicio: ambiguous, unknown and custom exercises', () => {
  const amb = A.historialEjercicio(estado(), { ejercicio: 'e' }, O);
  assert.equal(amb.ejercicio, null);
  assert.ok(amb.coincidencias.length > 1);
  assert.deepEqual(A.historialEjercicio(estado(), { ejercicio: 'zzz' }, O).coincidencias, []);
  assert.equal(A.historialEjercicio(estado(), { ejercicio: 'curl' }, O).ejercicio.nombre, 'Curl raro');
  assert.throws(() => A.historialEjercicio(estado(), {}, O), /ejercicio/);
});
test('historialEjercicio: timed exercises report minutes; notes are returned as data', () => {
  const r = A.historialEjercicio(estado(), { ejercicio: 'comba' }, O);
  assert.equal(r.sesiones[0].min, 10);
});

test('resumenGeneral: program, week plan with done flags, last activity, body, no secrets', () => {
  const r = A.resumenGeneral(estado(), O);
  assert.equal(r.hoy, HOY);
  assert.deepEqual(r.perfil, { nombre: 'Osma', altura: 178, pesoInicial: 81 });
  assert.deepEqual(r.programa, { semana: 9, fase: 2, descarga: false, diasFuerza: ['lun', 'vie'], diasPadel: ['mar', 'jue'], padelHora: '19:00', verano: false });
  assert.deepEqual(r.articulacionesEnFaseMala, ['rodI']);
  assert.deepEqual(r.semanaActual.map(d => [d.dia, d.tipo, d.k || null, d.hecho]), [
    ['lun', 'fuerza', 'A', true], ['mar', 'padel', null, false], ['mie', 'movil', null, false],
    ['jue', 'padel', null, false], ['vie', 'fuerza', 'B', false], ['sab', 'movil', null, false], ['dom', 'movil', null, false]]);
  assert.deepEqual(r.ultimaSesion, { f: '2026-09-28', s: 'A' });
  assert.equal(r.diasSinEntrenar, 2);
  assert.deepEqual(r.ultimoPartido, { f: '2026-09-24', min: 80, rodD: 4, rodI: 3, codo: 1 });
  assert.deepEqual(r.ultimoCuerpo, { f: '2026-09-29', peso: 79, cint: 92, sueN: 5.5, sueS: 1, cig: 8, dolor: { rodD: 2, rodI: 1, mun: 2, cad: 3 } });
  assert.deepEqual(r.ultimaTension, { f: '2026-09-01', sis: 128, dia: 84 });
  assert.deepEqual(r.disposicionHoy, { rod: 3, sue: 4.5, padel: 0 });
  const txt = JSON.stringify(r);
  assert.ok(!txt.includes('SECRETO') && !txt.includes('codigo') && !txt.includes('endpoint'));
  assert.ok(!txt.includes('ignora'), 'free text from padel notes is not echoed in the summary');
});
test('resumenGeneral: plan override, deload week, hard warnings', () => {
  const e = estado();
  e.semana = 10;
  e.plan['2026-09-30'] = { tipo: 'fuerza', k: 'B', motivo: 'recolocada' };
  e.cuerpo.push({ f: '2026-09-30', peso: null, cint: null, rodD: 0, rodI: 0, mun: 0, cad: 0, sueN: null, sueS: null, cig: null, sis: 182, dia: 112, nota: '' });
  e.hoy['2026-09-30'].rod = 7;
  const r = A.resumenGeneral(e, O);
  assert.equal(r.programa.descarga, true);
  assert.deepEqual(r.semanaActual[2], { f: '2026-09-30', dia: 'mie', tipo: 'fuerza', k: 'B', hecho: false });
  assert.equal(r.avisos.length, 2);
  assert.match(r.avisos.join(' '), /180\/110/);
  assert.match(r.avisos.join(' '), /rodillas/i);
});
test('resumenGeneral: empty state does not throw', () => {
  const r = A.resumenGeneral({}, O);
  assert.equal(r.ultimaSesion, null);
  assert.equal(r.semanaActual.length, 7);
  assert.deepEqual(r.avisos, []);
});
