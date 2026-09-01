#!/usr/bin/env bash
# Atletico 47 - desplegar en la Raspberry
#
#   ssh txetxaki@raspberry.taile8249e.ts.net '~/atletico47/scripts/desplegar.sh'
#
# La carpeta de produccion /home/txetxaki/atletico47 ES el checkout de git.
# Desplegar es traer el commit y comprobar que sigue todo en pie.

set -euo pipefail

BASE="/home/txetxaki/atletico47"
URL_LOCAL="http://127.0.0.1:8091"
ARCHIVOS=(index.html app.js motor.js biblioteca.js sw.js manifest.webmanifest storage-remote.js migrar.html
          icon-192.png icon-512.png icon-maskable.png apple-touch-icon.png)

cd "$BASE"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: hay cambios sin commitear en $BASE" >&2
  git status --short >&2
  echo >&2
  echo "Decide tu: commitealos, 'git stash', o 'git checkout -- .' para tirarlos." >&2
  exit 1
fi

ANTES="$(git rev-parse HEAD)"
git fetch --quiet origin
git pull --ff-only
DESPUES="$(git rev-parse HEAD)"

if [[ "$ANTES" == "$DESPUES" ]]; then
  echo "Ya estaba al dia (${ANTES:0:8})."
else
  echo "Actualizado: ${ANTES:0:8} -> ${DESPUES:0:8}"
  git --no-pager log --oneline "$ANTES..$DESPUES"
fi

if ! git diff --quiet "$ANTES" "$DESPUES" -- package.json; then
  echo "Ha cambiado package.json: npm install"
  npm install --omit=dev
fi
if ! git diff --quiet "$ANTES" "$DESPUES" -- servidor-web.js api-estado.js api-coach.js package.json; then
  echo "Ha cambiado el servidor web: reiniciando"
  sudo systemctl restart atletico47-web.service
  sleep 2
fi
if ! git diff --quiet "$ANTES" "$DESPUES" -- servidor-push/push.js; then
  echo "Ha cambiado el planificador push: reiniciando"
  sudo systemctl restart atletico47-push.service
fi

echo
echo "Comprobando..."
FALLOS=0
for f in "${ARCHIVOS[@]}"; do
  [[ -f "$BASE/sitio/$f" ]] || continue
  CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL_LOCAL/$f")"
  printf '  %s  /%s\n' "$CODIGO" "$f"
  [[ "$CODIGO" == "200" ]] || FALLOS=1
done
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL_LOCAL/api/salud")"
printf '  %s  /api/salud\n' "$CODIGO"
[[ "$CODIGO" == "200" ]] || FALLOS=1

if [[ "$FALLOS" -ne 0 ]]; then
  echo >&2
  echo "ERROR: algo no responde 200." >&2
  echo "Para volver atras:  git -C $BASE reset --hard $ANTES" >&2
  exit 1
fi

echo
echo "Listo. En el movil: cierra la app del todo y vuelve a abrirla."
