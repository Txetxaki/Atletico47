/* OsmaGym — CORS para la API, solo lista blanca.
 *
 * La PWA pública (Vercel o GitHub Pages) sincroniza con este servidor por la
 * URL de la tailnet, desde el navegador del propio usuario. El endpoint sigue
 * siendo solo de tailnet; esto solo deja que esos orígenes lean las respuestas.
 * Nunca "*", nunca un origen desconocido reflejado, nunca credenciales.
 */

const POR_DEFECTO = ['https://osmagym.vercel.app', 'https://txetxaki.github.io'];

function listaPermitidos(env) {
  const extra = String((env || {}).OSMAGYM_ORIGENES || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  return new Set(POR_DEFECTO.concat(extra));
}

/* Devuelve true cuando la petición ya está respondida (preflight). */
function aplicar(req, res, permitidos) {
  const origen = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (!origen || !permitidos.has(origen)) return false;

  res.setHeader('Access-Control-Allow-Origin', origen);
  if (req.method !== 'OPTIONS') return false;

  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  // Chrome lo pide cuando una página pública llama a una dirección privada/tailnet.
  if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.writeHead(204).end();
  return true;
}

module.exports = { listaPermitidos, aplicar };
