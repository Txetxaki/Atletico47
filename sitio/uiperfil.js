/* OsmaGym - declarative appearance profile (S.ui), edited by the user or by the Coach.
   Pure functions, no DOM access: app.js applies the result. NOTHING here is ever executed
   or injected as markup: the profile is a closed schema of validated values.
   Browser: window.OsmaUi. Node: module.exports. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OsmaUi = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FONDOS = ['#0C0B09', '#17130E'];  // page (--ink) and cards (--card) in index.html: the accent must read on both
  var ACENTO_DEF = '#FFC72C';        // the app's gold (--acc)
  var MIN_CONTRASTE = 4.5;           // WCAG AA for normal text
  /* theme gold, warn orange, a red lifted just enough to pass on --card (the raw --red is 4.3:1 there),
     theme green, and neutrals: cream (--paper), sand, ice blue */
  var PALETA = ['#FFC72C', '#FF9F1C', '#EC4E42', '#1FA64A', '#F5EEDC', '#C9C2B2', '#7FB7E6'];
  var TABS = ['hoy', 'tr', 'hi', 'pa', 'cu', 'co', 'ai', 'aj'];
  var PROTEGIDAS = ['hoy', 'ai'];    // Hoy and Coach can never be hidden: the way back
  var FUENTES = { normal: '1', grande: '1.12', enorme: '1.25' };
  var DENSIDADES = ['comoda', 'compacta'];
  var CLAVES = ['acento', 'fuente', 'densidad', 'pestanasOcultas', 'etiquetas', 'ordenPestanas'];
  var ETIQUETA = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ ]{1,14}$/;

  function esObjeto(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function clon(o) { return JSON.parse(JSON.stringify(o)); }
  function igual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function mal(motivo) { return { ok: false, motivo: motivo }; }
  function rgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join('').toUpperCase(); }

  function luminancia(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contraste(a, b) {
    var la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function visibles(ui) {
    var o = ui.pestanasOcultas || [];
    return TABS.filter(function (t) { return o.indexOf(t) < 0; });
  }

  function validar(ui) {
    if (!esObjeto(ui)) return mal('El perfil de aspecto no es válido');
    var k, i;
    for (k in ui) if (CLAVES.indexOf(k) < 0) return mal('Ajuste desconocido: ' + k);
    if (ui.acento !== undefined) {
      if (typeof ui.acento !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(ui.acento)) return mal('El color debe ser #RRGGBB');
      if (FONDOS.some(function (f) { return contraste(ui.acento, f) < MIN_CONTRASTE; })) return mal('Ese color se lee mal sobre el fondo oscuro: elige uno más claro');
    }
    if (ui.fuente !== undefined && !Object.prototype.hasOwnProperty.call(FUENTES, ui.fuente)) return mal('Tamaño de letra: normal, grande o enorme');
    if (ui.densidad !== undefined && DENSIDADES.indexOf(ui.densidad) < 0) return mal('Densidad: comoda o compacta');
    if (ui.pestanasOcultas !== undefined) {
      if (!Array.isArray(ui.pestanasOcultas)) return mal('pestanasOcultas debe ser una lista');
      for (i = 0; i < ui.pestanasOcultas.length; i++) {
        var t = ui.pestanasOcultas[i];
        if (TABS.indexOf(t) < 0) return mal('Pestaña desconocida: ' + t);
        if (PROTEGIDAS.indexOf(t) >= 0) return mal('No se puede ocultar la pestaña ' + t + ' (Hoy y Coach siempre visibles)');
        if (ui.pestanasOcultas.indexOf(t) !== i) return mal('Pestaña repetida: ' + t);
      }
    }
    if (ui.etiquetas !== undefined) {
      if (!esObjeto(ui.etiquetas)) return mal('etiquetas debe ser un objeto');
      for (k in ui.etiquetas) {
        if (TABS.indexOf(k) < 0) return mal('Pestaña desconocida: ' + k);
        if (typeof ui.etiquetas[k] !== 'string' || !ETIQUETA.test(ui.etiquetas[k].trim())) return mal('Nombre no válido (máx. 14, solo letras, números y espacios)');
      }
    }
    if (ui.ordenPestanas !== undefined) {
      var vis = visibles(ui), ord = ui.ordenPestanas;
      if (!Array.isArray(ord) || ord.length !== vis.length || vis.some(function (t) { return ord.indexOf(t) < 0; }))
        return mal('El orden debe incluir exactamente las pestañas visibles, una vez cada una');
    }
    return { ok: true };
  }

  /* drops empty containers so the stored profile stays minimal */
  function limpiar(ui) {
    ['pestanasOcultas', 'ordenPestanas'].forEach(function (k) { if (ui[k] && !ui[k].length) delete ui[k]; });
    if (ui.etiquetas) {
      Object.keys(ui.etiquetas).forEach(function (t) { ui.etiquetas[t] = ui.etiquetas[t].trim(); });
      if (!Object.keys(ui.etiquetas).length) delete ui.etiquetas;
    }
    return ui;
  }

  /* cambio: partial profile; null removes a setting; etiquetas merge per tab (null removes one).
     Returns {ok, ui, deshacer} or {ok:false, motivo}. deshacer is the minimal inverse patch. */
  function fusionar(actual, cambio) {
    if (!esObjeto(cambio) || !Object.keys(cambio).length) return mal('No hay nada que cambiar');
    var base = esObjeto(actual) ? clon(actual) : {}, nuevo = clon(base), k;
    for (k in cambio) if (CLAVES.indexOf(k) < 0) return mal('Ajuste desconocido: ' + k);
    CLAVES.forEach(function (c) {
      if (cambio[c] === undefined) return;
      if (c === 'etiquetas' && esObjeto(cambio.etiquetas)) {
        var e = nuevo.etiquetas || {};
        Object.keys(cambio.etiquetas).forEach(function (t) {
          if (cambio.etiquetas[t] === null) delete e[t]; else e[t] = cambio.etiquetas[t];
        });
        nuevo.etiquetas = e;
      } else if (cambio[c] === null) delete nuevo[c];
      else nuevo[c] = clon(cambio[c]);
    });
    if (cambio.ordenPestanas === undefined && nuevo.ordenPestanas) {
      var vis = visibles(nuevo), o = nuevo.ordenPestanas.filter(function (t) { return vis.indexOf(t) >= 0; });
      vis.forEach(function (t) { if (o.indexOf(t) < 0) o.push(t); });
      nuevo.ordenPestanas = o;
    }
    limpiar(nuevo);
    var v = validar(nuevo);
    if (!v.ok) return v;
    if (igual(base, nuevo)) return mal('Ya estaba así');
    var inv = {};
    CLAVES.forEach(function (c) {
      if (igual(base[c], nuevo[c])) return;
      if (c === 'etiquetas') {
        var a = base.etiquetas || {}, b = nuevo.etiquetas || {}, p = {};
        TABS.forEach(function (t) { if (a[t] !== b[t]) p[t] = a[t] === undefined ? null : a[t]; });
        inv.etiquetas = p;
      } else inv[c] = base[c] === undefined ? null : base[c];
    });
    return { ok: true, ui: nuevo, deshacer: inv };
  }

  /* profile -> what the page must set: CSS custom properties on :root and classes on <body>.
     An invalid or empty profile yields the defaults, never a partial application. */
  function aplicarEstilos(ui) {
    var ok = esObjeto(ui) && validar(ui).ok, p = ok ? ui : {};
    var ac = (p.acento || ACENTO_DEF).toUpperCase(), c = rgb(ac);
    return {
      cssVars: {
        '--acc': ac,
        '--acc-dk': hex(c.map(function (v) { return v * 0.85; })),
        '--acc-rgb': c.join(','),
        '--escala': FUENTES[p.fuente || 'normal']
      },
      clases: p.densidad === 'compacta' ? ['d-compacta'] : []
    };
  }

  /* visible tabs in display order with their label: base maps tab id -> default label */
  function pestanas(ui, base) {
    var p = esObjeto(ui) && validar(ui).ok ? ui : {}, ids = p.ordenPestanas || visibles(p);
    return ids.map(function (id) { return { id: id, label: (p.etiquetas && p.etiquetas[id]) || (base && base[id]) || id }; });
  }

  return {
    PALETA: PALETA, TABS: TABS, FONDOS: FONDOS,
    contraste: contraste, validar: validar, fusionar: fusionar, aplicarEstilos: aplicarEstilos, pestanas: pestanas
  };
});
