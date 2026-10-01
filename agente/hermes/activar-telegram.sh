#!/usr/bin/env bash
# Activate the Telegram channel and the proactive jobs of the `entrenadorosma` Hermes profile.
#
#   ~/osmagym/agente/hermes/activar-telegram.sh <bot_token> <chat_id>
#
# - bot_token: from @BotFather (a NEW bot, not the one used by the general Hermes assistant)
# - chat_id:   Osma's numeric Telegram id (from @userinfobot). Only this id can talk to the bot.
#
# Run crear-perfil.sh first. Idempotent: rerun it to rotate the token or change the chat id;
# the jobs are removed and recreated from the prompt files, so they never duplicate.

set -euo pipefail

PERFIL="entrenadorosma"

hermes() {
  local salida rc=0
  salida="$("$HOME/.hermes/hermes-agent/venv/bin/python" -m hermes_cli.main "$@" 2>&1)" || rc=$?
  printf '%s\n' "$salida" | grep -v OMNIROUTE || true
  return $rc
}

crear_trabajo() {   # nombre horario fichero
  local nombre="$1" horario="$2" fichero="$3"
  hermes -p "$PERFIL" cron remove "$nombre" >/dev/null 2>&1 || true
  hermes -p "$PERFIL" cron create --name "$nombre" --deliver "telegram:$CHAT" "$horario" "$(cat "$DIR/$fichero")" \
    || { echo "ERROR: no se pudo crear el trabajo $nombre" >&2; exit 1; }
}

activar() {
  TOKEN="${1:?uso: $0 <bot_token> <chat_id>}"
  CHAT="${2:?uso: $0 <bot_token> <chat_id>}"
  [[ "$CHAT" =~ ^[0-9]+$ ]] || { echo "chat_id debe ser numerico" >&2; exit 1; }
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local envf="$HOME/.hermes/profiles/$PERFIL/.env"
  [[ -d "$HOME/.hermes/profiles/$PERFIL" ]] || { echo "No existe el perfil $PERFIL: ejecuta antes crear-perfil.sh" >&2; exit 1; }

  umask 077
  touch "$envf"
  { grep -vE '^(TELEGRAM_BOT_TOKEN|TELEGRAM_ALLOWED_USERS)=' "$envf" || true
    printf 'TELEGRAM_BOT_TOKEN=%s\nTELEGRAM_ALLOWED_USERS=%s\n' "$TOKEN" "$CHAT"; } > "$envf.new"
  mv "$envf.new" "$envf"
  chmod 600 "$envf"
  echo "env actualizado (token no mostrado)"

  # Gateway as a user service for this profile.
  hermes -p "$PERFIL" gateway install
  hermes -p "$PERFIL" gateway restart || hermes -p "$PERFIL" gateway start

  # Proactive jobs: morning every day 08:30, weekly review on Sundays 19:00.
  crear_trabajo entrenador-osma-manana "30 8 * * *" prompt-manana.txt
  crear_trabajo entrenador-osma-semanal "0 19 * * 0" prompt-semanal.txt

  echo "listo. Escribe al bot en Telegram para probarlo."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  activar "$@"
fi
