'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../uiperfil.js');

test('palette: theme colours first, every entry readable on every real background', () => {
  assert.ok(U.PALETA.length >= 6 && U.PALETA.length <= 8);
  assert.equal(U.PALETA[0], '#FFC72C', 'default gold of the app is the first swatch');
  ['#FF9F1C', '#1FA64A'].forEach(c => assert.ok(U.PALETA.includes(c), c + ' (warn / ok from the theme)'));
  assert.ok(U.FONDOS.includes('#0C0B09') && U.FONDOS.includes('#17130E'), 'checks against --ink and --card');
  U.PALETA.forEach(c => {
    assert.equal(U.validar({ acento: c }).ok, true, c);
    U.FONDOS.forEach(f => assert.ok(U.contraste(c, f) >= 4.5, c + ' on ' + f));
  });
});

test('contraste: black on black is 1, white on black is high', () => {
  assert.equal(Math.round(U.contraste('#000000', '#000000')), 1);
  assert.ok(U.contraste('#FFFFFF', '#000000') > 20);
});

test('validar: accepts an empty profile and a full valid one', () => {
  assert.equal(U.validar({}).ok, true);
  const r = U.validar({ acento: '#1fa64a', fuente: 'grande', densidad: 'compacta', pestanasOcultas: ['pa'], etiquetas: { tr: 'Gym 2' }, ordenPestanas: ['tr', 'hoy', 'hi', 'cu', 'co', 'ai', 'aj'] });
  assert.equal(r.ok, true, r.motivo);
});

test('validar: the raw theme red passes on --ink but fails on --card, so it is rejected', () => {
  assert.equal(U.validar({ acento: '#E23A2E' }).ok, false);
});

test('validar: rejects low-contrast and malformed accent colours', () => {
  assert.equal(U.validar({ acento: '#1A1A1A' }).ok, false);
  assert.equal(U.validar({ acento: '#333333' }).ok, false);
  assert.equal(U.validar({ acento: 'red' }).ok, false);
  assert.equal(U.validar({ acento: '#FFF' }).ok, false);
  assert.equal(U.validar({ acento: 'javascript:alert(1)' }).ok, false);
});

test('validar: rejects unknown keys and bad enums', () => {
  assert.equal(U.validar({ css: 'body{display:none}' }).ok, false);
  assert.equal(U.validar({ fuente: 'gigante' }).ok, false);
  assert.equal(U.validar({ densidad: 'densa' }).ok, false);
  assert.equal(U.validar(null).ok, false);
  assert.equal(U.validar([]).ok, false);
});

test('validar: never allows hiding hoy or coach, rejects unknown tab ids', () => {
  assert.equal(U.validar({ pestanasOcultas: ['hoy'] }).ok, false);
  assert.equal(U.validar({ pestanasOcultas: ['ai'] }).ok, false);
  assert.equal(U.validar({ pestanasOcultas: ['zzz'] }).ok, false);
  assert.equal(U.validar({ pestanasOcultas: 'pa' }).ok, false);
  assert.equal(U.validar({ pestanasOcultas: ['pa', 'pa'] }).ok, false);
  assert.equal(U.validar({ pestanasOcultas: ['pa', 'aj'] }).ok, true);
});

test('validar: labels are sanitised (HTML, emoji, length, unknown tab)', () => {
  assert.equal(U.validar({ etiquetas: { tr: '<b>x</b>' } }).ok, false);
  assert.equal(U.validar({ etiquetas: { tr: 'Fuerza 💪' } }).ok, false);
  assert.equal(U.validar({ etiquetas: { tr: 'a'.repeat(15) } }).ok, false);
  assert.equal(U.validar({ etiquetas: { tr: '' } }).ok, false);
  assert.equal(U.validar({ etiquetas: { nope: 'Hola' } }).ok, false);
  assert.equal(U.validar({ etiquetas: { tr: 'Más Fuerza' } }).ok, true);
  assert.equal(U.validar({ etiquetas: { tr: 'a'.repeat(14) } }).ok, true);
});

test('validar: ordenPestanas must be a permutation of the visible tabs', () => {
  const todas = U.TABS.slice();
  assert.equal(U.validar({ ordenPestanas: todas.slice().reverse() }).ok, true);
  assert.equal(U.validar({ ordenPestanas: todas.slice(1) }).ok, false);
  assert.equal(U.validar({ ordenPestanas: todas.concat(['hoy']) }).ok, false);
  assert.equal(U.validar({ ordenPestanas: todas.slice(0, 7).concat(['zzz']) }).ok, false);
  assert.equal(U.validar({ pestanasOcultas: ['pa'], ordenPestanas: todas }).ok, false);
  assert.equal(U.validar({ pestanasOcultas: ['pa'], ordenPestanas: todas.filter(t => t !== 'pa').reverse() }).ok, true);
});

