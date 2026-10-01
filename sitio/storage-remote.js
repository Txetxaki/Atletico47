/* OsmaGym - puente de almacenamiento contra el servidor de la Raspberry
 *
 * La app ya venia preparada para esto: en save()/load() comprueba si existe
 * window.storage y, si esta, lo usa en lugar de localStorage. Este archivo
 * define ese window.storage, asi que basta cargarlo ANTES del script de la app.
 *
 * Regla de diseno: localStorage NO desaparece, sigue siendo la copia local.
 * La app funciona sin cobertura (para eso esta el service worker) y hacer que
 * dependa de la red para leer sus propios datos la romperia. Aqui el servidor
 * es la capa de sincronizacion, no el unico sitio donde viven los datos.
 *
 * Gana el mas reciente por marca de tiempo. No es fusion de verdad: si escribes
 * en dos sitios sin sincronizar en medio, uno pisa al otro. Pero el servidor
 * guarda instantanea de cada escritura, asi que lo pisado se recupera desde
 * /api/historial/<clave>.
 *
 * Dos origenes: en la Pi la API es del mismo origen. En cualquier otro (Vercel)
 * se sincroniza con la Pi por la URL de la tailnet si responde; si no, todo
 * sigue como localStorage puro y los cambios quedan pendientes.
 */
