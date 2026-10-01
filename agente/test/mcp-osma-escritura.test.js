'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { estado, HOY, NOMBRES } = require('./fixtures');
const { apiStub } = require('./api-stub');
const { crearManejador, rutaAuditoria } = require('../mcp-osma');
const { hashEstado } = require('../escritura');

function entorno(opts) {
  opts = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'osmagym-audit-'));
  const auditoria = path.join(dir, 'audit.jsonl');
  const api = apiStub(estado(), opts);
  const h = crearManejador({ fetchFn: api.fetchFn, base: 'http://x:1', nombres: NOMBRES, hoy: HOY, auditoria });
  const llamar = (name, args, id) => h({ jsonrpc: '2.0', id: id || 1, method: 'tools/call', params: { name, arguments: args } });
  const lineas = () => (fs.existsSync(auditoria) ? fs.readFileSync(auditoria, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []);
  return { api, h, llamar, lineas, auditoria };
}
const texto = (res) => JSON.parse(res.result.content[0].text);
const soloCuerpo = (a, b) => { const x = structuredClone(a), y = structuredClone(b); delete x.cuerpo; delete y.cuerpo; return assert.deepEqual(x, y); };

test('tools/list: read tools plus the three write tools, snake_case, Spanish descriptions', async () => {
  const { h } = entorno();
  const res = await h({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const nombres = res.result.tools.map(t => t.name);
  assert.deepEqual(nombres.slice(5), ['registrar_cuerpo', 'anadir_nota', 'deshacer_ultimo_cambio']);
  const rm = res.result.tools.find(t => t.name === 'registrar_cuerpo');
  assert.equal(rm.inputSchema.additionalProperties, false);
  assert.equal(rm.inputSchema.properties.peso.minimum, 30);
  assert.equal(rm.inputSchema.properties.peso.maximum, 250);
  assert.equal(rm.inputSchema.properties.rodD.type, 'integer');
  assert.equal(rm.inputSchema.properties.rodD.maximum, 10);
  assert.equal(rm.inputSchema.properties.nota, undefined);
  assert.equal(rm.inputSchema.properties.cer, undefined);
  const nota = res.result.tools.find(t => t.name === 'anadir_nota');
  assert.equal(nota.inputSchema.properties.tipo, undefined);
  assert.equal(nota.inputSchema.properties.texto.maxLength, 500);
  assert.deepEqual(nota.inputSchema.required, ['texto']);
});

test('rutaAuditoria: env wins, default is datos/agente-auditoria.jsonl in the repo', () => {
  assert.equal(rutaAuditoria({ OSMAGYM_AUDIT: '/tmp/x.jsonl' }), '/tmp/x.jsonl');
  const d = rutaAuditoria({});
  assert.ok(d.endsWith(path.join('datos', 'agente-auditoria.jsonl')));
  assert.equal(path.dirname(path.dirname(d)), path.resolve(__dirname, '..', '..'));
});

test('registrar_cuerpo: PUTs with base, device name, touches only cuerpo, echoes the change', async () => {
  const e = entorno();
  const antes = e.api.estado();
  const res = await e.llamar('registrar_cuerpo', { peso: 77.4, fecha: '2026-09-30' });
  assert.equal(res.result.isError, undefined);
  assert.equal(e.api.puts.length, 1);
  const put = e.api.puts[0];
  assert.equal(put.base, 1000);
  assert.equal(put.dispositivo, 'agente-entrenador');
  assert.equal(typeof put.valor, 'string');
  assert.equal(typeof put.actualizado, 'number');
  const despues = e.api.estado();
  soloCuerpo(antes, despues);
  assert.deepEqual(despues.cuerpo[3], { f: '2026-09-30', peso: 77.4, cint: null, rodD: 0, rodI: 0, mun: 0, cad: 0, sueN: null, sueS: null, cig: null, sis: null, dia: null, nota: '' });
  assert.equal(despues.cuerpo.length, 4);
  assert.deepEqual(texto(res), { ok: true, tool: 'registrar_cuerpo', cambio: { f: '2026-09-30', creada: true, antes: { peso: null }, despues: { peso: 77.4 } } });
  assert.ok(!res.result.content[0].text.includes('\n'));
});

test('registrar_cuerpo: writes an audit line with hashes, args and inverse', async () => {
  const e = entorno();
  const rawAntes = e.api.fila.valor;
  await e.llamar('registrar_cuerpo', { peso: 77.4 });
  const [l] = e.lineas();
  assert.equal(l.tool, 'registrar_cuerpo');
  assert.deepEqual(l.args, { peso: 77.4 });
  assert.equal(l.antes, hashEstado(rawAntes));
  assert.equal(l.despues, hashEstado(e.api.fila.valor));
  assert.match(l.ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(l.id);
  assert.equal(l.inverso.tipo, 'cuerpo');
});

test('registrar_cuerpo: defaults the date to today', async () => {
  const e = entorno();
  await e.llamar('registrar_cuerpo', { sueN: 7.5 });
  assert.equal(e.api.estado().cuerpo.pop().f, HOY);
});

test('registrar_cuerpo: the agent can never write the coach code or other app keys', async () => {
  const e = entorno();
  for (const args of [{ peso: 80, codigo: 'x' }, { peso: 80, coachCfg: {} }, { peso: 80, nota: 'hola' }, { cer: 1 }]) {
    assert.equal((await e.llamar('registrar_cuerpo', args)).result.isError, true, JSON.stringify(args));
  }
  assert.equal(e.api.puts.length, 0);
});

test('registrar_cuerpo: invalid input is an isError result and never reaches the API', async () => {
  const e = entorno();
  for (const args of [{ peso: 500 }, {}, { peso: 80, x: 1 }, { fecha: '2026-02-30', peso: 80 }]) {
    const res = await e.llamar('registrar_cuerpo', args);
    assert.equal(res.result.isError, true, JSON.stringify(args));
  }
  assert.equal(e.api.puts.length, 0);
  assert.equal(e.api.gets, 0);
  assert.equal(e.lineas().length, 0);
});

test('registrar_cuerpo: identical values make no PUT and no audit line', async () => {
  const e = entorno();
  const res = await e.llamar('registrar_cuerpo', { fecha: '2026-09-29', peso: 79 });
  assert.equal(res.result.isError, undefined);
  assert.equal(texto(res).cambio.sinCambios, true);
  assert.equal(e.api.puts.length, 0);
  assert.equal(e.lineas().length, 0);
});

test('anadir_nota: appends {t,f} to the chosen list and echoes it', async () => {
  const e = entorno();
  const res = await e.llamar('anadir_nota', { texto: ' cena ligera\u0000 los martes ' });
  assert.deepEqual(texto(res), { ok: true, tool: 'anadir_nota', cambio: { nota: { t: 'cena ligera los martes', f: HOY }, total: 1 } });
  assert.deepEqual(e.api.estado().notas.comida, [{ t: 'cena ligera los martes', f: HOY }]);
  assert.equal(e.api.puts[0].dispositivo, 'agente-entrenador');
  assert.equal(e.lineas()[0].tool, 'anadir_nota');
});

test('anadir_nota: rejects long, empty and badly typed input', async () => {
  const e = entorno();
  for (const args of [{ texto: 'x'.repeat(501) }, { texto: '' }, { texto: 'a', tipo: 'general' }, {}]) {
    assert.equal((await e.llamar('anadir_nota', args)).result.isError, true, JSON.stringify(args).slice(0, 40));
  }
  assert.equal(e.api.puts.length, 0);
});

test('conflict: a concurrent write is merged, not overwritten (retry once on the other version)', async () => {
  const e = entorno({
    alAntesDePut: (n, api) => { if (n === 1) api.escribirOtro(s => s.notas.comida.push({ t: 'de otro movil', f: HOY })); }
  });
  const res = await e.llamar('registrar_cuerpo', { peso: 77.4 });
  assert.equal(res.result.isError, undefined);
  assert.equal(e.api.puts.length, 2);
  const fin = e.api.estado();
  assert.deepEqual(fin.notas.comida, [{ t: 'de otro movil', f: HOY }]);   // the other device's change survived
  assert.equal(fin.cuerpo.find(m => m.f === HOY).peso, 77.4);
  assert.equal(e.api.puts[1].base, e.api.puts[0].actualizado);
  const [l] = e.lineas();
  assert.equal(l.conflicto, true);
  assert.equal(l.despues, hashEstado(e.api.fila.valor));
  assert.equal(texto(res).conflictoResuelto, true);
});

test('conflict: a second conflict gives up with isError and reports it', async () => {
  const e = entorno({
    alAntesDePut: (n, api) => { api.escribirOtro(s => s.notas.comida.push({ t: 'ruido' + n, f: HOY })); }
  });
  const res = await e.llamar('registrar_cuerpo', { peso: 77.4 });
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /conflicto/);
  assert.equal(e.api.puts.length, 2);
});

test('conflict: if the other version cannot be recovered from the history, isError', async () => {
  const e = entorno({ alAntesDePut: (n, api) => { if (n === 1) { api.escribirOtro(s => s.notas.comida.push({ t: 'x', f: HOY })); api.historial.length = 0; } } });
  const res = await e.llamar('registrar_cuerpo', { peso: 77.4 });
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /conflicto/);
  assert.equal(e.api.puts.length, 1);
});

test('conflict during an undo that can no longer apply: the other version is restored', async () => {
  const e = entorno();
  await e.llamar('registrar_cuerpo', { fecha: '2026-09-29', peso: 77.0 });
  e.api.alAntesDePut = (n, api) => { api.alAntesDePut = null; api.escribirOtro(s => { s.cuerpo[2].peso = 75; }); };
  const res = await e.llamar('deshacer_ultimo_cambio', {});
  assert.equal(res.result.isError, true);
  assert.equal(e.api.estado().cuerpo[2].peso, 75);   // the concurrent edit is back, not lost
});

test('backend down: write tools return isError and leave no audit line', async () => {
  const e = entorno({ caido: true });
  const res = await e.llamar('anadir_nota', { texto: 'hola' });
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /ECONNREFUSED/);
  assert.equal(e.lineas().length, 0);
});

