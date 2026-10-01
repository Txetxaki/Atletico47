#!/usr/bin/env bash
# Create (or refresh) the Hermes profile `entrenadorosma` on the Raspberry Pi.
#
#   ORCA_API_KEY=<key> ~/osmagym/agente/hermes/crear-perfil.sh
#
# What it does, in order:
#   1. creates the profile once (`profile create entrenadorosma --no-skills`)
#   2. config.yaml: OrcaRouter model, the osmagym MCP server, trimmed toolsets, approvals smart
#      (merged into whatever Hermes already wrote; unrelated keys survive)
#   3. .env: stores ORCA_API_KEY (mode 600). Without the variable an existing key is kept.
#   4. SOUL.md from agente/hermes/SOUL.md, and the `osmagym-app` skill built from LEEME.md
#
# Idempotent: rerun it after changing SOUL.md or LEEME.md, or to rotate the key. The key is only
# read from the environment and written to the profile .env: it is never printed nor stored in the repo.
# Next step: activar-telegram.sh <bot_token> <chat_id>.

set -euo pipefail

PERFIL="entrenadorosma"
MODELO="deepseek/deepseek-v4.1-flash"
BASE_URL_MODELO="https://api.orcarouter.ai/v1"
OSMAGYM_BASE_URL="http://127.0.0.1:8091"
TOOLSET="mcp-osmagym"

crear_perfil() {
  local aqui repo py perfil_dir
  aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  repo="${OSMAGYM_DIR:-$HOME/osmagym}"
  py="$HOME/.hermes/hermes-agent/venv/bin/python"
  perfil_dir="$HOME/.hermes/profiles/$PERFIL"
  local envf="$perfil_dir/.env"

  [[ -x "$py" ]] || { echo "No encuentro Hermes en $py" >&2; exit 1; }
  if [[ -z "${ORCA_API_KEY:-}" ]] && ! grep -qE '^ORCA_API_KEY=.+' "$perfil_dir/.env" 2>/dev/null; then
    echo "Falta ORCA_API_KEY (variable de entorno) y el perfil aun no tiene clave guardada." >&2
    exit 1
  fi
  [[ -f "$aqui/SOUL.md" && -f "$repo/LEEME.md" ]] || { echo "Faltan SOUL.md o $repo/LEEME.md" >&2; exit 1; }

  umask 077
  if [[ ! -d "$perfil_dir" ]]; then
    "$py" -m hermes_cli.main profile create "$PERFIL" --no-skills 2>&1 | grep -v OMNIROUTE || true
    [[ -d "$perfil_dir" ]] || { echo "Hermes no creo el perfil $PERFIL" >&2; exit 1; }
  fi

  # .env: replace only the ORCA_API_KEY line.
  if [[ -n "${ORCA_API_KEY:-}" ]]; then
    touch "$envf"
    { grep -v '^ORCA_API_KEY=' "$envf" || true; printf 'ORCA_API_KEY=%s\n' "$ORCA_API_KEY"; } > "$envf.new"
    mv "$envf.new" "$envf"
  fi
  chmod 600 "$envf"

  # config.yaml: merge with the venv's own python+yaml.
  PERFIL_DIR="$perfil_dir" MCP_JS="$repo/agente/mcp-osma.js" NODE_BIN="$(command -v node || echo node)" \
  MODELO="$MODELO" BASE_URL_MODELO="$BASE_URL_MODELO" OSMAGYM_BASE_URL="$OSMAGYM_BASE_URL" TOOLSET="$TOOLSET" \
  "$py" - <<'PY'
import os, yaml
ruta = os.path.join(os.environ["PERFIL_DIR"], "config.yaml")
cfg = {}
if os.path.exists(ruta):
    with open(ruta) as f:
        cfg = yaml.safe_load(f) or {}
cfg["model"] = {
    "default": os.environ["MODELO"],
    "provider": "custom",
    "base_url": os.environ["BASE_URL_MODELO"],
    "api_key": "${env:ORCA_API_KEY}",
}
cfg.setdefault("mcp_servers", {})["osmagym"] = {
    "command": os.environ["NODE_BIN"],
    "args": [os.environ["MCP_JS"]],
    "env": {"OSMAGYM_BASE": os.environ["OSMAGYM_BASE_URL"]},
}
sets = ["memory", "session_search", "skills", "clarify", os.environ["TOOLSET"]]
cfg["platform_toolsets"] = {"telegram": list(sets), "cli": list(sets)}
cfg["approvals"] = {"mode": "smart"}
with open(ruta + ".new", "w") as f:
    yaml.safe_dump(cfg, f, allow_unicode=True, sort_keys=False)
os.replace(ruta + ".new", ruta)
PY

  install -m 600 "$aqui/SOUL.md" "$perfil_dir/SOUL.md"

  # Skill: app documentation, straight from LEEME.md so it never drifts.
  mkdir -p "$perfil_dir/skills/osmagym-app"
  {
    printf -- '---\nname: osmagym-app\ndescription: Como esta hecha OsmaGym (pestanas, motor de decisiones, estado, API) para responder a Osma con precision. Usala cuando pregunte por la app o por que propone algo.\n---\n'
    cat "$repo/LEEME.md"
  } > "$perfil_dir/skills/osmagym-app/SKILL.md"

  echo "Perfil $PERFIL listo en $perfil_dir (clave no mostrada). Siguiente: activar-telegram.sh <bot_token> <chat_id>"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  crear_perfil "$@"
fi