(function (root, factory) {
  var puro = factory();
  if (typeof window === 'undefined') { if (typeof module === 'object' && module.exports) module.exports = puro; return; }
  puro.iniciar(root);
})(this, function () {
  'use strict';

  var PI_URL = 'https://raspberry.taile8249e.ts.net:10003';   // unico sitio donde vive; se puede cambiar con localStorage['a47__remoto']
  var TTL_SI = 300000;        // ms que se confia en "la Pi responde"
  var TTL_NO = 120000;        // ms que se confia en "la Pi no responde" (evita sondear en cada guardado)
  var ESPERA_SONDA = 2500;    // ms maximos de la sonda de alcance

  /* Solo se admiten destinos de la tailnet o de la red local: un override no puede sacar los datos a internet. */
  function hostPrivado(url) {
    var host;
    try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return false; }
    return host === 'localhost' || /\.ts\.net$/.test(host) || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  }

  /* Base de la API: '' = mismo origen (la Pi, red local, desarrollo); si no, la URL de la Pi. */
  function elegirBase(o) {
    var ov = o.override;
    if (typeof ov === 'string' && /^https?:\/\/[^\s/]+/i.test(ov) && hostPrivado(ov)) return ov.replace(/\/+$/, '');
    var origen = o.origin || '';
    if (origen === o.piUrl) return '';
    if (hostPrivado(origen)) return '';
    return o.piUrl;
  }

  /* 'si' | 'no' | 'sondar' segun el ultimo resultado de la sonda guardado. */
  function decidirSonda(c, ahora) {
    if (!c || typeof c.ts !== 'number' || c.ts > ahora) return 'sondar';
    var edad = ahora - c.ts;
    if (c.ok) return edad < TTL_SI ? 'si' : 'sondar';
    return edad < TTL_NO ? 'no' : 'sondar';
  }

  function iniciar(w) {
  var CLAVE = 'a47v1';
  var API = '/api/estado/';
  var ESPERA = 6000;          // ms antes de dar la red por perdida
  var REINTENTO = 60000;      // ms entre reintentos si quedo algo pendiente

  function kTs(c)   { return c + '__ts'; }    // cuando se escribio en local
  function kBase(c) { return c + '__base'; }  // ultimo 'actualizado' visto del servidor
  function kPend(c) { return c + '__pend'; }  // hay cambios sin subir

  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var BASE = elegirBase({ origin: w.location.origin, piUrl: PI_URL, override: lget('a47__remoto') });
  var REMOTO = BASE !== '';
  var K_ALCANCE = 'a47__alcance';
  var sondaEnCurso = null;

  /* Identifica el dispositivo en el historial del servidor. Sirve para saber
     desde donde vino cada version cuando haya que recuperar algo. */
  var dispositivo = lget('a47__dispositivo');
  if (!dispositivo) {
    var movil = /Android|iPhone|iPad/i.test(navigator.userAgent);
    dispositivo = (movil ? 'movil' : 'ordenador') + '-' + Math.random().toString(36).slice(2, 7);
    lset('a47__dispositivo', dispositivo);
  }

  var estado = { conectado: null, ultimaSync: null, pendiente: false, conflicto: null, dispositivo: dispositivo };

  function avisar(tipo, detalle) {
    try { w.dispatchEvent(new CustomEvent('a47sync', { detail: { tipo: tipo, detalle: detalle } })); } catch (e) {}
  }

  function pedir(url, opciones) {
    opciones = opciones || {};
    // AbortController evita que una Pi apagada deje la app colgada esperando.
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) opciones.signal = ctrl.signal;
    var reloj = setTimeout(function () { if (ctrl) ctrl.abort(); }, ESPERA);
    if (REMOTO) { opciones.credentials = 'omit'; opciones.mode = 'cors'; }
    return fetch(BASE + url, opciones)
      .then(function (r) { clearTimeout(reloj); return r; })
      .catch(function (e) { clearTimeout(reloj); throw e; });
  }

  function guardarAlcance(ok) {
    lset(K_ALCANCE, JSON.stringify({ ok: ok, ts: Date.now() }));
  }

  /* Solo en origen remoto: Promise<boolean>. Nunca rechaza ni espera mas de ESPERA_SONDA,
     y el resultado se recuerda unos minutos para no repetir el coste fuera de la tailnet. */
  function alcanzable() {
    if (!REMOTO) return Promise.resolve(true);
    var c = null;
    try { c = JSON.parse(lget(K_ALCANCE)); } catch (e) {}
    var d = decidirSonda(c, Date.now());
    if (d !== 'sondar') return Promise.resolve(d === 'si');
    if (sondaEnCurso) return sondaEnCurso;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var reloj = setTimeout(function () { if (ctrl) ctrl.abort(); }, ESPERA_SONDA);
    sondaEnCurso = fetch(BASE + '/api/salud', { credentials: 'omit', mode: 'cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return !!r.ok; }, function () { return false; })
      .then(function (ok) { clearTimeout(reloj); guardarAlcance(ok); sondaEnCurso = null; return ok; });
    return sondaEnCurso;
  }

  function sinAlcance() { return Promise.reject(new Error('Pi fuera de alcance')); }

  function subir(clave) {
    var valor = lget(clave);
    if (valor === null) return Promise.resolve(false);

    var cuerpo = {
      valor: valor,
      actualizado: Number(lget(kTs(clave))) || Date.now(),
      base: lget(kBase(clave)) != null ? Number(lget(kBase(clave))) : null,
      dispositivo: dispositivo
    };

    return alcanzable().then(function (ok) { return ok ? null : sinAlcance(); }).then(function () { return pedir(API + encodeURIComponent(clave), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }); })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
    .then(function (res) {
      lset(kBase(clave), String(res.actualizado));
      lset(kPend(clave), '');
      if (REMOTO) guardarAlcance(true);
      estado.conectado = true;
      estado.pendiente = false;
      estado.ultimaSync = Date.now();
      if (res.conflicto) {
        // Los datos no se han perdido: la version pisada esta en el historial.
        estado.conflicto = res.anterior;
        avisar('conflicto', res.anterior);
      }
      avisar('subido', res);
      return true;
    })
    .catch(function (e) {
      // Sin red no pasa nada malo: queda marcado y se reintenta.
      if (REMOTO && !(e && /fuera de alcance/.test(String(e)))) guardarAlcance(false);
      lset(kPend(clave), '1');
      estado.conectado = false;
      estado.pendiente = true;
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

  w.storage = {
    /* La app hace: window.storage.get(k).then(r => usar(r && r.value)) */
    get: function (clave) {
      var local = lget(clave);
      var tsLocal = Number(lget(kTs(clave))) || 0;

      return alcanzable().then(function (ok) { return ok ? null : sinAlcance(); })
        .then(function () { return pedir(API + encodeURIComponent(clave)); })
        .then(function (r) {
          if (r.status === 404) return null;            // el servidor aun no tiene nada
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (remoto) {
          estado.conectado = true;
          estado.ultimaSync = Date.now();

          if (!remoto) {
            // Servidor vacio: si hay algo en local, sembrarlo alli.
            if (local !== null) subir(clave);
            return local === null ? null : { value: local };
          }

          if (remoto.actualizado >= tsLocal) {
            // El servidor manda: refrescar la copia local.
            lset(clave, remoto.valor);
            lset(kTs(clave), String(remoto.actualizado));
            lset(kBase(clave), String(remoto.actualizado));
            lset(kPend(clave), '');
            avisar('bajado', { actualizado: remoto.actualizado, dispositivo: remoto.dispositivo });
            return { value: remoto.valor };
          }

          // Lo local es mas nuevo (se escribio sin red): subirlo y usarlo.
          lset(kBase(clave), String(remoto.actualizado));
          subir(clave);
          return { value: local };
        })
        .catch(function () {
          // Sin servidor la app tiene que seguir funcionando: eso es el sotano.
          estado.conectado = false;
          avisar('sin-red', 'lectura');
          if (lget(kPend(clave)) === '1') programarReintento(clave);
          return local === null ? null : { value: local };
        });
    },

    /* La app hace: window.storage.set(k, json).catch(...) */
    set: function (clave, valor) {
      // Primero local y sincrono: si el navegador se cierra ahora, no se pierde.
      var ahora = Date.now();
      lset(clave, valor);
      lset(kTs(clave), String(ahora));
      lset(kPend(clave), '1');
      estado.pendiente = true;
      programarReintento(clave);
      return subir(clave).then(function () { /* nunca rechaza: sin red no es un fallo */ });
    },

    estado: function () { return JSON.parse(JSON.stringify(estado)); },
    sincronizar: function (clave) { return subir(clave || CLAVE); }
  };

  // Al recuperar la conexion, subir lo que quedo pendiente.
  w.addEventListener('online', function () {
    if (REMOTO) lset(K_ALCANCE, '');   // la red cambio: volver a sondar
    if (lget(kPend(CLAVE)) === '1') subir(CLAVE);
  });
  }

  return { elegirBase: elegirBase, decidirSonda: decidirSonda, iniciar: iniciar };
});