test('audit failure does not hide a write that happened: result carries a warning', async () => {
  const e = entorno();
  fs.writeFileSync(e.auditoria, '');   // a regular file where a directory is needed: ENOTDIR
  const h = crearManejador({ fetchFn: e.api.fetchFn, base: 'http://x:1', hoy: HOY, auditoria: path.join(e.auditoria, 'sub', 'audit.jsonl') });
  const res = await h({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'anadir_nota', arguments: { texto: 'hola' } } });
  assert.equal(res.result.isError, undefined);
  assert.match(texto(res).aviso, /auditor/);
  assert.equal(e.api.estado().notas.comida.length, 1);
});

test('deshacer_ultimo_cambio: restores the state before the last agent write', async () => {
  const e = entorno();
  const inicial = e.api.estado();
  await e.llamar('registrar_cuerpo', { fecha: '2026-09-29', peso: 77.0 });
  const res = await e.llamar('deshacer_ultimo_cambio', {});
  assert.equal(res.result.isError, undefined);
  assert.deepEqual(e.api.estado(), inicial);
  assert.equal(texto(res).tool, 'deshacer_ultimo_cambio');
  assert.equal(texto(res).deshace, 'registrar_cuerpo');
  assert.equal(e.api.puts[1].dispositivo, 'agente-entrenador');
  const l = e.lineas();
  assert.equal(l.length, 2);
  assert.equal(l[1].tool, 'deshacer_ultimo_cambio');
  assert.equal(l[1].deshace, l[0].id);
});

