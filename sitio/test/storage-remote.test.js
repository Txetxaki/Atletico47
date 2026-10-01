'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../storage-remote.js');

const PI = 'https://raspberry.taile8249e.ts.net:10003';

test('elegirBase: Pi origin stays same-origin', () => {
  assert.equal(R.elegirBase({ origin: PI, piUrl: PI }), '');
});
test('elegirBase: Vercel origin uses the Pi URL', () => {
  assert.equal(R.elegirBase({ origin: 'https://osmagym.vercel.app', piUrl: PI }), PI);
});
test('elegirBase: opaque and file origins use the Pi URL', () => {
  assert.equal(R.elegirBase({ origin: 'null', piUrl: PI }), PI);
});
test('elegirBase: loopback / LAN / tailnet hosts keep the same-origin behaviour', () => {
  for (const o of ['http://127.0.0.1:8090', 'http://localhost:8090', 'http://192.168.1.10:8090', 'https://otra.taile8249e.ts.net'])
    assert.equal(R.elegirBase({ origin: o, piUrl: PI }), '', o);
});
test('elegirBase: a valid override wins and loses its trailing slash', () => {
  assert.equal(R.elegirBase({ origin: 'https://osmagym.vercel.app', piUrl: PI, override: 'http://127.0.0.1:9000/' }), 'http://127.0.0.1:9000');
  assert.equal(R.elegirBase({ origin: PI, piUrl: PI, override: 'http://127.0.0.1:9000' }), 'http://127.0.0.1:9000');
});
test('elegirBase: an override pointing at a public host is ignored', () => {
  for (const ov of ['https://evil.example.com', 'http://203.0.113.9:8090', 'https://raspberry.taile8249e.ts.net.evil.com']) {
    assert.equal(R.elegirBase({ origin: 'https://osmagym.vercel.app', piUrl: PI, override: ov }), PI, ov);
  }
});
test('elegirBase: an invalid override is ignored', () => {
  for (const ov of ['', null, undefined, 'javascript:alert(1)', 'not a url', '/relativo'])
    assert.equal(R.elegirBase({ origin: 'https://osmagym.vercel.app', piUrl: PI, override: ov }), PI, String(ov));
});

test('decidirSonda: no cache means probe', () => {
  assert.equal(R.decidirSonda(null, 1000), 'sondar');
  assert.equal(R.decidirSonda({ ok: true }, 1000), 'sondar');
});
test('decidirSonda: a fresh positive result is reused for 5 minutes', () => {
  assert.equal(R.decidirSonda({ ok: true, ts: 0 }, 299000), 'si');
  assert.equal(R.decidirSonda({ ok: true, ts: 0 }, 301000), 'sondar');
});
test('decidirSonda: a fresh negative result is reused for 2 minutes, never blocking', () => {
  assert.equal(R.decidirSonda({ ok: false, ts: 0 }, 119000), 'no');
  assert.equal(R.decidirSonda({ ok: false, ts: 0 }, 121000), 'sondar');
});
test('decidirSonda: a timestamp from the future is distrusted', () => {
  assert.equal(R.decidirSonda({ ok: true, ts: 5000 }, 1000), 'sondar');
});

test('elegirBase: hosts hidden in userinfo, query or fragment do not pass as private', () => {
  const origin = 'https://example.vercel.app';
  for (const ov of ['https://evil.example.com#.ts.net', 'https://evil.example.com?x=.ts.net', 'https://x.ts.net@evil.example.com/', 'https://evil.example.com\\@x.ts.net']) {
    assert.equal(R.elegirBase({ origin, piUrl: PI, override: ov }), PI, 'userinfo or fragment: ' + ov);
  }
  assert.equal(R.elegirBase({ origin, piUrl: PI, override: 'https://raspberry.taile8249e.ts.net:10009/' }), 'https://raspberry.taile8249e.ts.net:10009');
});

test('primerContacto: a device that never synced must not be overwritten by a smaller server state', () => {
  const grande = JSON.stringify({ hist: [{ f: '2026-09-01' }, { f: '2026-09-03' }], cuerpo: [{ f: '2026-09-02', peso: 80 }] });
  const vacio = JSON.stringify({ hist: [], cuerpo: [] });
  assert.equal(R.primerContacto({ local: grande, remoto: vacio, tieneBase: false, mismoDispositivo: false }), 'local');
  assert.equal(R.primerContacto({ local: vacio, remoto: grande, tieneBase: false, mismoDispositivo: false }), 'remoto-con-respaldo');
  assert.equal(R.primerContacto({ local: grande, remoto: grande, tieneBase: false, mismoDispositivo: false }), 'normal');
  assert.equal(R.primerContacto({ local: grande, remoto: vacio, tieneBase: true, mismoDispositivo: false }), 'normal');
  assert.equal(R.primerContacto({ local: grande, remoto: vacio, tieneBase: false, mismoDispositivo: true }), 'normal');
  assert.equal(R.primerContacto({ local: null, remoto: grande, tieneBase: false, mismoDispositivo: false }), 'normal');
});

