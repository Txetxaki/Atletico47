'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fusionar } = require('../merge.js');

const NUEVO = { entranteMasNuevo: true };   // incoming (2nd arg) is the newer blob
const VIEJO = { entranteMasNuevo: false };  // stored (1st arg) is the newer blob

function base() {
  return {
    perfil: { nombre: 'Osma', altura: 178, peso0: 81 },
    cfg: { fuerza: ['lun', 'vie'], padel: ['mar', 'jue'], kcal: 2300 },
    equipo: { barra: 10, custom: [] },
    artic: { rodD: 0, rodI: 0 },
    hist: [{ f: '2026-09-01', s: 'A', ej: [] }],
    padel: [{ f: '2026-09-02', min: 90, int: 6 }],
    cuerpo: [{ f: '2026-09-01', peso: 81, cint: 98 }],
    hoy: { '2026-09-01': { rod: 2, sue: 6, padel: 0 } },
    movil: ['2026-09-01'],
    comidas: [{ f: '2026-09-01', h: 'Desayuno', t: 'tostada', plan: 1 }],
    platos: [{ n: 'lentejas', t: '' }],
    notas: { comida: [{ t: 'menos sal', f: '2026-09-01' }] },
    coachLog: [{ f: '2026-09-01', accion: 'ajustar_kcal', input: { kcal: 2200 }, motivo: '', detalle: 'propuesto', estado: 'propuesta', deshacer: null }],
    plan: { '2026-09-03': { tipo: 'movil' } },
    coachCfg: { codigo: 'x', auto: 1, revisiones: {} },
    semana: 1
  };
}

test('disjoint records added on each side both survive (hist, padel, cuerpo)', () => {
  const a = base(), b = base();
  a.hist.push({ f: '2026-09-05', s: 'B', ej: [] });          // device A trained
  b.padel.push({ f: '2026-09-04', min: 60, int: 5 });         // device B logged a match
  b.cuerpo.push({ f: '2026-09-08', peso: 80.5 });             // and the weekly body entry
  const m = fusionar(a, b, NUEVO);
  assert.deepEqual(m.hist.map(h => h.f), ['2026-09-01', '2026-09-05']);
  assert.deepEqual(m.padel.map(x => x.f), ['2026-09-02', '2026-09-04']);
  assert.deepEqual(m.cuerpo.map(x => x.f), ['2026-09-01', '2026-09-08']);
});

test('one record per date (hist, padel, cuerpo): the record from the newer blob wins whole', () => {
  const a = base(), b = base();
  a.cuerpo[0] = { f: '2026-09-01', peso: 80, cint: 97, nota: 'a' };
  b.cuerpo[0] = { f: '2026-09-01', peso: 80.2 };
  a.padel[0] = { f: '2026-09-02', min: 120, int: 8 };
  assert.deepEqual(fusionar(a, b, NUEVO).cuerpo, [b.cuerpo[0]]);
  assert.deepEqual(fusionar(a, b, VIEJO).cuerpo, [a.cuerpo[0]]);
  assert.deepEqual(fusionar(a, b, VIEJO).padel, [a.padel[0]]);
  assert.deepEqual(fusionar(a, b, NUEVO).padel, [b.padel[0]]);
});

test('config-like fields come whole from the newer blob', () => {
  const a = base(), b = base();
  a.perfil.peso0 = 79; a.cfg.kcal = 2100; a.equipo.barra = 15; a.artic.rodD = 1; a.coachCfg.auto = 0; a.semana = 3;
  a.platos = [{ n: 'tortilla', t: '' }];
  const m = fusionar(a, b, VIEJO);
  assert.equal(m.perfil.peso0, 79);
  assert.equal(m.cfg.kcal, 2100);
  assert.equal(m.equipo.barra, 15);
  assert.equal(m.artic.rodD, 1);
  assert.equal(m.coachCfg.auto, 0);
  assert.equal(m.semana, 3);
  assert.deepEqual(m.platos, [{ n: 'tortilla', t: '' }]);
  const n = fusionar(a, b, NUEVO);
  assert.equal(n.cfg.kcal, 2300);
  assert.equal(n.artic.rodD, 0);
  assert.deepEqual(n.platos, [{ n: 'lentejas', t: '' }]);
});

