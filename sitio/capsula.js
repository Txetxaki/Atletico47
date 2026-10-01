/* OsmaGym - context capsule for the Coach ("modo señalar").
   Pure functions, no DOM access: the page passes node-like objects.
   Browser: window.OsmaCapsula. Node: module.exports. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OsmaCapsula = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_TEXTO = 200, MAX_DATOS = 400, MAX_TOTAL = 1200, MAX_LINEA = 480;
  var PANTALLAS = { hoy: 'Hoy', tr: 'Entreno', hi: 'Progreso', pa: 'Pádel', cu: 'Cuerpo', co: 'Comida', ai: 'Coach', aj: 'Ajustes' };
  var SECRETO = /codigo|code|token|secret|password|clave|key/i;

  function recortar(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) : s;
  }

  /* shallow copy of scalar values only, without anything that looks like a secret,
     capped so that the serialized result never exceeds MAX_DATOS */
  function limpiarDatos(d) {
    var out = {}, k, v;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return out;
    for (k in d) {
      if (!Object.prototype.hasOwnProperty.call(d, k) || SECRETO.test(k)) continue;
      v = d[k];
      if (typeof v === 'string') v = recortar(v, 80);
      else if (typeof v !== 'number' && typeof v !== 'boolean') continue;
      out[k] = v;
      if (JSON.stringify(out).length > MAX_DATOS) { delete out[k]; break; }
    }
    return out;
  }

  function describir(n) {
    var ds = n.dataset || {}, datos = {};
    try { datos = ds.coachDatos ? JSON.parse(ds.coachDatos) : {}; } catch (e) { datos = {}; }
    return { tipo: ds.coachTipo, id: ds.coachId || '', texto: ds.coachTexto || n.textContent, datos: datos };
  }

  function normalizar(el) {
    if (!el || typeof el !== 'object') return null;
    if (el.dataset || el.parentNode) el = resolverElemento(el);
    if (!el || !el.tipo) return null;
    return { tipo: recortar(el.tipo, 30), id: recortar(el.id, 60), texto: recortar(el.texto, MAX_TEXTO), datos: limpiarDatos(el.datos) };
  }

  function resolverElemento(nodo) {
    var vistos = 0;
    while (nodo && typeof nodo === 'object' && vistos++ < 50) {
      if (nodo.dataset && nodo.dataset.coachTipo) {
        var d = describir(nodo);
        return { tipo: d.tipo, id: d.id, texto: recortar(d.texto, MAX_TEXTO), datos: d.datos };
      }
      nodo = nodo.parentNode;
    }
    return null;
  }

  function detalle(datos) {
    if (typeof datos.detalle === 'string' && datos.detalle) return datos.detalle;
    return Object.keys(datos).map(function (k) { return k + ': ' + datos[k]; }).join(', ');
  }

  function resumenDe(pantalla, el) {
    var s = 'pantalla ' + (PANTALLAS[pantalla] || pantalla);
    if (el) {
      var d = detalle(el.datos);
      s += ' · señalado: ' + el.tipo + (el.texto ? ' ' + el.texto : '') + (d ? ' (' + d + ')' : '');
    }
    return recortar(s, MAX_LINEA - 13);
  }

  function construirCapsula(o) {
    o = o || {};
    var pantalla = recortar(o.pantalla, 20), el = normalizar(o.elemento);
    var est = {}, e = o.estado;
    if (e && typeof e === 'object') est = limpiarDatos(e);
    var c = { pantalla: pantalla, elemento: el, estado: est, resumen: resumenDe(pantalla, el) };
    if (o.ahora != null) {
      var t = new Date(o.ahora);
      if (!isNaN(t.getTime())) c.ts = t.toISOString();
    }
    while (JSON.stringify(c).length > MAX_TOTAL && Object.keys(c.estado).length) delete c.estado[Object.keys(c.estado)[0]];
    return c;
  }

  function capsulaATexto(c) {
    if (!c || typeof c !== 'object') return '';
    var s = '[Contexto: ' + (c.resumen || 'pantalla ' + (PANTALLAS[c.pantalla] || c.pantalla || '?')) + ']';
    return s;
  }

  return { construirCapsula: construirCapsula, capsulaATexto: capsulaATexto, resolverElemento: resolverElemento };
});
