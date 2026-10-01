'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { estado, HOY, NOMBRES } = require('./fixtures');
const { PassThrough } = require('node:stream');
const { crearManejador, servir, TOOLS } = require('../mcp-osma');
const { METRICAS } = require('../metricas');

function fetchStub(blob, log) {
  return async (url) => {
    if (log) log.push(String(url));
    return {
      ok: true, status: 200,
      json: async () => ({ valor: JSON.stringify(blob), actualizado: 1, dispositivo: 'test' })
    };
  };
}
function manejador(extra) {
  return crearManejador(Object.assign({ fetchFn: fetchStub(estado()), base: 'http://x:1', nombres: NOMBRES, hoy: HOY }, extra));
}
const rpc = (method, params, id) => ({ jsonrpc: '2.0', id: id === undefined ? 1 : id, method, params });
const texto = (res) => JSON.parse(res.result.content[0].text);

test('initialize: announces protocol version, tools capability and server info', async () => {
  const res = await manejador()(rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } }));
  assert.equal(res.jsonrpc, '2.0');
  assert.equal(res.id, 1);
  assert.equal(res.result.protocolVersion, '2024-11-05');
  assert.deepEqual(res.result.capabilities, { tools: {} });
  assert.equal(res.result.serverInfo.name, 'osmagym');
});

test('notifications/initialized: no reply', async () => {
  const res = await manejador()({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(res, null);
});

test('ping: empty result', async () => {
  assert.deepEqual((await manejador()(rpc('ping', undefined, 7))).result, {});
});

test('unknown method: JSON-RPC error -32601', async () => {
  const res = await manejador()(rpc('nope/nada', {}, 'a'));
  assert.equal(res.id, 'a');
  assert.equal(res.error.code, -32601);
});

test('unknown notification: ignored silently', async () => {
  assert.equal(await manejador()({ jsonrpc: '2.0', method: 'notifications/raro' }), null);
});

test('tools/list: the five read tools first, then the three write tools, Spanish descriptions, JSON schemas', async () => {
  const res = await manejador()(rpc('tools/list'));
  const nombres = res.result.tools.map(t => t.name);
  assert.deepEqual(nombres.slice(0, 5), ['resumen_general', 'historial_ejercicio', 'adherencia', 'tendencia_cuerpo', 'dias_sin_entrenar']);
  res.result.tools.forEach(t => {
    assert.ok(t.description.length > 20, t.name);
    assert.equal(t.inputSchema.type, 'object');
  });
  const tend = res.result.tools.find(t => t.name === 'tendencia_cuerpo');
  assert.deepEqual(tend.inputSchema.required, ['metrica']);
  assert.deepEqual(tend.inputSchema.properties.metrica.enum, ['peso', 'cint', 'sis', 'dia', 'sueN', 'sueS', 'sueTotal', 'cig', 'rodD', 'rodI', 'mun', 'cad', 'dolorMax', 'hoyRod', 'hoySue']);
  assert.equal(TOOLS.length, 8);
});

test('tools/call: dias_sin_entrenar returns compact JSON text', async () => {
  const log = [];
  const res = await manejador({ fetchFn: fetchStub(estado(), log) })(rpc('tools/call', { name: 'dias_sin_entrenar', arguments: {} }));
  assert.equal(res.result.isError, undefined);
  assert.equal(res.result.content[0].type, 'text');
  assert.ok(!res.result.content[0].text.includes('\n'));
  assert.deepEqual(texto(res).fuerza, { dias: 2, ultima: '2026-09-28' });
  assert.deepEqual(log, ['http://x:1/api/estado/a47v1']);
});

test('tools/call: no read tool ever returns the coach code or push endpoints', async () => {
  const h = manejador();
  for (const name of ['resumen_general', 'historial_ejercicio', 'adherencia', 'tendencia_cuerpo', 'dias_sin_entrenar']) {
    const res = await h(rpc('tools/call', { name, arguments: name === 'historial_ejercicio' ? { ejercicio: 'banco' } : name === 'tendencia_cuerpo' ? { metrica: 'peso' } : {} }));
    assert.ok(!/SECRETO|codigo|endpoint/i.test(res.result.content[0].text), name);
  }
  const lista = JSON.stringify((await h(rpc('tools/list'))).result.tools);
  assert.ok(!/codigo|coachCfg/i.test(lista));
});

test('tools/call: every tool works end to end on the fixture', async () => {
  const h = manejador();
  const llamadas = {
    resumen_general: {}, historial_ejercicio: { ejercicio: 'banco', n: 1 },
    adherencia: { semanas: 2 }, tendencia_cuerpo: { metrica: 'peso' }, dias_sin_entrenar: {}
  };
  for (const name of Object.keys(llamadas)) {
    const res = await h(rpc('tools/call', { name, arguments: llamadas[name] }));
    assert.equal(res.result.isError, undefined, name);
    assert.ok(texto(res), name);
  }
});

test('tools/call: state is a JSON string or an object, both work', async () => {
  const f = async () => ({ ok: true, status: 200, json: async () => ({ valor: estado() }) });
  const res = await manejador({ fetchFn: f })(rpc('tools/call', { name: 'dias_sin_entrenar' }));
  assert.equal(texto(res).fuerza.dias, 2);
});

test('tools/call: invalid arguments become an isError result, not a crash', async () => {
  const res = await manejador()(rpc('tools/call', { name: 'tendencia_cuerpo', arguments: { metrica: 'estatura' } }));
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /metrica/);
});

test('tools/call: backend failures become isError results', async () => {
  const caido = async () => { throw new Error('ECONNREFUSED'); };
  const r1 = await manejador({ fetchFn: caido })(rpc('tools/call', { name: 'resumen_general' }));
  assert.equal(r1.result.isError, true);
  assert.match(r1.result.content[0].text, /ECONNREFUSED/);
  const malo = async () => ({ ok: false, status: 404, json: async () => ({ error: 'sin datos' }) });
  const r2 = await manejador({ fetchFn: malo })(rpc('tools/call', { name: 'resumen_general' }));
  assert.equal(r2.result.isError, true);
  assert.match(r2.result.content[0].text, /todavia no hay datos/);
});

test('tools/call: unknown tool is a JSON-RPC invalid-params error', async () => {
  const res = await manejador()(rpc('tools/call', { name: 'borrar_todo' }));
  assert.equal(res.error.code, -32602);
});

test('tools/call: missing params is a JSON-RPC invalid-params error', async () => {
  assert.equal((await manejador()(rpc('tools/call'))).error.code, -32602);
});

test('stdio: newline-delimited JSON round trip against a stub HTTP API', async () => {
  const srv = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ valor: JSON.stringify(estado()), actualizado: 1, dispositivo: 'x' }));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const hijo = spawn(process.execPath, [path.join(__dirname, '..', 'mcp-osma.js')], {
    env: Object.assign({}, process.env, { OSMAGYM_BASE: base }), stdio: ['pipe', 'pipe', 'inherit']
  });
  const lineas = [];
  let buf = '';
  hijo.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lineas.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const espera = async (n) => { for (let i = 0; i < 100 && lineas.length < n; i++) await new Promise(r => setTimeout(r, 50)); };
  try {
    hijo.stdin.write(JSON.stringify(rpc('initialize', { protocolVersion: '2024-11-05' }, 1)) + '\n');
    hijo.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    hijo.stdin.write('esto no es json\n');
    hijo.stdin.write(JSON.stringify(rpc('tools/call', { name: 'dias_sin_entrenar' }, 2)) + '\n');
    await espera(3);
    assert.equal(lineas.length, 3);
    assert.equal(lineas[0].id, 1);
    assert.equal(lineas[1].error.code, -32700);
    assert.equal(lineas[2].id, 2);
    assert.equal(typeof JSON.parse(lineas[2].result.content[0].text).fuerza.dias, 'number');
  } finally {
    hijo.kill();
    srv.close();
  }
});

