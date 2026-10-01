# Feature: agente-entrenador (OsmaGym)

## Objective
A personal trainer agent for OsmaGym that talks to Osma on Telegram, knows the app deeply,
remembers preferences, and proactively nudges ("today is padel, warm up", "how did you sleep?").
Port of the TxeGym `agente-entrenador` feature (reference: ~/projects/TxeGym, branch remodelacion).

## Decision (2026-10-01)
Reuse the Hermes Agent already running on the Pi through a dedicated profile `entrenadorosma`
instead of writing a custom agent loop. The repo owns an MCP server (`agente/mcp-osma.js`) that
exposes the app state over the loopback API (http://127.0.0.1:8091, key `a47v1`).

## What differs from TxeGym
- Another person: five surgeries, osteoarthritis, smoker, padel Tue/Thu. The SOUL carries the
  non-negotiable rules verbatim from `sitio/app.js` (`REGLAS INNEGOCIABLES`), checked by a test.
- Another state shape: `cuerpo[]` (weekly: pain per joint, sleep night+nap, cigarettes, tension),
  `hoy{date:{rod,sue,padel}}`, `padel[]`, no `metricas`, no yoga. Tools adapted, not guessed.
- Notes: the app only has `notas.comida`, so `anadir_nota` writes only there.
- Public origins: Vercel and GitHub Pages (two), the Pi serves the app at
  https://raspberry.taile8249e.ts.net:10003.

## Constraints
- Runs on the Pi only; nothing new exposed to the internet.
- Profile toolsets trimmed: memory, session_search, skills, clarify, mcp-osmagym. Approvals `smart`.
- Only Osma's Telegram chat id is allowed.
- The agent changes data only through validated MCP tools (`cuerpo`, `notas.comida`), with undo
  and an audit log. It never sees the coach code or the push subscriptions.
- No key in the repo: `ORCA_API_KEY` is read from the environment and stored in the profile `.env` (600).
- Cost: cheap model via OrcaRouter.
- Nothing in this feature touches `coach-core.js` or any frontend behaviour except `sitio/storage-remote.js` and the service-worker cache.

## Mode
Strict TDD: enabled (source: project instructions). Runner: `node --test` (native, no framework).
Command: `npm run test:agente`.

## Tasks
- [x] T1 Sync from the public builds (port of TxeGym T10): `cors.js` + wiring, `OSMAGYM_ORIGENES`, `OSMAGYM_DATOS`, `storage-remote.js` (reachability probe + cache, override restricted to tailnet/LAN), sw cache bump
- [x] T2 MCP server `agente/mcp-osma.js`: read tools (`resumen_general`, `historial_ejercicio`, `adherencia`, `tendencia_cuerpo`, `dias_sin_entrenar`)
- [x] T3 MCP write tools with validation, undo and audit log (`registrar_cuerpo`, `anadir_nota`, `deshacer_ultimo_cambio`)
- [x] T4 Hermes profile script `agente/hermes/crear-perfil.sh` (+ `SOUL.md`, skill `osmagym-app` from LEEME.md) — tested against a stub Hermes in a throw-away HOME; NOT run on the Pi
- [x] T5 `agente/hermes/activar-telegram.sh` + prompt files (morning 08:30, weekly Sunday 19:00) — same stub-level testing
- [ ] T6 Run on the Pi: deploy this branch to `~/osmagym` (the existing deploy script uses `~/atletico47`), run `crear-perfil.sh`, `hermes mcp test`, then Telegram (needs bot token + chat id from Osma)

## Progress / evidence
- T1: commit c01445d. RED observed: `node --test test/` failed on the CORS test before `cors.js` was wired (header was null) and `node --test sitio/test/` failed with `ReferenceError: window is not defined` before the module exported its pure functions. GREEN: 19/19 (cors 8, storage-remote 11). Service-worker cache og-v9 -> og-v10 via `scripts/version-sw.sh`.
- T2/T3: commit 46d3c24. RED: `Cannot find module '../analisis'`/`'../escritura'`/`'../mcp-osma'` (all 4 files failing). GREEN: agente 73/73 (analisis 17, escritura 15, MCP 41), whole suite 92/92. Checked also by hand against a real `servidor-web.js` with a temp DB (`OSMAGYM_DATOS`): real exercise names from `sitio/biblioteca.js` resolve, `registrar_cuerpo` + `deshacer_ultimo_cambio` round trip.
- T4/T5: this commit. RED: 10 of 11 `hermes.test.js` tests failed with the scripts absent. GREEN: 11/11, including `bash -n`, sourcing runs nothing, idempotent rerun, key rotation, key never printed or stored outside `.env`, SOUL rules equal to the ones in `sitio/app.js`.
- Whole suite: `npm run test:agente` 103/103 (test 8, sitio/test 11, agente/test 84).

## Assumptions not verified (no access to the Pi)
- Hermes `config.yaml` schema (`model.{default,provider,base_url,api_key}`, `mcp_servers.<name>.{command,args,env}`, `platform_toolsets.<platform>`, `approvals.mode`) and the `${env:ORCA_API_KEY}` syntax are copied from how the TxeGym profile was described, not read from a live profile. The script merges into the file Hermes creates, so unrelated keys survive.
- Hermes CLI subcommands (`profile create --no-skills`, `gateway install|restart|start`, `cron create --name --deliver`, `cron remove`) are taken from the TxeGym script.
- Writes by the agent do not trigger `revisarReplan` in the app; a pain value of 4 or more written by the agent is only picked up the next time the app evaluates it.
- `anadir_nota` text ends up in `notas.comida`, which the in-app Coach reads. It is capped (500), stripped of control characters and the agent is told never to copy instructions from data.

## Blocked on the owner
- Telegram bot token (BotFather) + numeric chat id, then `activar-telegram.sh <token> <chat_id>`.
- `ORCA_API_KEY` at run time for `crear-perfil.sh`.
- Real-phone check of the sync (Chrome Private Network Access) with the Vercel build on the tailnet.

## Next step
Review and merge this branch, deploy to the Pi, run T6.
