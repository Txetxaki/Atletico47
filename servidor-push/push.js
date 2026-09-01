#!/usr/bin/env node
/* Atlético 47 — servidor de notificaciones push
 *
 *   npm install web-push            (en esta carpeta)
 *   node push.js --claves           genera las claves VAPID (solo la primera vez)
 *   node push.js --probar           manda una notificación ahora
 *   node push.js                    arranca el planificador
 *
 * Los horarios salen de agenda.json (si existe) o de la AGENDA de abajo.
 * agenda.json: { "1": {"h":7,"m":0,"t":"Fuerza A","c":"..."}, ... }  con 0=domingo … 6=sábado
 */

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, 'config.json');
const SUBS = path.join(__dirname, 'suscripciones.json');
const AGENDA_F = path.join(__dirname, 'agenda.json');

if (process.argv.includes('--claves')) {
  const k = webpush.generateVAPIDKeys();
  fs.writeFileSync(CFG, JSON.stringify({ publica: k.publicKey, privada: k.privateKey, contacto: 'mailto:tu@email.com' }, null, 2));
  console.log('\nClaves generadas en config.json\n\nCLAVE PÚBLICA (pégala en la app, pestaña Ajustes):\n\n' + k.publicKey + '\n');
  process.exit(0);
}
if (!fs.existsSync(CFG)) { console.error('Falta config.json. Ejecuta primero: node push.js --claves'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
webpush.setVapidDetails(cfg.contacto, cfg.publica, cfg.privada);

function subs() {
  if (!fs.existsSync(SUBS)) return [];
  try { return JSON.parse(fs.readFileSync(SUBS, 'utf8')); } catch { return []; }
}
function guardarSubs(lista) { fs.writeFileSync(SUBS, JSON.stringify(lista, null, 2)); }

async function enviar(titulo, cuerpo) {
  const lista = subs();
  if (!lista.length) { console.log('No hay suscripciones. Pega el JSON de la app en suscripciones.json (array).'); return; }
  const carga = JSON.stringify({ title: titulo, body: cuerpo, tag: 'a47', url: './index.html' });
  const vivas = [];
  for (const s of lista) {
    try { await webpush.sendNotification(s, carga); vivas.push(s); console.log(new Date().toISOString(), 'enviada:', cuerpo); }
    catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) { console.log('suscripción caducada, se retira'); }
      else { console.error('fallo al enviar:', e.statusCode || e.message); vivas.push(s); }
    }
  }
  if (vivas.length !== lista.length) guardarSubs(vivas);
}

/* 0 domingo … 6 sábado. Lunes y viernes fuerza a las 7; martes y jueves recordatorio
   de calentamiento antes del pádel de las 19; domingo, registro semanal. */
let AGENDA = {
  1: { h: 7, m: 0, t: 'Fuerza A', c: 'Rodilla, empuje y remo. Antes: 8 min de bici y cómo vienes hoy.' },
  2: { h: 17, m: 45, t: 'Pádel a las 19', c: 'Calienta 8-10 min. Agarre a 6 de 10. Después apunta rodillas y codo.' },
  4: { h: 17, m: 45, t: 'Pádel a las 19', c: 'Calienta 8-10 min. Agarre a 6 de 10. Después apunta rodillas y codo.' },
  5: { h: 7, m: 0, t: 'Fuerza B', c: 'Bisagra, colgarse, press y granjero. Antes: cómo vienes hoy.' },
  0: { h: 20, m: 0, t: 'Registro semanal', c: 'Peso, cintura, dolor por articulación y sueño. Dos minutos.' }
};
if (fs.existsSync(AGENDA_F)) { try { AGENDA = JSON.parse(fs.readFileSync(AGENDA_F, 'utf8')); } catch (e) { console.error('agenda.json no es válido, uso la agenda por defecto'); } }

if (process.argv.includes('--probar')) {
  enviar('Atlético 47', 'Prueba: si ves esto, funciona.').then(() => process.exit(0));
} else {
  console.log('Planificador en marcha.');
  let ultimo = '';
  setInterval(() => {
    const d = new Date();
    const a = AGENDA[d.getDay()];
    if (!a) return;
    const marca = d.toDateString() + a.h + ':' + a.m;
    if (d.getHours() === a.h && d.getMinutes() === a.m && ultimo !== marca) { ultimo = marca; enviar(a.t, a.c); }
  }, 30000);
}
