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
