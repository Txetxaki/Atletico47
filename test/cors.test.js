'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERCEL = 'https://osmagym.vercel.app';
const PAGES = 'https://txetxaki.github.io';
const EXTRA = 'https://otro.example.org';
let proc, base, datos;

async function arrancar(t) {
  datos = fs.mkdtempSync(path.join(os.tmpdir(), 'osmagym-cors-'));
  const puerto = 20000 + Math.floor(Math.random() * 20000);
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'servidor-web.js')], {
    env: { ...process.env, PUERTO: String(puerto), OSMAGYM_DATOS: datos, OSMAGYM_ORIGENES: ' ' + EXTRA + ' ,' },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  await new Promise((ok, ko) => { proc.stdout.once('data', ok); proc.once('exit', () => ko(new Error('server exited'))); });
  base = 'http://127.0.0.1:' + puerto;
  t.after(() => { proc.kill(); fs.rmSync(datos, { recursive: true, force: true }); });
}

const pre = (origen, ruta = '/api/estado/a47v1') =>
  fetch(base + ruta, { method: 'OPTIONS', headers: { Origin: origen, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' } });

test('CORS', async (t) => {
  await arrancar(t);

  await t.test('preflight from an allowed origin: 204 with exact ACAO and Vary', async () => {
    for (const o of [VERCEL, PAGES, EXTRA]) {
      const r = await pre(o);
      assert.equal(r.status, 204);
      assert.equal(r.headers.get('access-control-allow-origin'), o);
      assert.match(r.headers.get('vary'), /Origin/i);
      assert.equal(r.headers.get('access-control-allow-methods'), 'GET,PUT,POST,OPTIONS');
      assert.equal(r.headers.get('access-control-allow-headers'), 'Content-Type');
      assert.equal(r.headers.get('access-control-max-age'), '600');
      assert.equal(r.headers.get('access-control-allow-credentials'), null);
    }
  });

  await t.test('preflight answers Private Network Access requests', async () => {
    const r = await fetch(base + '/api/salud', { method: 'OPTIONS', headers: { Origin: VERCEL, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Private-Network': 'true' } });
    assert.equal(r.headers.get('access-control-allow-private-network'), 'true');
  });

  await t.test('disallowed origin gets no CORS headers and is never reflected', async () => {
    for (const o of ['https://evil.example', 'https://osmagym.vercel.app.evil.com', 'http://osmagym.vercel.app', 'https://txetxaki.github.io.evil.com', 'null']) {
      for (const r of [await pre(o), await fetch(base + '/api/salud', { headers: { Origin: o } })]) {
        assert.equal(r.headers.get('access-control-allow-origin'), null, o);
        assert.equal(r.headers.get('access-control-allow-methods'), null, o);
      }
    }
  });

  await t.test('simple requests from an allowed origin carry ACAO + Vary; * is never emitted', async () => {
    const r = await fetch(base + '/api/salud', { headers: { Origin: VERCEL } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), VERCEL);
    assert.match(r.headers.get('vary'), /Origin/i);
    for (const o of [VERCEL, 'https://evil.example', undefined]) {
      const x = await fetch(base + '/api/salud', { headers: o ? { Origin: o } : {} });
      assert.notEqual(x.headers.get('access-control-allow-origin'), '*');
    }
  });

  await t.test('no Origin header: no CORS headers, API unchanged', async () => {
    const r = await fetch(base + '/api/salud');
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.ok(j.bd.startsWith(datos), 'uses the temp data dir');
  });

  await t.test('static files get no CORS headers even for an allowed origin', async () => {
    const r = await fetch(base + '/index.html', { headers: { Origin: VERCEL } });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  });

  await t.test('existing API behaviour: PUT/GET round trip, 404, 405 on bare OPTIONS', async () => {
    const valor = JSON.stringify({ a: 1 });
    const put = await fetch(base + '/api/estado/a47v1', { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: VERCEL }, body: JSON.stringify({ valor, actualizado: 123, dispositivo: 't' }) });
    assert.equal(put.status, 200);
    assert.equal(put.headers.get('access-control-allow-origin'), VERCEL);
    const got = await (await fetch(base + '/api/estado/a47v1')).json();
    assert.equal(got.valor, valor);
    assert.equal((await fetch(base + '/api/estado/nada')).status, 404);
    assert.equal((await fetch(base + '/api/estado/a47v1', { method: 'OPTIONS' })).status, 405);
  });
});
