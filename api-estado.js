/* Atlético 47 — almacén de estado en SQLite
 *
 * La app guarda todo su estado en un único blob JSON bajo la clave 'a47v1'.
 * Aquí vive la copia buena, compartida por todos los dispositivos. Cada
 * escritura deja una instantánea en 'historial' (60 por clave): un "he pisado
 * los datos sin querer" se recupera desde GET /api/historial/<clave>.
 *
 *   GET  /api/salud
 *   GET  /api/estado/<clave>              -> { valor, actualizado, dispositivo }
 *   PUT  /api/estado/<clave>              <- { valor, actualizado, dispositivo, base }
 *   GET  /api/historial/<clave>           -> [ { id, actualizado, dispositivo, bytes } ]
 *   GET  /api/historial/<clave>/<id>      -> { valor, actualizado, dispositivo }
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'datos');
const BD = path.join(DIR, 'atletico47.db');
const MAX_CUERPO = 5 * 1024 * 1024;
const SNAPSHOTS = 60;

fs.mkdirSync(DIR, { recursive: true });

const db = new DatabaseSync(BD);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS estado (
    clave TEXT PRIMARY KEY, valor TEXT NOT NULL, actualizado INTEGER NOT NULL, dispositivo TEXT
  );
  CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT, clave TEXT NOT NULL, valor TEXT NOT NULL,
    actualizado INTEGER NOT NULL, dispositivo TEXT, guardado INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_hist ON historial (clave, id DESC);
`);

const qLeer = db.prepare('SELECT valor, actualizado, dispositivo FROM estado WHERE clave = ?');
const qEscribir = db.prepare(`INSERT INTO estado (clave, valor, actualizado, dispositivo) VALUES (?, ?, ?, ?)
  ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado, dispositivo = excluded.dispositivo`);
const qSnap = db.prepare('INSERT INTO historial (clave, valor, actualizado, dispositivo, guardado) VALUES (?, ?, ?, ?, ?)');
const qPodar = db.prepare(`DELETE FROM historial WHERE clave = ? AND id NOT IN (SELECT id FROM historial WHERE clave = ? ORDER BY id DESC LIMIT ?)`);
const qHistLista = db.prepare(`SELECT id, actualizado, dispositivo, guardado, LENGTH(valor) AS bytes FROM historial WHERE clave = ? ORDER BY id DESC LIMIT 60`);
const qHistUno = db.prepare('SELECT valor, actualizado, dispositivo FROM historial WHERE clave = ? AND id = ?');

function json(res, codigo, cuerpo) {
  const txt = JSON.stringify(cuerpo);
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(txt), 'Cache-Control': 'no-store' });
  res.end(txt);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let total = 0; const trozos = [];
    req.on('data', d => { total += d.length; if (total > MAX_CUERPO) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; } trozos.push(d); });
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    req.on('error', reject);
  });
}

const CLAVE_OK = /^[A-Za-z0-9._-]{1,64}$/;

async function manejar(req, res, ruta) {
  const partes = ruta.split('/').filter(Boolean);
  if (partes[1] === 'salud') {
    const n = db.prepare('SELECT COUNT(*) AS n FROM estado').get().n;
    return json(res, 200, { ok: true, claves: n, bd: BD });
  }
  const clave = partes[2];
  if (!clave || !CLAVE_OK.test(clave)) return json(res, 400, { error: 'clave no valida' });

  if (partes[1] === 'estado') {
    if (req.method === 'GET') {
      const fila = qLeer.get(clave);
      if (!fila) return json(res, 404, { error: 'sin datos para esa clave' });
      return json(res, 200, fila);
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      let cuerpo;
      try { cuerpo = JSON.parse(await leerCuerpo(req)); } catch (e) { return json(res, 400, { error: 'cuerpo no valido: ' + e.message }); }
      if (typeof cuerpo.valor !== 'string') return json(res, 400, { error: 'falta "valor" (string)' });
      try { JSON.parse(cuerpo.valor); } catch { return json(res, 400, { error: '"valor" debe ser JSON serializado' }); }
      const ahora = Date.now();
      const actualizado = Number(cuerpo.actualizado) || ahora;
      const dispositivo = String(cuerpo.dispositivo || 'desconocido').slice(0, 60);
      const previo = qLeer.get(clave);
      const conflicto = !!(previo && cuerpo.base != null && previo.actualizado > Number(cuerpo.base));
      qEscribir.run(clave, cuerpo.valor, actualizado, dispositivo);
      qSnap.run(clave, cuerpo.valor, actualizado, dispositivo, ahora);
      qPodar.run(clave, clave, SNAPSHOTS);
      return json(res, 200, { ok: true, actualizado, conflicto, anterior: conflicto ? { actualizado: previo.actualizado, dispositivo: previo.dispositivo } : null });
    }
    return json(res, 405, { error: 'metodo no permitido' });
  }

  if (partes[1] === 'historial' && req.method === 'GET') {
    if (partes[3]) {
      const fila = qHistUno.get(clave, Number(partes[3]));
      if (!fila) return json(res, 404, { error: 'instantanea no encontrada' });
      return json(res, 200, fila);
    }
    return json(res, 200, qHistLista.all(clave));
  }
  return json(res, 404, { error: 'ruta de api desconocida' });
}

module.exports = { manejar, BD };
