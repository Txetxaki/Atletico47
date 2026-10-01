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
 * La Pi es la fuente de verdad. Cada PUT lleva la 'base' (ultima version vista);
 * si otro dispositivo escribio despues, el servidor fusiona registro a registro
 * (merge.js) y devuelve el resultado, que aqui sustituye a la copia local. Con la
 * app abierta se traen los cambios ajenos al volver a ella, al recuperar la red y
 * cada 20 s mientras se ve y la Pi responde. Toda escritura deja instantanea en
 * /api/historial/<clave>.
 *
 * Eventos 'a47sync' (detail.tipo): bajado, fusionado, subido, conflicto,
 * sin-red, local-conservado.
 *
 * Dos origenes: en la Pi la API es del mismo origen. En cualquier otro (Vercel)
 * se sincroniza con la Pi por la URL de la tailnet si responde; si no, todo
 * sigue como localStorage puro y los cambios quedan pendientes.
 */
(function (root, factory) {
  var puro = factory();
  if (typeof window === 'undefined') { if (typeof module === 'object' && module.exports) module.exports = puro; return; }
  root.OsmaSync = puro;
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

  /* Primer contacto de un dispositivo con el servidor (nunca habia visto su 'base'): si los dos lados
     tienen datos y son distintos, jamas se pisa lo local a ciegas. Gana el mas grande (el que mas registros
     acumula); si gana el servidor, el llamador guarda antes una copia de lo local. */
  function primerContacto(o) {
    if (o.tieneBase || o.mismoDispositivo || o.local == null || o.remoto == null || o.local === o.remoto) return 'normal';
    return String(o.local).length >= String(o.remoto).length ? 'local' : 'remoto-con-respaldo';
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

  /* Que hacer al refrescar: 'subir' lo pendiente primero (el servidor fusiona si choca), pasar por la regla
     de 'primer-contacto' si este dispositivo nunca sincronizo, 'adoptar' solo una version remota mas nueva. */
  function decidirRefresco(o) {
    if (o.pendiente) return 'subir';
    if (!o.tieneBase) return 'primer-contacto';
    if (!o.remoto || typeof o.remoto.actualizado !== 'number') return 'nada';
    return o.remoto.actualizado > Number(o.base) ? 'adoptar' : 'nada';
  }

  /* El sondeo periodico solo corre con la app a la vista y sin un "no responde" reciente: no se machaca a una Pi caida. */
  function tocaRefrescar(o) { return !!o.visible && o.sonda !== 'no'; }

  /* Que guardar en local tras un PUT correcto. Si el usuario guardo algo mientras tanto (localAhora distinto de lo
     enviado), jamas se pisa: se queda pendiente. Tras una fusion ademas no se avanza la base, para que el siguiente
     PUT vuelva a fusionar en lugar de borrar lo que trajo el otro dispositivo. */
  function trasSubir(o) {
    var res = o.res || {}, intacto = o.localAhora === o.enviado;
    if (res.fusionado && typeof res.valor === 'string') {
      if (!intacto) return { pend: '1', fusionado: false };
      return { valor: res.valor, ts: res.actualizado, base: res.actualizado, pend: '', fusionado: true };
    }
    return { base: res.actualizado, pend: intacto ? '' : '1', fusionado: false };
  }

  function haceCuanto(ts, ahora) {
    if (typeof ts !== 'number') return 'nunca';
    var s = Math.floor((ahora - ts) / 1000);
    if (s < 60) return 'ahora mismo';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
    return 'hace ' + Math.floor(s / 86400) + ' d';
  }

  /* Texto del "Ultimo error" del panel: los fallos de red del navegador vienen en ingles y dicen poco. */
  function mensajeError(e) {
    if (e == null) return 'error desconocido';
    var m = String(e.message || e);
    if (e.name === 'AbortError') return 'la Pi tardó demasiado en responder';
    if (/Failed to fetch|NetworkError|Load failed|fuera de alcance/i.test(m)) return 'la Pi no responde';
    if (/^HTTP \d+$/.test(m)) return 'el servidor respondió ' + m;
    return m;
  }

  function etiquetaConexion(alcanzable) {
    if (alcanzable === true) return 'Conectado a la Pi';
    if (alcanzable === false) return 'Sin conexión con la Pi';
    return 'Copia local';
  }

  function iniciar(w) {
  var API = '/api/estado/';
  var CLAVE_APP = 'a47v1';
  var ESPERA = 6000;          // ms antes de dar la red por perdida
  var REINTENTO = 60000;      // ms entre reintentos si quedo algo pendiente
  var REFRESCO = 20000;       // ms entre sondeos de cambios remotos con la app a la vista
  var HUECO = 3000;           // ms minimos entre refrescos automaticos (focus y visibilitychange llegan juntos)

  function kTs(c)   { return c + '__ts'; }    // cuando se escribio en local
  function kBase(c) { return c + '__base'; }  // ultimo 'actualizado' visto del servidor
  function kPend(c) { return c + '__pend'; }  // hay cambios sin subir

  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var BASE = elegirBase({ origin: w.location.origin, piUrl: PI_URL, override: lget('a47__remoto') });
  var REMOTO = BASE !== '';
  var K_ALCANCE = 'a47__alcance';
  var K_ULTIMA = 'a47__ultimaSync';
  var sondaEnCurso = null;

  /* Identifica el dispositivo en el historial del servidor. Sirve para saber
     desde donde vino cada version cuando haya que recuperar algo. */
  var dispositivo = lget('a47__dispositivo');
  if (!dispositivo) {
    var movil = /Android|iPhone|iPad/i.test(navigator.userAgent);
    dispositivo = (movil ? 'movil' : 'ordenador') + '-' + Math.random().toString(36).slice(2, 7);
    lset('a47__dispositivo', dispositivo);
  }

  var estado = { conectado: null, ultimaSync: Number(lget(K_ULTIMA)) || null, pendiente: lget(kPend(CLAVE_APP)) === '1',
    conflicto: null, dispositivo: dispositivo, ultimoError: null, ultimaFusion: null };

  function avisar(tipo, detalle) {
    try { w.dispatchEvent(new CustomEvent('a47sync', { detail: { tipo: tipo, detalle: detalle } })); } catch (e) {}
  }

  function sincronizado() {
    estado.conectado = true;
    estado.ultimaSync = Date.now();
    lset(K_ULTIMA, String(estado.ultimaSync));
    guardarAlcance(true);
  }

  function anotarError(e) {
    estado.ultimoError = { ts: Date.now(), mensaje: mensajeError(e) };
  }

  function pedir(url, opciones) {
    opciones = opciones || {};
    // AbortController evita que una Pi apagada deje la app colgada esperando.
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) opciones.signal = ctrl.signal;
    var reloj = setTimeout(function () { if (ctrl) ctrl.abort(); }, ESPERA);
    if (REMOTO) { opciones.credentials = 'omit'; opciones.mode = 'cors'; }
    opciones.cache = 'no-store';
    return fetch(BASE + url, opciones)
      .then(function (r) { clearTimeout(reloj); return r; })
      .catch(function (e) { clearTimeout(reloj); throw e; });
  }

  /* Se guarda tambien en el mismo origen: ahi no decide si se pide (siempre se pide), pero el sondeo
     periodico lo usa para no insistir contra un servidor caido. */
  function guardarAlcance(ok) {
    lset(K_ALCANCE, JSON.stringify({ ok: ok, ts: Date.now() }));
  }

  function leerAlcance() {
    try { return JSON.parse(lget(K_ALCANCE)); } catch (e) { return null; }
  }

  /* Solo en origen remoto: Promise<boolean>. Nunca rechaza ni espera mas de ESPERA_SONDA,
     y el resultado se recuerda unos minutos para no repetir el coste fuera de la tailnet. */
  function alcanzable() {
    if (!REMOTO) return Promise.resolve(true);
    var d = decidirSonda(leerAlcance(), Date.now());
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

  /* Fallo de red o del servidor: se anota y, si no fue la sonda la que ya lo sabia, se recuerda que no responde. */
  function fallo(e, donde) {
    if (!(e && /fuera de alcance/.test(String(e)))) guardarAlcance(false);
    estado.conectado = false;
    anotarError(e);
    avisar('sin-red', donde);
  }

  function subirUna(clave) {
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
      var plan = trasSubir({ enviado: valor, localAhora: lget(clave), res: res });
      if (plan.valor !== undefined) { lset(clave, plan.valor); lset(kTs(clave), String(plan.ts)); }
      if (plan.base !== undefined) lset(kBase(clave), String(plan.base));
      lset(kPend(clave), plan.pend);
      sincronizado();
      estado.pendiente = plan.pend === '1';
      if (res.conflicto) {
        // Los datos no se han perdido: con fusion estan en la version nueva, y en todo caso en el historial.
        estado.conflicto = res.anterior;
        avisar('conflicto', res.anterior);
      }
      if (plan.fusionado) {
        estado.ultimaFusion = { ts: Date.now(), actualizado: res.actualizado, con: res.anterior ? res.anterior.dispositivo : null };
        avisar('fusionado', { clave: clave, actualizado: res.actualizado, anterior: res.anterior });
      }
      avisar('subido', { clave: clave, actualizado: res.actualizado, conflicto: !!res.conflicto, fusionado: plan.fusionado });
      return true;
    })
    .catch(function (e) {
      // Sin red no pasa nada malo: queda marcado y se reintenta.
      lset(kPend(clave), '1');
      estado.pendiente = true;
      fallo(e, String(e));
      return false;
    });
  }

  /* Una subida por clave a la vez: dos PUT en vuelo con la misma base harian que el segundo pareciera un
     choque consigo mismo. Lo que se guarde mientras tanto sale en cuanto vuelve la anterior. */
  var vuelo = {};
  function subir(clave) {
    if (vuelo[clave]) return vuelo[clave].then(function () { return lget(kPend(clave)) === '1' ? subir(clave) : true; });
    var p = subirUna(clave).then(function (r) { vuelo[clave] = null; return r; });
    vuelo[clave] = p;
    return p;
  }

  var temporizador = null;
  function programarReintento(clave) {
    if (temporizador) return;
    temporizador = setInterval(function () {
      if (lget(kPend(clave)) === '1') subir(clave);
      else { clearInterval(temporizador); temporizador = null; }
    }, REINTENTO);
  }

  function adoptar(clave, remoto) {
    lset(clave, remoto.valor);
    lset(kTs(clave), String(remoto.actualizado));
    lset(kBase(clave), String(remoto.actualizado));
    lset(kPend(clave), '');
    estado.pendiente = false;
    avisar('bajado', { clave: clave, actualizado: remoto.actualizado, dispositivo: remoto.dispositivo });
  }

  var arrancado = false;      // los refrescos automaticos esperan a la primera lectura de la app

  /* Dos lecturas a la vez (la de la app y otra) decidirian el primer contacto cada una por su lado. */
  var leyendo = {};
  function leer(clave) {
    if (!leyendo[clave]) leyendo[clave] = leerUna(clave).then(function (r) { leyendo[clave] = null; return r; });
    return leyendo[clave];
  }

  function leerUna(clave) {
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
        sincronizado();

        if (!remoto) {
          // Servidor vacio: si hay algo en local, sembrarlo alli.
          if (local !== null) subir(clave);
          return local === null ? null : { value: local };
        }

        var contacto = primerContacto({ local: local, remoto: remoto.valor, tieneBase: lget(kBase(clave)) != null, mismoDispositivo: remoto.dispositivo === dispositivo });
        if (contacto !== 'normal') {
          // Primer contacto con datos en los dos lados: la copia local se guarda siempre antes de decidir.
          lset(clave + '__respaldo_local', local);
          lset(clave + '__respaldo_local_ts', String(Date.now()));
        }
        if (contacto === 'local') {
          // Lo local es mas completo: sube y pasa a ser la version vigente (el servidor conserva la otra en su historial).
          lset(kBase(clave), String(remoto.actualizado));
          lset(kTs(clave), String(Date.now()));
          subir(clave);
          avisar('local-conservado', { dispositivo: remoto.dispositivo });
          return { value: local };
        }

        if (remoto.actualizado >= tsLocal) {
          // El servidor manda: refrescar la copia local.
          adoptar(clave, remoto);
          return { value: remoto.valor };
        }

        // Lo local es mas nuevo (se escribio sin red): subirlo y usarlo.
        lset(kBase(clave), String(remoto.actualizado));
        subir(clave);
        return { value: local };
      })
      .catch(function (e) {
        // Sin servidor la app tiene que seguir funcionando: eso es el sotano.
        fallo(e, 'lectura');
        if (lget(kPend(clave)) === '1') programarReintento(clave);
        return local === null ? null : { value: local };
      })
      .then(function (r) { arrancado = true; return r; });
  }

  /* Trae los cambios de otros dispositivos. Lo pendiente sube antes (el servidor fusiona si hay choque y la
     respuesta ya trae la fusion); solo se adopta lo remoto si aqui no queda nada sin subir. Nunca rechaza. */
  function bajar(clave) {
    if (lget(kPend(clave)) === '1') return Promise.resolve(false);   // la subida fallo: no hay nada seguro que adoptar
    if (decidirRefresco({ pendiente: false, tieneBase: lget(kBase(clave)) != null }) === 'primer-contacto') {
      return leer(clave).then(function () { return true; });
    }
    return alcanzable().then(function (ok) { return ok ? null : sinAlcance(); })
      .then(function () { return pedir(API + encodeURIComponent(clave)); })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (remoto) {
        sincronizado();
        var d = decidirRefresco({ pendiente: lget(kPend(clave)) === '1', tieneBase: lget(kBase(clave)) != null, base: lget(kBase(clave)), remoto: remoto });
        if (d === 'adoptar') { adoptar(clave, remoto); return true; }
        if (d === 'subir') return subir(clave);      // se guardo algo mientras llegaba la respuesta
        return false;
      })
      .catch(function (e) { fallo(e, 'refresco'); return false; });
  }

  var refrescando = null, ultimoRefresco = 0;
  function refrescar(clave) {
    clave = clave || CLAVE_APP;
    if (refrescando) return refrescando;
    refrescando = (lget(kPend(clave)) === '1' ? subir(clave) : Promise.resolve(true))
      .then(function () { return bajar(clave); })
      .catch(function (e) { anotarError(e); return false; })
      .then(function (r) { refrescando = null; ultimoRefresco = Date.now(); return r; });
    return refrescando;
  }

  function refrescoAuto() {
    if (!arrancado || Date.now() - ultimoRefresco < HUECO) return;
    refrescar(CLAVE_APP);
  }

  function visible() { try { return w.document.visibilityState !== 'hidden'; } catch (e) { return true; } }

  w.storage = {
    /* La app hace: window.storage.get(k).then(r => usar(r && r.value)) */
    get: leer,

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
    sincronizar: function (clave) { return subir(clave || CLAVE_APP); },
    refrescar: refrescar,

    /* Boton "Sincronizar ahora": olvida lo que se sabia del alcance y sube + baja ya. */
    forzar: function (clave) {
      lset(K_ALCANCE, '');
      return (refrescando || Promise.resolve()).then(function () { lset(K_ALCANCE, ''); return refrescar(clave); });
    },

    estadoSync: function () {
      var d = decidirSonda(leerAlcance(), Date.now());
      return {
        remoto: BASE || w.location.origin,
        copiaRemota: REMOTO,
        alcanzable: d === 'si' ? true : d === 'no' ? false : estado.conectado,
        ultimaSync: estado.ultimaSync,
        pendiente: lget(kPend(CLAVE_APP)) === '1',
        dispositivo: dispositivo,
        ultimoError: estado.ultimoError,
        ultimaFusion: estado.ultimaFusion
      };
    }
  };

  // Al recuperar la conexion: volver a sondar, subir lo pendiente y traer lo nuevo.
  w.addEventListener('online', function () {
    lset(K_ALCANCE, '');
    if (arrancado) refrescar(CLAVE_APP);
    else if (lget(kPend(CLAVE_APP)) === '1') subir(CLAVE_APP);
  });
  // Al volver a la app (cambio de pestana, desbloquear el movil) se miran los cambios de otros dispositivos.
  try { w.document.addEventListener('visibilitychange', function () { if (visible()) refrescoAuto(); }); } catch (e) {}
  w.addEventListener('focus', refrescoAuto);
  setInterval(function () {
    if (tocaRefrescar({ visible: visible(), sonda: decidirSonda(leerAlcance(), Date.now()) })) refrescoAuto();
  }, REFRESCO);
  }

  return { elegirBase: elegirBase, decidirSonda: decidirSonda, primerContacto: primerContacto, decidirRefresco: decidirRefresco,
    tocaRefrescar: tocaRefrescar, trasSubir: trasSubir, haceCuanto: haceCuanto, etiquetaConexion: etiquetaConexion, mensajeError: mensajeError, iniciar: iniciar };
});