test('weekly plan and regenerations are taken whole from the newer blob (deleting an adjustment must stick)', () => {
  const a = base(), b = base();
  b.plan = {};
  a.regen = { '2026-09-03': { 0: 'sentadilla' } };
  b.regen = {};
  const m = fusionar(a, b, NUEVO);
  assert.deepEqual(m.plan, {});
  assert.deepEqual(m.regen, {});
});

test('hoy (date -> disposition map): union by date, the newer blob wins per date', () => {
  const a = base(), b = base();
  a.hoy['2026-09-02'] = { rod: 5, sue: 4, padel: 1 };
  b.hoy['2026-09-03'] = { rod: 1, sue: 8, padel: 0 };
  a.hoy['2026-09-01'] = { rod: 7, sue: 3, padel: 0 };
  const m = fusionar(a, b, NUEVO);
  assert.deepEqual(Object.keys(m.hoy).sort(), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.deepEqual(m.hoy['2026-09-01'], { rod: 2, sue: 6, padel: 0 }, 'same date: newer (incoming) wins');
  assert.deepEqual(m.hoy['2026-09-02'], { rod: 5, sue: 4, padel: 1 });
  assert.deepEqual(m.hoy['2026-09-03'], { rod: 1, sue: 8, padel: 0 });
  assert.deepEqual(fusionar(a, b, VIEJO).hoy['2026-09-01'], { rod: 7, sue: 3, padel: 0 }, 'same date: newer (stored) wins');
});

test('hoy: a map on only one side, or garbage on one side, falls back to the newer value', () => {
  const a = base(), b = base();
  delete a.hoy;
  assert.deepEqual(fusionar(a, b, NUEVO).hoy, b.hoy);
  b.hoy = null;
  assert.equal(fusionar(base(), b, NUEVO).hoy, null);
});

test('movil (dates with mobility done) is unioned as a set of dates, sorted', () => {
  const a = base(), b = base();
  a.movil.push('2026-09-03');
  b.movil.push('2026-09-02');
  assert.deepEqual(fusionar(a, b, NUEVO).movil, ['2026-09-01', '2026-09-02', '2026-09-03']);
});

test('several meals on the same date are unioned by content, not collapsed by date', () => {
  const a = base(), b = base();
  a.comidas.push({ f: '2026-09-02', h: 'Comida', t: 'arroz', plan: 1 });
  b.comidas.push({ f: '2026-09-02', h: 'Cena', t: 'pescado', plan: 1 });
  b.comidas.push({ f: '2026-09-02', h: 'Merienda', t: 'fruta', plan: 1 });
  const m = fusionar(a, b, NUEVO);
  assert.equal(m.comidas.length, 4);
  assert.deepEqual(m.comidas.map(c => c.t).sort(), ['arroz', 'fruta', 'pescado', 'tostada']);
  assert.deepEqual(m.comidas.map(c => c.f), ['2026-09-01', '2026-09-02', '2026-09-02', '2026-09-02']);
});

test('notas.comida are unioned by content one level down, even on the same date', () => {
  const a = base(), b = base();
  a.notas.comida.push({ t: 'sin gluten', f: '2026-09-02' });
  b.notas.comida.push({ t: 'mas verdura', f: '2026-09-02' });
  const m = fusionar(a, b, NUEVO);
  assert.deepEqual(m.notas.comida.map(n => n.t), ['menos sal', 'mas verdura', 'sin gluten']);
});

test('coachLog: entries from both sides survive, newest first, even on the same date', () => {
  const a = base(), b = base();
  a.coachLog.unshift({ f: '2026-09-02', accion: 'cambiar_dia', input: { de: 'lun', a: 'mar' }, detalle: 'hecho', estado: 'aplicado', deshacer: null });
  b.coachLog.unshift({ f: '2026-09-02', accion: 'sustituir', input: { id: 'press' }, detalle: 'hecho', estado: 'aplicado', deshacer: null });
  b.coachLog.unshift({ f: '2026-09-04', accion: 'nota', input: { t: 'x' }, detalle: 'hecho', estado: 'aplicado', deshacer: null });
  const m = fusionar(a, b, NUEVO);
  assert.deepEqual(m.coachLog.map(l => l.f + ' ' + l.accion), ['2026-09-04 nota', '2026-09-02 sustituir', '2026-09-02 cambiar_dia', '2026-09-01 ajustar_kcal']);
});

test('coachLog keeps newest first even when each side holds a single entry', () => {
  const a = base(), b = base();
  a.coachLog = [{ f: '2026-09-03', accion: 'x', input: {}, estado: 'aplicado' }];
  b.coachLog = [{ f: '2026-09-01', accion: 'y', input: {}, estado: 'aplicado' }];
  assert.deepEqual(fusionar(a, b, NUEVO).coachLog.map(l => l.f), ['2026-09-03', '2026-09-01']);
});

test('coachLog: an entry whose state changed on one side is not duplicated; the newer blob wins', () => {
  const a = base(), b = base();
  b.coachLog[0] = Object.assign({}, b.coachLog[0], { estado: 'aplicado', detalle: 'aplicado', deshacer: { t: 'kcal', previo: 2300 } });
  const m = fusionar(a, b, NUEVO);
  assert.equal(m.coachLog.length, 1);
  assert.equal(m.coachLog[0].estado, 'aplicado');
  assert.equal(fusionar(a, b, VIEJO).coachLog[0].estado, 'propuesta');
});

test('a conflict merge is a union: it never deletes, so deletions are only honoured by fast-forward writes', () => {
  const viejo = base(), nuevo = base();
  nuevo.hist = []; nuevo.comidas = []; delete nuevo.hoy['2026-09-01'];
  const m = fusionar(viejo, nuevo, NUEVO);
  assert.equal(m.hist.length, 1);
  assert.equal(m.comidas.length, 1);
  assert.ok(m.hoy['2026-09-01']);
});

test('a field only present on the older side is kept', () => {
  const a = Object.assign(base(), { extraViejo: { x: 1 } }), b = base();
  assert.deepEqual(fusionar(a, b, NUEVO).extraViejo, { x: 1 });
});

test('idempotent: merging the incoming side again changes nothing', () => {
  const a = base(), b = base();
  a.hist.push({ f: '2026-09-05', s: 'B' });
  a.hoy['2026-09-05'] = { rod: 1, sue: 7, padel: 0 };
  b.cuerpo.push({ f: '2026-09-08', peso: 80 });
  b.comidas.push({ f: '2026-09-01', h: 'Cena', t: 'sopa', plan: 0 });
  b.movil.push('2026-09-04');
  b.cfg.kcal = 2000;
  const m = fusionar(a, b, NUEVO);
  assert.deepEqual(fusionar(m, b, NUEVO), m);
  assert.deepEqual(fusionar(m, m, NUEVO), m);
});

test('commutative for disjoint records with the same config', () => {
  const a = base(), b = base();
  a.hist.push({ f: '2026-09-05', s: 'B' });
  a.hoy['2026-09-05'] = { rod: 1, sue: 7, padel: 0 };
  b.padel.push({ f: '2026-09-04', min: 60 });
  b.hoy['2026-09-04'] = { rod: 3, sue: 5, padel: 1 };
  const ab = fusionar(a, b, NUEVO), ba = fusionar(b, a, NUEVO);
  assert.deepEqual(ab, ba);   // deepStrictEqual ignores key order
  assert.deepEqual(ab, fusionar(a, b, VIEJO));
});

test('inputs are not mutated', () => {
  const a = base(), b = base();
  a.hist.push({ f: '2026-09-05', s: 'B' });
  a.hoy['2026-09-05'] = { rod: 1 };
  const ca = JSON.stringify(a), cb = JSON.stringify(b);
  fusionar(a, b, NUEVO);
  assert.equal(JSON.stringify(a), ca);
  assert.equal(JSON.stringify(b), cb);
});

test('garbage input never throws and returns the newer blob', () => {
  const b = base();
  assert.deepEqual(fusionar(null, b, NUEVO), b);
  assert.deepEqual(fusionar('x', b, NUEVO), b);
  assert.deepEqual(fusionar([1, 2], b, NUEVO), b);
  assert.equal(fusionar(b, null, NUEVO), null);
  assert.deepEqual(fusionar(b, 7, VIEJO), b);
  assert.deepEqual(fusionar(undefined, undefined), undefined);
  const raro = Object.assign(base(), { hist: [null, 3, { f: '2026-09-09' }], movil: ['2026-09-01', 5] });
  const m = fusionar(base(), raro, NUEVO);
  assert.deepEqual(m.hist, raro.hist);
  assert.deepEqual(m.movil, raro.movil);
});

test('defaults to the incoming blob being the newer one', () => {
  const a = base(), b = base();
  b.cfg.kcal = 1900;
  assert.equal(fusionar(a, b).cfg.kcal, 1900);
});
