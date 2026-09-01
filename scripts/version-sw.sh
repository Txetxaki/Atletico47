#!/usr/bin/env bash
# Atletico 47 - subir la version de cache del service worker
#
#   ./scripts/version-sw.sh
#
# Ejecutalo ANTES de commitear cualquier cambio dentro de sitio/. Si el nombre
# de la cache no cambia, el movil sigue sirviendo la copia guardada.

set -euo pipefail

SW="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/sitio/sw.js"
[[ -f "$SW" ]] || { echo "No encuentro $SW" >&2; exit 1; }

ACTUAL="$(sed -nE "s/^const CACHE = '([^']+)'.*/\1/p" "$SW" | head -1)"
[[ -n "$ACTUAL" ]] || { echo "No encuentro \"const CACHE\" en $SW" >&2; exit 1; }

if [[ "$ACTUAL" =~ ^(.*-v)([0-9]+)$ ]]; then
  NUEVA="${BASH_REMATCH[1]}$(( BASH_REMATCH[2] + 1 ))"
  sed -i -E "s/^const CACHE = '[^']+'/const CACHE = '$NUEVA'/" "$SW"
  echo "cache del service worker: $ACTUAL -> $NUEVA"
else
  echo "No reconozco el formato de version en '$ACTUAL' (esperaba algo-vN)." >&2
  exit 1
fi