test('deshacer_ultimo_cambio: walks back one write at a time and never undoes twice', async () => {
  const e = entorno();
  const inicial = e.api.estado();
  await e.llamar('anadir_nota', { texto: 'uno' });
  await e.llamar('registrar_cuerpo', { peso: 77.0 });
  await e.llamar('deshacer_ultimo_cambio', {});
  assert.equal(e.api.estado().notas.comida.length, 1);
  await e.llamar('deshacer_ultimo_cambio', {});
  assert.deepEqual(e.api.estado(), inicial);
  const res = await e.llamar('deshacer_ultimo_cambio', {});
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /nada que deshacer/);
});

test('deshacer_ultimo_cambio: keeps the user\'s later changes and refuses to clobber edited values', async () => {
  const e = entorno();
  await e.llamar('registrar_cuerpo', { fecha: '2026-09-29', peso: 77.0 });
  e.api.escribirOtro(s => s.notas.comida.push({ t: 'mia', f: HOY }));   // unrelated user change afterwards
  const ok = await e.llamar('deshacer_ultimo_cambio', {});
  assert.equal(ok.result.isError, undefined);
  assert.equal(e.api.estado().cuerpo[2].peso, 79);
  assert.equal(e.api.estado().notas.comida.length, 1);

  const e2 = entorno();
  await e2.llamar('registrar_cuerpo', { fecha: '2026-09-29', peso: 77.0 });
  e2.api.escribirOtro(s => { s.cuerpo[2].peso = 75; });
  const res = await e2.llamar('deshacer_ultimo_cambio', {});
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /cambiad/);
  assert.equal(e2.api.estado().cuerpo[2].peso, 75);
});

test('deshacer_ultimo_cambio: ignores no-op writes and a missing or corrupt audit log', async () => {
  const e = entorno();
  assert.equal((await e.llamar('deshacer_ultimo_cambio', {})).result.isError, true);
  fs.writeFileSync(e.auditoria, 'basura\n{"tool":"anadir_nota"}\n');
  assert.equal((await e.llamar('deshacer_ultimo_cambio', {})).result.isError, true);
  assert.equal(e.api.puts.length, 0);
});

test('deshacer_ultimo_cambio: rejects arguments', async () => {
  const e = entorno();
  assert.equal((await e.llamar('deshacer_ultimo_cambio', { id: 'x' })).result.isError, true);
});

test('write tools serialize: two calls in a row each see the previous result', async () => {
  const e = entorno();
  await Promise.all([e.llamar('anadir_nota', { texto: 'a' }), e.llamar('anadir_nota', { texto: 'b' })]);
  assert.deepEqual(e.api.estado().notas.comida.map(n => n.t).sort(), ['a', 'b']);
  assert.equal(e.api.puts[1].base, e.api.puts[0].actualizado);
});