test('fusionar: merges, validates and returns the inverse patch', () => {
  const r = U.fusionar({}, { acento: '#1FA64A', fuente: 'grande' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.ui, { acento: '#1FA64A', fuente: 'grande' });
  assert.deepEqual(r.deshacer, { acento: null, fuente: null });
});

test('fusionar: inverse patch round trip restores the previous profile', () => {
  const a = { acento: '#C9C2B2', etiquetas: { tr: 'Gym', hi: 'Datos' }, pestanasOcultas: ['pa'] };
  const copia = JSON.parse(JSON.stringify(a));
  const r = U.fusionar(a, { acento: '#1FA64A', etiquetas: { tr: null, cu: 'Peso' }, pestanasOcultas: ['pa', 'co'], densidad: 'compacta' });
  assert.equal(r.ok, true, r.motivo);
  assert.deepEqual(a, copia, 'input is not mutated');
  assert.equal(r.ui.etiquetas.tr, undefined);
  assert.equal(r.ui.etiquetas.cu, 'Peso');
  const back = U.fusionar(r.ui, r.deshacer);
  assert.equal(back.ok, true, back.motivo);
  assert.deepEqual(back.ui, copia);
});

test('fusionar: hiding a tab drops it from an existing order and the round trip still works', () => {
  const a = { ordenPestanas: U.TABS.slice().reverse() };
  const r = U.fusionar(a, { pestanasOcultas: ['pa'] });
  assert.equal(r.ok, true, r.motivo);
  assert.equal(r.ui.ordenPestanas.includes('pa'), false);
  assert.deepEqual(U.fusionar(r.ui, r.deshacer).ui, a);
});

test('fusionar: rejects invalid or unknown input without changing anything', () => {
  assert.equal(U.fusionar({}, { acento: '#111111' }).ok, false);
  assert.equal(U.fusionar({}, { script: 'x' }).ok, false);
  assert.equal(U.fusionar({}, null).ok, false);
  assert.equal(U.fusionar({}, {}).ok, false);
  assert.equal(U.fusionar({ fuente: 'grande' }, { fuente: 'grande' }).ok, false);
  assert.match(U.fusionar({}, { pestanasOcultas: ['hoy'] }).motivo, /hoy|ocultar/i);
});

test('aplicarEstilos: maps the profile to CSS variables and classes', () => {
  const e = U.aplicarEstilos({ acento: '#1FA64A', fuente: 'enorme', densidad: 'compacta' });
  assert.equal(e.cssVars['--acc'], '#1FA64A');
  assert.equal(e.cssVars['--acc-rgb'], '31,166,74');
  assert.equal(e.cssVars['--escala'], '1.25');
  assert.match(e.cssVars['--acc-dk'], /^#[0-9A-F]{6}$/);
  assert.deepEqual(e.clases, ['d-compacta']);
});

test('aplicarEstilos: empty or invalid profile yields the defaults', () => {
  const d = U.aplicarEstilos({});
  assert.equal(d.cssVars['--acc'], '#FFC72C');
  assert.equal(d.cssVars['--escala'], '1');
  assert.deepEqual(d.clases, []);
  assert.deepEqual(U.aplicarEstilos({ acento: '#111111' }), d);
  assert.deepEqual(U.aplicarEstilos(undefined), d);
});

test('pestanas: ordered, visible, relabelled; defaults when profile is empty', () => {
  const base = { hoy: 'Hoy', tr: 'Entreno', hi: 'Progreso', pa: 'Pádel', cu: 'Cuerpo', co: 'Comida', ai: 'Coach', aj: 'Ajustes' };
  assert.deepEqual(U.pestanas({}, base).map(t => t.id), U.TABS);
  const p = U.pestanas({ pestanasOcultas: ['pa'], etiquetas: { tr: 'Gym' }, ordenPestanas: ['ai', 'tr', 'hoy', 'hi', 'cu', 'co', 'aj'] }, base);
  assert.deepEqual(p.map(t => t.id), ['ai', 'tr', 'hoy', 'hi', 'cu', 'co', 'aj']);
  assert.equal(p.find(t => t.id === 'tr').label, 'Gym');
  assert.equal(p.find(t => t.id === 'hoy').label, 'Hoy');
});