test('decidirRefresco: pending local changes are uploaded first (the server merges on conflict)', () => {
  assert.equal(R.decidirRefresco({ pendiente: true, tieneBase: true, base: 5, remoto: { actualizado: 9 } }), 'subir');
  assert.equal(R.decidirRefresco({ pendiente: true, tieneBase: false, base: null, remoto: null }), 'subir');
});
test('decidirRefresco: a device that never synced goes through the first-contact rule', () => {
  assert.equal(R.decidirRefresco({ pendiente: false, tieneBase: false, base: null, remoto: { actualizado: 9 } }), 'primer-contacto');
});
test('decidirRefresco: adopt only a strictly newer remote version', () => {
  assert.equal(R.decidirRefresco({ pendiente: false, tieneBase: true, base: 5, remoto: { actualizado: 9 } }), 'adoptar');
  assert.equal(R.decidirRefresco({ pendiente: false, tieneBase: true, base: 9, remoto: { actualizado: 9 } }), 'nada');
  assert.equal(R.decidirRefresco({ pendiente: false, tieneBase: true, base: 12, remoto: { actualizado: 9 } }), 'nada');
  assert.equal(R.decidirRefresco({ pendiente: false, tieneBase: true, base: 5, remoto: null }), 'nada');
  assert.equal(R.decidirRefresco({ pendiente: false, tieneBase: true, base: 5, remoto: { actualizado: 'x' } }), 'nada');
});

test('tocaRefrescar: the interval only polls while visible and not known to be unreachable', () => {
  assert.equal(R.tocaRefrescar({ visible: true, sonda: 'si' }), true);
  assert.equal(R.tocaRefrescar({ visible: true, sonda: 'sondar' }), true);
  assert.equal(R.tocaRefrescar({ visible: true, sonda: 'no' }), false);
  assert.equal(R.tocaRefrescar({ visible: false, sonda: 'si' }), false);
});

test('trasSubir: a merged answer replaces the local copy when nothing changed meanwhile', () => {
  const r = R.trasSubir({ enviado: 'A', localAhora: 'A', res: { ok: true, actualizado: 50, conflicto: true, fusionado: true, valor: 'AB' } });
  assert.deepEqual(r, { valor: 'AB', ts: 50, base: 50, pend: '', fusionado: true });
});
test('trasSubir: a merged answer never overwrites a newer local save; base stays so the next PUT merges again', () => {
  const r = R.trasSubir({ enviado: 'A', localAhora: 'A2', res: { ok: true, actualizado: 50, fusionado: true, valor: 'AB' } });
  assert.deepEqual(r, { pend: '1', fusionado: false });
});
test('trasSubir: a plain answer advances base and clears pending only if local is what was sent', () => {
  assert.deepEqual(R.trasSubir({ enviado: 'A', localAhora: 'A', res: { ok: true, actualizado: 50, conflicto: false } }), { base: 50, pend: '', fusionado: false });
  assert.deepEqual(R.trasSubir({ enviado: 'A', localAhora: 'A2', res: { ok: true, actualizado: 50, conflicto: false } }), { base: 50, pend: '1', fusionado: false });
});
test('trasSubir: a merged answer without a usable value is treated as a plain answer', () => {
  assert.deepEqual(R.trasSubir({ enviado: 'A', localAhora: 'A', res: { ok: true, actualizado: 50, fusionado: true } }), { base: 50, pend: '', fusionado: false });
});

test('haceCuanto: short Spanish relative times', () => {
  const m = 60000;
  assert.equal(R.haceCuanto(null, 10 * m), 'nunca');
  assert.equal(R.haceCuanto(10 * m - 5000, 10 * m), 'ahora mismo');
  assert.equal(R.haceCuanto(8 * m, 10 * m), 'hace 2 min');
  assert.equal(R.haceCuanto(0, 180 * m), 'hace 3 h');
  assert.equal(R.haceCuanto(0, 3 * 1440 * m), 'hace 3 d');
  assert.equal(R.haceCuanto(20 * m, 10 * m), 'ahora mismo');
});

test('etiquetaConexion: three states for the Ajustes panel', () => {
  assert.equal(R.etiquetaConexion(true), 'Conectado a la Pi');
  assert.equal(R.etiquetaConexion(false), 'Sin conexión con la Pi');
  assert.equal(R.etiquetaConexion(null), 'Copia local');
});

test('mensajeError: network failures read in Spanish, HTTP and other errors stay recognisable', () => {
  assert.equal(R.mensajeError(new TypeError('Failed to fetch')), 'la Pi no responde');
  assert.equal(R.mensajeError(new TypeError('NetworkError when attempting to fetch resource.')), 'la Pi no responde');
  assert.equal(R.mensajeError(new TypeError('Load failed')), 'la Pi no responde');
  assert.equal(R.mensajeError({ name: 'AbortError', message: 'The user aborted a request.' }), 'la Pi tardó demasiado en responder');
  assert.equal(R.mensajeError(new Error('Pi fuera de alcance')), 'la Pi no responde');
  assert.equal(R.mensajeError(new Error('HTTP 500')), 'el servidor respondió HTTP 500');
  assert.equal(R.mensajeError('raro'), 'raro');
  assert.equal(R.mensajeError(null), 'error desconocido');
});
