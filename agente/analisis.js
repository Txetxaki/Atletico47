'use strict';
/* OsmaGym - pure analysis over the app state blob (the `valor` of /api/estado/a47v1).
 * No I/O here: every function takes the parsed blob and returns plain data, so it is
 * trivially unit-testable. Options: { hoy: 'YYYY-MM-DD', nombres: {id: name} }.
 * Free text typed in the app (notes of a set, of a match or of the body record) is NOT echoed
 * by the summary; the exercise history returns set notes as data only. */

const { METRICAS, FUENTES } = require('./metricas');

const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

function fechaLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hoyDe(o) { return (o && o.hoy) || fechaLocal(new Date()); }
function diasEntre(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function sumaDias(f, n) {
  const d = new Date(f + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return fechaLocal(d);
}
function lunesDe(f) {
  const d = new Date(f + 'T00:00:00');
  return sumaDias(f, -((d.getDay() + 6) % 7));
}
function diaDe(f) { return DIAS[(new Date(f + 'T00:00:00').getDay() + 6) % 7]; }
function redondea(x, dec) {
  if (typeof x !== 'number' || !isFinite(x)) return null;
  const k = Math.pow(10, dec === undefined ? 1 : dec);
  return Math.round(x * k) / k;
}
function lista(x) { return Array.isArray(x) ? x : []; }
function ultimaFecha(fechas) {
  const f = fechas.filter(Boolean).sort();
  return f.length ? f[f.length - 1] : null;
}
function hace(ultima, hoy) { return { dias: ultima ? diasEntre(ultima, hoy) : null, ultima }; }

function fechasFuerza(estado) { return lista(estado && estado.hist).filter(h => h && h.s !== 'X').map(h => h.f); }
function fechasPadel(estado) { return lista(estado && estado.padel).map(p => p && p.f); }

function diasSinEntrenar(estado, o) {
  const hoy = hoyDe(o);
  const hist = lista(estado && estado.hist).map(h => h && h.f);
  return {
    fuerza: hace(ultimaFecha(fechasFuerza(estado)), hoy),
    padel: hace(ultimaFecha(fechasPadel(estado)), hoy),
    cualquiera: hace(ultimaFecha(hist.concat(fechasPadel(estado))), hoy)
  };
}

// What the plan says for a date: S.plan override first, then the fixed pattern from cfg (see tipoBase/queToca in motor.js).
function queToca(estado, f) {
  const cfg = (estado && estado.cfg) || {};
  const pl = estado && estado.plan && estado.plan[f];
  if (pl && pl.tipo) return clean({ tipo: pl.tipo, k: pl.k });
  const dia = diaDe(f);
  const fz = lista(cfg.fuerza), i = fz.indexOf(dia);
  if (i >= 0) return { tipo: 'fuerza', k: fz.length === 1 ? ((estado.semana || 1) % 2 ? 'A' : 'B') : (i === 0 ? 'A' : 'B') };
  if (!cfg.verano && lista(cfg.padel).indexOf(dia) >= 0) return { tipo: 'padel' };
  return { tipo: 'movil' };
}
function clean(obj) {
  Object.keys(obj).forEach(k => { if (obj[k] === undefined) delete obj[k]; });
  return obj;
}
const pct = (a, b) => (b ? Math.round(100 * a / b) : null);

const MAX_SEMANAS = 26;

function adherencia(estado, args, o) {
  estado = estado || {};
  const nSem = Math.min(MAX_SEMANAS, Math.max(1, Math.floor(Number(args && args.semanas) || 4)));
  const hoy = hoyDe(o);
  const creado = estado.cfg && estado.cfg.creado;
  const lunesHoy = lunesDe(hoy);
  const fuerza = fechasFuerza(estado);
  const partidos = lista(estado.padel).filter(p => p && p.f);
  const semanas = [];
  for (let i = nSem - 1; i >= 0; i--) {
    const lunes = sumaDias(lunesHoy, -7 * i);
    const dom = sumaDias(lunes, 6);
    let pf = 0, pp = 0;
    for (let d = 0; d < 7; d++) {
      const f = sumaDias(lunes, d);
      if (f > hoy || (creado && f < creado)) continue;
      const t = queToca(estado, f).tipo;
      if (t === 'fuerza') pf++;
      else if (t === 'padel') pp++;
    }
    const jugados = partidos.filter(p => p.f >= lunes && p.f <= dom);
    const sem = {
      lunes,
      fuerza: { planificadas: pf, hechas: fuerza.filter(f => f >= lunes && f <= dom).length },
      padel: { planificados: pp, jugados: jugados.length, minutos: jugados.reduce((a, p) => a + (Number(p.min) || 0), 0) }
    };
    if (i === 0) sem.enCurso = true;
    semanas.push(sem);
  }
  // Streak: consecutive fully completed strength weeks, newest first; an unfinished current week is skipped.
  let racha = 0;
  for (let i = semanas.length - 1; i >= 0; i--) {
    const w = semanas[i].fuerza, cumplida = w.planificadas > 0 && w.hechas >= w.planificadas;
    if (cumplida) racha++;
    else if (!semanas[i].enCurso) break;
  }
  const sum = (g, k) => semanas.reduce((a, w) => a + w[g][k], 0);
  const fh = sum('fuerza', 'hechas'), fp = sum('fuerza', 'planificadas'), pj = sum('padel', 'jugados'), pl = sum('padel', 'planificados');
  return {
    semanas,
    fuerza: { hechas: fh, planificadas: fp, porcentaje: pct(fh, fp) },
    padel: { jugados: pj, planificados: pl, porcentaje: pct(pj, pl) },
    racha
  };
}

const MAX_SERIE = 30;

function pendiente(puntos) {
  // Least squares slope over (day offset, value), returned per week.
  if (puntos.length < 2) return null;
  const x0 = puntos[0][0];
  const xs = puntos.map(p => diasEntre(x0, p[0]));
  const ys = puntos.map(p => p[1]);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
  return den === 0 ? null : (num / den) * 7;
}

function entradasDe(estado, fuente) {
  if (fuente === 'hoy') {
    const h = (estado && estado.hoy) || {};
    return Object.keys(h).filter(f => h[f] && typeof h[f] === 'object').map(f => Object.assign({ f }, h[f]));
  }
  return lista(estado && estado.cuerpo).filter(m => m && m.f);
}

function tendenciaCuerpo(estado, args, o) {
  const metrica = args && args.metrica;
  if (METRICAS.indexOf(metrica) < 0) throw new Error('metrica no valida: usa ' + METRICAS.join('|'));
  const dias = Math.max(1, Math.floor(Number(args.dias) || 60));
  const desde = sumaDias(hoyDe(o), -dias);
  const def = FUENTES[metrica];
  const puntos = entradasDe(estado, def.fuente)
    .map(e => [e.f, def.valor(e)])
    .filter(p => p[0] >= desde && p[1] !== null)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const vals = puntos.map(p => p[1]);
  const pend = pendiente(puntos);
  return {
    metrica, dias, n: puntos.length,
    min: vals.length ? Math.min(...vals) : null,
    max: vals.length ? Math.max(...vals) : null,
    media: vals.length ? redondea(vals.reduce((a, b) => a + b, 0) / vals.length, 1) : null,
    pendienteSemana: pend === null ? null : redondea(pend, 2),
    serie: puntos.slice(-MAX_SERIE)
  };
}

const MAX_N = 30;

function norm(t) {
  return String(t === undefined || t === null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function nombreDe(estado, id, o, visto) {
  const n = o && o.nombres && o.nombres[id];
  if (n) return n;
  const c = estado && estado.ejCustom && estado.ejCustom[id];
  if (c && c.n) return c.n;
  return visto || id;
}

function historialEjercicio(estado, args, o) {
  const q = norm(args && args.ejercicio);
  if (!q) throw new Error('falta el argumento ejercicio');
  const n = Math.min(MAX_N, Math.max(1, Math.floor(Number(args.n) || 10)));
  // Every exercise id that appears in the log, with the name stored next to it (custom extras).
  const conocidos = {};
  lista(estado && estado.hist).forEach(h => lista(h && h.ej).forEach(e => {
    if (e && e.id && !conocidos[e.id]) conocidos[e.id] = nombreDe(estado, e.id, o, e.n);
  }));
  const ids = Object.keys(conocidos);
  let elegidos = ids.filter(id => norm(id) === q || norm(conocidos[id]) === q);
  if (!elegidos.length) elegidos = ids.filter(id => norm(id).includes(q) || norm(conocidos[id]).includes(q));
  if (elegidos.length !== 1) {
    return elegidos.length
      ? { ejercicio: null, coincidencias: elegidos.map(id => ({ id, nombre: conocidos[id] })) }
      : { ejercicio: null, coincidencias: [], sesiones: [] };
  }
  const id = elegidos[0];
  const todas = [];
  lista(estado.hist).slice().sort((a, b) => (a.f < b.f ? 1 : -1)).forEach(h => lista(h.ej).forEach(e => {
    if (e && e.id === id) {
      const r = { f: h.f, peso: e.peso, reps: lista(e.reps), rpe: e.rpe };
      if (e.nota) r.nota = e.nota;
      if (e.min) r.min = e.min;
      todas.push(r);
    }
  }));
  return { ejercicio: { id, nombre: conocidos[id] }, total: todas.length, sesiones: todas.slice(0, n) };
}

const ultimo = arr => (arr.length ? arr[arr.length - 1] : null);
const orden = arr => lista(arr).filter(x => x && x.f).sort((a, b) => (a.f < b.f ? -1 : 1));
const n0 = v => (typeof v === 'number' && isFinite(v) ? v : null);

function avisos(estado, hoy) {
  const out = [];
  const u = ultimo(orden(estado.cuerpo));
  if (u && (u.sis >= 180 || u.dia >= 110)) out.push('Ultima tension ' + u.sis + '/' + u.dia + ' (' + u.f + '): con 180/110 o mas en reposo no se entrena; que llame a su medico.');
  else if (u && (u.sis >= 140 || u.dia >= 90)) out.push('Ultima tension ' + u.sis + '/' + u.dia + ' (' + u.f + '): repetirla en reposo y, si sigue alta, comentarla con su medico.');
  const d = estado.hoy && estado.hoy[hoy];
  if (d && d.rod >= 7) out.push('Rodillas a ' + d.rod + '/10 hoy: no se carga pierna.');
  return out;
}

function resumenGeneral(estado, o) {
  estado = estado || {};
  const cfg = estado.cfg || {};
  const perfil = estado.perfil || {};
  const hoy = hoyDe(o);
  const semana = estado.semana || 1;
  const hechosFuerza = fechasFuerza(estado), hechosPadel = fechasPadel(estado);
  const movil = lista(estado.movil);
  const lunes = lunesDe(hoy);
  const semanaActual = [];
  for (let d = 0; d < 7; d++) {
    const f = sumaDias(lunes, d);
    const q = queToca(estado, f);
    const hecho = q.tipo === 'fuerza' ? hechosFuerza.indexOf(f) >= 0 : q.tipo === 'padel' ? hechosPadel.indexOf(f) >= 0 : movil.indexOf(f) >= 0;
    semanaActual.push(Object.assign({ f, dia: DIAS[d] }, q, { hecho }));
  }
  const sesiones = orden(estado.hist).filter(h => h.s !== 'X');
  const ses = ultimo(sesiones);
  const par = ultimo(orden(estado.padel));
  const cu = ultimo(orden(estado.cuerpo));
  const conTension = ultimo(orden(estado.cuerpo).filter(c => n0(c.sis) !== null));
  const ultFuerza = ses ? ses.f : null;
  return {
    hoy,
    perfil: { nombre: perfil.nombre || null, altura: n0(perfil.altura), pesoInicial: n0(perfil.peso0) },
    programa: {
      semana, fase: semana <= 4 ? 1 : (semana < 13 ? 2 : 3), descarga: semana % 5 === 0 || estado.descargaExtra === semana,
      diasFuerza: lista(cfg.fuerza), diasPadel: lista(cfg.padel), padelHora: cfg.padelHora || null, verano: !!cfg.verano
    },
    articulacionesEnFaseMala: Object.keys(estado.artic || {}).filter(k => estado.artic[k]),
    semanaActual,
    ultimaSesion: ses ? { f: ses.f, s: ses.s } : null,
    diasSinEntrenar: ultFuerza ? diasEntre(ultFuerza, hoy) : null,
    ultimoPartido: par ? { f: par.f, min: n0(par.min), rodD: n0(par.rodD), rodI: n0(par.rodI), codo: n0(par.codo) } : null,
    ultimoCuerpo: cu ? {
      f: cu.f, peso: n0(cu.peso), cint: n0(cu.cint), sueN: n0(cu.sueN), sueS: n0(cu.sueS), cig: n0(cu.cig),
      dolor: { rodD: n0(cu.rodD), rodI: n0(cu.rodI), mun: n0(cu.mun), cad: n0(cu.cad) }
    } : null,
    ultimaTension: conTension ? { f: conTension.f, sis: conTension.sis, dia: n0(conTension.dia) } : null,
    disposicionHoy: estado.hoy && estado.hoy[hoy] ? { rod: n0(estado.hoy[hoy].rod), sue: n0(estado.hoy[hoy].sue), padel: n0(estado.hoy[hoy].padel) } : null,
    avisos: avisos(estado, hoy)
  };
}

/* How fresh the Pi copy is, from the state API row (actualizado in ms, dispositivo). The agent must not
 * present numbers older than OBSOLETA_MS as current. Missing or broken metadata counts as stale. */
const OBSOLETA_MS = 36 * 3600000;
function sincronizacion(meta, ahora) {
  const ts = meta && typeof meta.actualizado === 'number' && Number.isFinite(meta.actualizado) && meta.actualizado > 0 ? meta.actualizado : null;
  const dispositivo = meta && typeof meta.dispositivo === 'string' ? meta.dispositivo : null;
  if (ts === null) return { actualizado: null, dispositivo, hace: 'sin fecha', obsoleta: true };
  const s = Math.floor((ahora - ts) / 1000);
  const hace = s < 60 ? 'ahora mismo' : s < 3600 ? 'hace ' + Math.floor(s / 60) + ' min'
    : s < 86400 * 2 ? 'hace ' + Math.floor(s / 3600) + ' h' : 'hace ' + Math.floor(s / 86400) + ' d';
  return { actualizado: new Date(ts).toISOString(), dispositivo, hace, obsoleta: ahora - ts > OBSOLETA_MS };
}

module.exports = { resumenGeneral, sincronizacion, adherencia, historialEjercicio, tendenciaCuerpo, diasSinEntrenar, queToca, _util: { diasEntre, sumaDias, lunesDe, redondea, lista, hoyDe, DIAS } };
