'use strict';
// In-memory stand-in for api-estado.js with the same PUT semantics: the write is ALWAYS stored
// and snapshotted; `conflicto` is only reported when the stored `actualizado` is newer than `base`.
const KEY = 'a47v1';

function apiStub(blob, opts) {
  opts = opts || {};
  const api = {
    fila: { valor: JSON.stringify(blob), actualizado: 1000, dispositivo: 'movil-abc' },
    historial: [],
    puts: [],          // bodies received, parsed
    gets: 0,
    reloj: 1000,
    alAntesDePut: opts.alAntesDePut || null   // (n, api) => void, simulates a concurrent writer
  };
  let id = 0;
  function guardar(valor, actualizado, dispositivo) {
    api.fila = { valor, actualizado, dispositivo };
    api.historial.push(Object.assign({ id: ++id }, api.fila));
  }
  api.escribirOtro = (mutar, dispositivo) => {
    const s = JSON.parse(api.fila.valor);
    mutar(s);
    api.reloj = Math.max(api.reloj, Date.now()) + 10;   // real clients stamp Date.now()
    guardar(JSON.stringify(s), api.reloj, dispositivo || 'ordenador-xyz');
  };
  api.estado = () => JSON.parse(api.fila.valor);
  const resp = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo });
  api.fetchFn = async (url, init) => {
    const ruta = new URL(url).pathname.split('/').filter(Boolean);
    const metodo = (init && init.method) || 'GET';
    if (opts.caido) throw new Error('ECONNREFUSED');
    if (ruta[1] === 'estado' && ruta[2] === KEY && metodo === 'GET') { api.gets++; return resp(200, api.fila); }
    if (ruta[1] === 'estado' && ruta[2] === KEY && metodo === 'PUT') {
      const cuerpo = JSON.parse(init.body);
      api.puts.push(cuerpo);
      if (api.alAntesDePut) api.alAntesDePut(api.puts.length, api);
      const previo = api.fila;
      const conflicto = previo.actualizado > Number(cuerpo.base);
      guardar(cuerpo.valor, Number(cuerpo.actualizado), cuerpo.dispositivo);
      return resp(200, { ok: true, actualizado: Number(cuerpo.actualizado), conflicto,
        anterior: conflicto ? { actualizado: previo.actualizado, dispositivo: previo.dispositivo } : null });
    }
    if (ruta[1] === 'historial' && ruta[2] === KEY && !ruta[3]) {
      return resp(200, api.historial.slice().reverse().map(h => ({ id: h.id, actualizado: h.actualizado, dispositivo: h.dispositivo, bytes: h.valor.length })));
    }
    if (ruta[1] === 'historial' && ruta[2] === KEY && ruta[3]) {
      const h = api.historial.find(x => x.id === Number(ruta[3]));
      return h ? resp(200, { valor: h.valor, actualizado: h.actualizado, dispositivo: h.dispositivo }) : resp(404, { error: 'instantanea no encontrada' });
    }
    return resp(404, { error: 'ruta de api desconocida' });
  };
  return api;
}

module.exports = { apiStub };
