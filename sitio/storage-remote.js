/* Atlético 47 — puente de almacenamiento contra el servidor de la Raspberry
 *
 * La app comprueba en save()/load() si existe window.storage y, si está, lo usa
 * en lugar de localStorage. Este archivo define ese window.storage.
 *
 * Regla: localStorage sigue siendo la copia local, síncrona y siempre primera.
 * El servidor es la capa de sincronización, no el único sitio donde viven los
 * datos. Gana el más reciente por marca de tiempo; el servidor guarda una
 * instantánea de cada escritura, recuperable desde /api/historial/<clave>.
 */
(function () {
  'use strict';

  var CLAVE = 'a47v1';
  var API = '/api/estado/';
  var ESPERA = 6000;
  var REINTENTO = 60000;

  function kTs(c)   { return c + '__ts'; }
  function kBase(c) { return c + '__base'; }
  function kPend(c) { return c + '__pend'; }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var dispositivo = lget('a47__dispositivo');
  if (!dispositivo) {
    var movil = /Android|iPhone|iPad/i.test(navigator.userAgent);
    dispositivo = (movil ? 'movil' : 'ordenador') + '-' + Math.random().toString(36).slice(2, 7);
    lset('a47__dispositivo', dispositivo);
  }

  var estado = { conectado: null, ultimaSync: null, pendiente: false, conflicto: null, dispositivo: dispositivo };

  function avisar(tipo, detalle) {
    try { window.dispatchEvent(new CustomEvent('a47sync', { detail: { tipo: tipo, detalle: detalle } })); } catch (e) {}
  }

  function pedir(url, opciones) {
    opciones = opciones || {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) opciones.signal = ctrl.signal;
    var reloj = setTimeout(function () { if (ctrl) ctrl.abort(); }, ESPERA);
    return fetch(url, opciones)
      .then(function (r) { clearTimeout(reloj); return r; })
      .catch(function (e) { clearTimeout(reloj); throw e; });
  }

  function subir(clave) {
    var valor = lget(clave);
    if (valor === null) return Promise.resolve(false);
    var cuerpo = {
      valor: valor,
      actualizado: Number(lget(kTs(clave))) || Date.now(),
      base: lget(kBase(clave)) != null ? Number(lget(kBase(clave))) : null,
      dispositivo: dispositivo
    };
    return pedir(API + encodeURIComponent(clave), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
    })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
    .then(function (res) {
      lset(kBase(clave), String(res.actualizado));
      lset(kPend(clave), '');
      estado.conectado = true; estado.pendiente = false; estado.ultimaSync = Date.now();
      if (res.conflicto) { estado.conflicto = res.anterior; avisar('conflicto', res.anterior); }
      avisar('subido', res);
      return true;
    })
    .catch(function (e) {
      lset(kPend(clave), '1');
      estado.conectado = false; estado.pendiente = true;
      avisar('sin-red', String(e));
      return false;
    });
  }

  var temporizador = null;
  function programarReintento(clave) {
    if (temporizador) return;
    temporizador = setInterval(function () {
      if (lget(kPend(clave)) === '1') subir(clave);
      else { clearInterval(temporizador); temporizador = null; }
    }, REINTENTO);
  }

  window.storage = {
    get: function (clave) {
      var local = lget(clave);
      var tsLocal = Number(lget(kTs(clave))) || 0;
      return pedir(API + encodeURIComponent(clave))
        .then(function (r) {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (remoto) {
          estado.conectado = true; estado.ultimaSync = Date.now();
          if (!remoto) {
            if (local !== null) subir(clave);
            return local === null ? null : { value: local };
          }
          if (remoto.actualizado >= tsLocal) {
            lset(clave, remoto.valor);
            lset(kTs(clave), String(remoto.actualizado));
            lset(kBase(clave), String(remoto.actualizado));
            lset(kPend(clave), '');
            avisar('bajado', { actualizado: remoto.actualizado, dispositivo: remoto.dispositivo });
            return { value: remoto.valor };
          }
          lset(kBase(clave), String(remoto.actualizado));
          subir(clave);
          return { value: local };
        })
        .catch(function () {
          estado.conectado = false;
          avisar('sin-red', 'lectura');
          if (lget(kPend(clave)) === '1') programarReintento(clave);
          return local === null ? null : { value: local };
        });
    },
    set: function (clave, valor) {
      var ahora = Date.now();
      lset(clave, valor);
      lset(kTs(clave), String(ahora));
      lset(kPend(clave), '1');
      estado.pendiente = true;
      programarReintento(clave);
      return subir(clave).then(function () {});
    },
    estado: function () { return JSON.parse(JSON.stringify(estado)); },
    sincronizar: function (clave) { return subir(clave || CLAVE); }
  };

  window.addEventListener('online', function () { if (lget(kPend(CLAVE)) === '1') subir(CLAVE); });
})();
