'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let base;

async function arrancar(t) {
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'osmagym-estado-'));
  const puerto = 20000 + Math.floor(Math.random() * 20000);
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'servidor-web.js')], {
    env: { ...process.env, PUERTO: String(puerto), OSMAGYM_DATOS: datos },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  await new Promise((ok, ko) => { proc.stdout.once('data', ok); proc.once('exit', () => ko(new Error('server exited'))); });
  base = 'http://127.0.0.1:' + puerto;
  t.after(() => { proc.kill(); fs.rmSync(datos, { recursive: true, force: true }); });
}

async function put(clave, cuerpo) {
  const r = await fetch(base + '/api/estado/' + clave, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  return { status: r.status, j: await r.json() };
}
const get = async (clave) => (await fetch(base + '/api/estado/' + clave)).json();
const historial = async (clave) => (await fetch(base + '/api/historial/' + clave)).json();
const snap = async (clave, id) => (await fetch(base + '/api/historial/' + clave + '/' + id)).json();

const estado = (hist, cuerpo, extra) => JSON.stringify(Object.assign({ cfg: { kcal: 2300 }, hist, cuerpo, hoy: {} }, extra || {}));

test('estado API', async (t) => {
  await arrancar(t);

  await t.test('fast-forward PUT overwrites verbatim, deletions included', async () => {
    const v1 = estado([{ f: '2026-09-01' }, { f: '2026-09-02' }], []);
    const r1 = await put('ff', { valor: v1, actualizado: 1000, dispositivo: 'movil-a', base: null });
    assert.equal(r1.status, 200);
    assert.equal(r1.j.conflicto, false);
    const v2 = estado([{ f: '2026-09-01' }], []);                       // the 09-02 session was deleted
    const r2 = await put('ff', { valor: v2, actualizado: 2000, dispositivo: 'movil-b', base: 1000 });
    assert.deepEqual(r2.j, { ok: true, actualizado: 2000, conflicto: false, anterior: null });
    const g = await get('ff');
    assert.equal(g.valor, v2);
    assert.equal(g.actualizado, 2000);
    assert.equal(g.dispositivo, 'movil-b');
  });

  await t.test('PUT without base still overwrites (old clients)', async () => {
    const v = estado([], []);
    const r = await put('ff', { valor: v, actualizado: 3000, dispositivo: 'viejo' });
    assert.equal(r.j.conflicto, false);
    assert.equal((await get('ff')).valor, v);
  });

  await t.test('stale base: the server merges instead of overwriting and returns the merged value', async () => {
    const s0 = estado([{ f: '2026-09-01' }], []);
    await put('cf', { valor: s0, actualizado: 1000, dispositivo: 'pc', base: null });
    // device A trains (fast-forward from s0)
    const a = estado([{ f: '2026-09-01' }, { f: '2026-09-03', s: 'B' }], [], { hoy: { '2026-09-03': { rod: 2, sue: 7, padel: 0 } } });
    const ra = await put('cf', { valor: a, actualizado: 2000, dispositivo: 'movil-a', base: 1000 });
    assert.equal(ra.j.conflicto, false);
    // device B, still on s0, logs the weekly body entry and today's disposition
    const b = estado([{ f: '2026-09-01' }], [{ f: '2026-09-02', peso: 80.5 }], { cfg: { kcal: 2000 }, hoy: { '2026-09-02': { rod: 4, sue: 5, padel: 1 } } });
    const antes = Date.now();
    const rb = await put('cf', { valor: b, actualizado: 1500, dispositivo: 'movil-b', base: 1000 });
    assert.equal(rb.status, 200);
    assert.equal(rb.j.ok, true);
    assert.equal(rb.j.conflicto, true);
    assert.equal(rb.j.fusionado, true);
    assert.deepEqual(rb.j.anterior, { actualizado: 2000, dispositivo: 'movil-a' });
    assert.ok(rb.j.actualizado >= antes && rb.j.actualizado > 2000, 'fresh actualizado');
    const m = JSON.parse(rb.j.valor);
    assert.deepEqual(m.hist.map(h => h.f), ['2026-09-01', '2026-09-03']);
    assert.deepEqual(m.cuerpo, [{ f: '2026-09-02', peso: 80.5 }]);
    assert.deepEqual(Object.keys(m.hoy).sort(), ['2026-09-02', '2026-09-03']);
    assert.equal(m.cfg.kcal, 2300, 'config from the newer blob (A, stored at 2000 > 1500)');
    const g = await get('cf');
    assert.equal(g.valor, rb.j.valor);
    assert.equal(g.actualizado, rb.j.actualizado);
    assert.equal(g.dispositivo, 'movil-b');
  });

  await t.test('conflict snapshots keep the incoming write, the merged result and the overwritten version', async () => {
    const lista = await historial('cf');
    const g = await get('cf');
    assert.ok(lista.length >= 4);
    const [ultimo, penultimo] = lista;                     // newest first
    assert.equal(ultimo.actualizado, g.actualizado);
    assert.equal((await snap('cf', ultimo.id)).valor, g.valor);
    assert.equal(penultimo.dispositivo, 'movil-b');
    assert.equal(JSON.parse((await snap('cf', penultimo.id)).valor).cuerpo.length, 1);
    // the agent recovers the overwritten version by (actualizado, dispositivo) of `anterior`
    assert.ok(lista.some(h => h.actualizado === 2000 && h.dispositivo === 'movil-a'));
  });

  await t.test('newer incoming blob wins config on a stale-base merge', async () => {
    const g = await get('cf');
    const c = estado([{ f: '2026-09-05' }], [], { cfg: { kcal: 2100 } });
    const r = await put('cf', { valor: c, actualizado: g.actualizado + 10, dispositivo: 'movil-c', base: 1000 });
    assert.equal(r.j.fusionado, true);
    const m = JSON.parse(r.j.valor);
    assert.equal(m.cfg.kcal, 2100);
    assert.deepEqual(m.hist.map(h => h.f), ['2026-09-01', '2026-09-03', '2026-09-05']);
  });

  await t.test('a stale base is merged even against the same device\'s own last write', async () => {
    // The stored row may be a merge this device has not absorbed yet (it saved again while the merging
    // PUT was in flight); overwriting it would drop the other device's records.
    const v1 = estado([{ f: '2026-09-01' }, { f: '2026-09-02', s: 'otro' }], []);
    await put('yo', { valor: v1, actualizado: 1000, dispositivo: 'movil-a', base: null });
    const v2 = estado([{ f: '2026-09-01' }, { f: '2026-09-04' }], []);
    const r = await put('yo', { valor: v2, actualizado: 2000, dispositivo: 'movil-a', base: 500 });
    assert.equal(r.j.fusionado, true);
    assert.deepEqual(JSON.parse((await get('yo')).valor).hist.map(h => h.f), ['2026-09-01', '2026-09-02', '2026-09-04']);
  });

  await t.test('a merged value over the size limit falls back to storing the incoming write', async () => {
    const grande = (pre) => Array.from({ length: 36000 }, (_, i) => ({ f: pre + String(i).padStart(6, '0'), relleno: 'x'.repeat(60) }));
    const a = estado(grande('a'), []);
    const b = estado(grande('b'), []);
    await put('big', { valor: a, actualizado: 1000, dispositivo: 'pc', base: null });
    await put('big', { valor: a, actualizado: 2000, dispositivo: 'movil-a', base: 1000 });
    const r = await put('big', { valor: b, actualizado: 1500, dispositivo: 'movil-b', base: 1000 });
    assert.equal(r.status, 200);
    assert.equal(r.j.conflicto, true);
    assert.equal(r.j.fusionado, undefined);
    assert.equal((await get('big')).valor, b);
  });

  await t.test('invalid bodies are still rejected', async () => {
    assert.equal((await put('cf', { valor: 5 })).status, 400);
    assert.equal((await put('cf', { valor: '{no json' })).status, 400);
  });
});
