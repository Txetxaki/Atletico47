#!/usr/bin/env bash
# Atletico 47 - respaldo de la base de datos
#
#   ~/atletico47/scripts/respaldo-db.sh
#
# Usa .backup de sqlite3, no cp: con WAL una copia a pelo se deja fuera las
# escrituras recientes. Comprime y conserva los 30 mas recientes.
# Cron diario:  0 4 * * *  /home/txetxaki/atletico47/scripts/respaldo-db.sh >> /home/txetxaki/atletico47/respaldos/bd/cron.log 2>&1

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BD="$BASE/datos/atletico47.db"
DEST="$BASE/respaldos/bd"
mkdir -p "$DEST"

[[ -f "$BD" ]] || { echo "No existe $BD todavia"; exit 0; }
command -v sqlite3 >/dev/null || { echo "Falta sqlite3: sudo apt install sqlite3" >&2; exit 1; }

F="$DEST/atletico47-$(date +%Y%m%d-%H%M%S).db"
sqlite3 "$BD" ".backup '$F'"
gzip -f "$F"
echo "Respaldo: $F.gz"

ls -1t "$DEST"/atletico47-*.db.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
