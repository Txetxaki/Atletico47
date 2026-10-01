'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const almacen = require('../almacen.js');

test('leerCrudo: a 404 from the state API explains that no data has been synced yet', async () => {
  const ctx = { base: 'http://127.0.0.1:1', fetchFn: async () => ({ ok: false, status: 404, json: async () => ({}) }) };
  await assert.rejects(() => almacen.leerCrudo(ctx), /todavia no hay datos de OsmaGym/);
});

test('leerCrudo: other HTTP failures keep reporting the status', async () => {
  const ctx = { base: 'http://127.0.0.1:1', fetchFn: async () => ({ ok: false, status: 500, json: async () => ({}) }) };
  await assert.rejects(() => almacen.leerCrudo(ctx), /respondio 500/);
});