test('metric names: a single shared list feeds the tendencia_cuerpo enum', async () => {
  const res = await manejador()(rpc('tools/list'));
  const tend = res.result.tools.find(t => t.name === 'tendencia_cuerpo');
  assert.deepEqual(tend.inputSchema.properties.metrica.enum, METRICAS);
  assert.ok(!require('node:fs').readFileSync(path.join(__dirname, '..', 'mcp-osma.js'), 'utf8').includes("'peso', 'sis'"));
});

function canal(manejar) {
  const entrada = new PassThrough(), salida = new PassThrough();
  let txt = '';
  salida.on('data', d => { txt += d; });
  const fin = servir(entrada, salida, manejar);
  return { entrada, fin, lineas: () => txt.split('\n').filter(Boolean).map(JSON.parse) };
}

test('servir: on stdin EOF it drains slow in-flight requests before resolving', async () => {
  const lento = async (msg) => { await new Promise(r => setTimeout(r, 80)); return { jsonrpc: '2.0', id: msg.id, result: {} }; };
  const c = canal(lento);
  c.entrada.write(JSON.stringify(rpc('ping', undefined, 1)) + '\n' + JSON.stringify(rpc('ping', undefined, 2)) + '\n');
  c.entrada.end();
  await c.fin;
  assert.deepEqual(c.lineas().map(l => l.id), [1, 2]);
});

test('servir: a final request without trailing newline is still answered', async () => {
  const c = canal(async (msg) => ({ jsonrpc: '2.0', id: msg.id, result: {} }));
  c.entrada.write(JSON.stringify(rpc('ping', undefined, 9)));
  c.entrada.end();
  await c.fin;
  assert.deepEqual(c.lineas().map(l => l.id), [9]);
});

test('stdio: piped input closed right after the request still gets its reply', async () => {
  const srv = http.createServer((req, res) => {
    setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ valor: JSON.stringify(estado()), actualizado: 1, dispositivo: 'x' })); }, 150);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const hijo = spawn(process.execPath, [path.join(__dirname, '..', 'mcp-osma.js')], {
    env: Object.assign({}, process.env, { OSMAGYM_BASE: 'http://127.0.0.1:' + srv.address().port }), stdio: ['pipe', 'pipe', 'inherit']
  });
  let out = '';
  hijo.stdout.on('data', d => { out += d; });
  const cerrado = new Promise(r => hijo.on('close', r));
  try {
    hijo.stdin.end(JSON.stringify(rpc('tools/call', { name: 'dias_sin_entrenar' }, 5)));
    await cerrado;
    assert.equal(JSON.parse(out.trim()).id, 5);
  } finally { hijo.kill(); srv.close(); }
});
