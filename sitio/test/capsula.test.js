'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../capsula.js');

function nodo(dataset, parentNode, textContent) {
  return { dataset: dataset || {}, parentNode: parentNode || null, textContent: textContent || '' };
}

test('resolverElemento: returns the node itself when it carries data-coach-tipo', () => {
  const n = nodo({ coachTipo: 'ejercicio', coachId: 'sentadilla', coachDatos: '{"detalle":"3x10 a 40 kg"}' }, null, '  Sentadilla  ');
  const r = C.resolverElemento(n);
  assert.equal(r.tipo, 'ejercicio');
  assert.equal(r.id, 'sentadilla');
  assert.equal(r.texto, 'Sentadilla');
  assert.deepEqual(r.datos, { detalle: '3x10 a 40 kg' });
});

test('resolverElemento: prefers data-coach-texto over the noisy textContent', () => {
  const n = nodo({ coachTipo: 'ejercicio', coachTexto: 'Sentadilla goblet' }, null, '✓01Sentadilla goblet8 kg3x10▶Cuádriceps');
  assert.equal(C.resolverElemento(n).texto, 'Sentadilla goblet');
});

test('resolverElemento: walks up to the nearest ancestor', () => {
  const abuelo = nodo({ coachTipo: 'dia', coachId: 'lun' }, null, 'Lunes');
  const padre = nodo({}, abuelo, 'x');
  const hijo = nodo({}, padre, 'y');
  assert.equal(C.resolverElemento(hijo).tipo, 'dia');
});

test('resolverElemento: nearest ancestor wins over a farther one', () => {
  const lejos = nodo({ coachTipo: 'dia' });
  const cerca = nodo({ coachTipo: 'ejercicio' }, lejos);
  assert.equal(C.resolverElemento(nodo({}, cerca)).tipo, 'ejercicio');
});

test('resolverElemento: null when nothing is tagged or input is junk', () => {
  assert.equal(C.resolverElemento(nodo({}, nodo({}))), null);
  assert.equal(C.resolverElemento(null), null);
  assert.equal(C.resolverElemento(undefined), null);
  assert.equal(C.resolverElemento('x'), null);
});

test('resolverElemento: invalid JSON in data-coach-datos yields empty datos, never throws', () => {
  const r = C.resolverElemento(nodo({ coachTipo: 'nota', coachDatos: '{oops' }, null, 'hola'));
  assert.deepEqual(r.datos, {});
});

test('resolverElemento: survives a parent cycle', () => {
  const a = nodo({}), b = nodo({}, a);
  a.parentNode = b;
  assert.equal(C.resolverElemento(a), null);
});

test('construirCapsula: trims text to 200 chars and caps datos', () => {
  const grande = {};
  for (let i = 0; i < 50; i++) grande['k' + i] = 'v'.repeat(40);
  const c = C.construirCapsula({
    pantalla: 'tr',
    elemento: { tipo: 'ejercicio', id: 'sentadilla', texto: 'a'.repeat(500), datos: grande },
    ahora: new Date('2026-10-01T10:00:00Z')
  });
  assert.equal(c.elemento.texto.length, 200);
  assert.ok(JSON.stringify(c.elemento.datos).length <= 400);
  assert.ok(JSON.stringify(c).length <= 1200);
});

test('construirCapsula: never leaks the coach access code', () => {
  const c = C.construirCapsula({
    pantalla: 'aj',
    elemento: { tipo: 'nota', id: '1', texto: 'x', datos: { coachCodigo: 'SECRETO', detalle: 'ok', anidado: { code: 'SECRETO' } } },
    estado: { coachCodigo: 'SECRETO', cfg: { coachCodigo: 'SECRETO' }, semana: 3 }
  });
  assert.equal(JSON.stringify(c).includes('SECRETO'), false);
  assert.equal(C.capsulaATexto(c).includes('SECRETO'), false);
});

test('construirCapsula: works without an element and with missing args', () => {
  const c = C.construirCapsula({ pantalla: 'hoy' });
  assert.equal(c.pantalla, 'hoy');
  assert.equal(c.elemento, null);
  assert.equal(typeof c.resumen, 'string');
  assert.doesNotThrow(() => C.construirCapsula());
});

test('construirCapsula: accepts a node-like and resolves it', () => {
  const n = nodo({ coachTipo: 'comida', coachId: '4' }, null, 'Pollo con arroz');
  const c = C.construirCapsula({ pantalla: 'co', elemento: n });
  assert.equal(c.elemento.tipo, 'comida');
  assert.equal(c.elemento.texto, 'Pollo con arroz');
});

test('capsulaATexto: Spanish one-liner with screen name and pointed element', () => {
  const c = C.construirCapsula({
    pantalla: 'tr',
    elemento: { tipo: 'ejercicio', id: 'sentadilla', texto: 'sentadilla', datos: { detalle: '3x10 a 40 kg' } }
  });
  assert.equal(C.capsulaATexto(c), '[Contexto: pantalla Entreno · señalado: ejercicio sentadilla (3x10 a 40 kg)]');
});

test('capsulaATexto: names every OsmaGym tab in Spanish', () => {
  const nombres = { hoy: 'Hoy', tr: 'Entreno', hi: 'Progreso', pa: 'Pádel', cu: 'Cuerpo', co: 'Comida', ai: 'Coach', aj: 'Ajustes' };
  Object.keys(nombres).forEach(id => assert.equal(C.capsulaATexto(C.construirCapsula({ pantalla: id })), '[Contexto: pantalla ' + nombres[id] + ']'));
});

test('capsulaATexto: no element, unknown screen, null capsule', () => {
  assert.equal(C.capsulaATexto(C.construirCapsula({ pantalla: 'cu' })), '[Contexto: pantalla Cuerpo]');
  assert.equal(C.capsulaATexto(C.construirCapsula({ pantalla: 'zzz' })), '[Contexto: pantalla zzz]');
  assert.equal(C.capsulaATexto(null), '');
});

test('capsulaATexto: falls back to scalar datos pairs when there is no detalle', () => {
  const c = C.construirCapsula({ pantalla: 'cu', elemento: { tipo: 'metrica', id: 'peso', texto: 'Peso', datos: { kg: 73.5, fecha: '2026-10-01' } } });
  assert.match(C.capsulaATexto(c), /señalado: metrica Peso \(kg: 73\.5, fecha: 2026-10-01\)\]$/);
});

test('capsulaATexto: output stays short', () => {
  const c = C.construirCapsula({ pantalla: 'tr', elemento: { tipo: 'nota', id: '1', texto: 'z'.repeat(900), datos: { detalle: 'd'.repeat(900) } } });
  assert.ok(C.capsulaATexto(c).length <= 500);
});
