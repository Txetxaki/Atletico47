#!/usr/bin/env node
/* Atlético 47 — servidor estático de la PWA + API
 *
 * Sirve sitio/ en 127.0.0.1:8091 (solo loopback). Tailscale Serve pone el
 * HTTPS por delante. Mismo esquema que Atlético 44, en otro puerto: otro
 * origen, otro localStorage, otra base de datos. No se pisan.
 *
 *   /api/estado/*, /api/historial/*, /api/salud   -> api-estado.js (SQLite)
 *   /api/coach                                    -> api-coach.js  (proxy a Claude)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('./api-estado.js');
const coach = require('./api-coach.js');

const RAIZ = path.join(__dirname, 'sitio');
const PUERTO = Number(process.env.PUERTO) || 8091;
const HOST = '127.0.0.1';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8'
};

function cacheControl(nombre) {
  if (nombre === 'sw.js') return 'no-cache, no-store, must-revalidate';
  if (/\.(html|js|webmanifest|json|css)$/.test(nombre)) return 'no-cache';
  return 'public, max-age=86400';
}

const servidor = http.createServer((req, res) => {
  let ruta;
  try { ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Peticion mal formada'); return; }

  if (ruta === '/api/coach') {
    coach.manejar(req, res).catch(e => {
      console.error('error en coach:', e);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'error interno' })); }
    });
    return;
  }
  if (ruta.startsWith('/api/')) {
    api.manejar(req, res, ruta).catch(e => {
      console.error('error en api:', e);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'error interno' })); }
    });
    return;
  }

  if (ruta === '/') ruta = '/index.html';
  if (ruta === '/favicon.ico') ruta = '/icon-192.png';

  // Sin esto, un ../../ se lleva coach.json con la clave de la API.
  const destino = path.join(RAIZ, path.normalize(ruta));
  if (destino !== RAIZ && !destino.startsWith(RAIZ + path.sep)) { res.writeHead(403).end('Prohibido'); return; }

  fs.stat(destino, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado'); return; }
    const nombre = path.basename(destino);
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cacheControl(nombre),
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(destino).pipe(res);
  });
});

servidor.listen(PUERTO, HOST, () => {
  console.log('Atlético 47 sirviendo ' + RAIZ + ' en http://' + HOST + ':' + PUERTO + (coach.configurado() ? ' · coach activo' : ' · coach sin configurar'));
});
