# Feature: sync-central (OsmaGym)

## Objective
The Raspberry Pi is the single source of truth for OsmaGym's state, and every device (phone, PC,
Telegram agent) converges on it: no silent overwrites, concurrent edits merged, open devices refresh
live, and the trainer agent knows how fresh the Pi copy is.
Port of the TxeGym `sync-central` feature (reference: ~/projects/TxeGym, branch remodelacion,
commits dee1369, 6e61caf, a5e9fa2, 6dd8b24).

## Decisions (inherited from TxeGym, 2026-10-01)
- Fast-forward writes (client `base` == server `actualizado`) stay authoritative, deletions included.
- A write made from a STALE base is a real conflict: the server merges instead of overwriting
  (record-level union, newest blob wins per record); config-like fields come whole from the newer blob.
- Every PUT keeps its snapshot in `historial`, so nothing is unrecoverable.
- localStorage is a cache plus an outbox; refresh on focus/visibility/online and every 20 s.
- A visible "Sincronización" panel in Ajustes, with the Vercel-copy sentence on the remote copy.

## What differs from TxeGym
- State key `a47v1`, prefix `a47` (event `a47sync`), env `OSMAGYM_DATOS`/`OSMAGYM_ORIGENES`,
  port 8091, DB `atletico47.db`, Pi URL https://raspberry.taile8249e.ts.net:10003.
- Merge identities (from the real writers in sitio/app.js and sitio/motor.js):
  `hist`, `padel`, `cuerpo` one record per date (`f`); `comidas`, `notas.comida` by content
  (several per date); `coachLog` by (f, accion, input) because entries change state in place,
  newest first; `movil` a set of dates; `hoy` an object map date -> {rod,sue,padel} unioned by key.
  `perfil`, `cfg`, `equipo`, `artic`, `coachCfg`, `platos`, `plan`, `regen`, `ejCustom`, `ui` whole
  from the newer blob (`plan`/`regen` are this week's schedule: removing an adjustment must stick).
- Extra: freshness for the trainer agent. `resumen_general` returns
  `sincronizacion { actualizado, dispositivo, hace, obsoleta (> 36 h) }`; SOUL.md tells the agent
  to say the data is stale and not present stale numbers as current.

## Mode
Strict TDD, runner `node --test` (`npm run test:agente` runs agente/, sitio/ and test/).

## Tasks
- [x] S1 `merge.js` pure record-level merge (arrays + object maps) + tests
- [x] S2 `api-estado.js` conflict path uses merge, responds with merged value; deploy restarts on merge.js
- [x] S3 `storage-remote.js`: adopt merged responses, `refrescar()` on focus/visibility/online/interval, `forzar()`, status
- [x] S4 app wiring: re-render on remote change keeping UI state; "Sincronización" panel in Ajustes; SW cache bump
- [x] S5 freshness for the trainer agent: `resumen_general.sincronizacion` + SOUL rule
- [x] S6 two-device browser smoke test

## Progress / evidence
Route: delegated direct, one bounded writer (writer trigger: 2+ non-trivial files).

- S1 feat(sync): merge. RED `node --test test/merge.test.js` -> `Cannot find module '../merge.js'`;
  GREEN 19/19.
- S2 feat(sync): server. `api-estado.js` + `test/estado.test.js` (spawns the real server). RED: 4 of 8
  failing (stale-base merge, snapshots, newer config, same-device stale base); GREEN 9/9. The conflict
  stores the merge with `actualizado = max(now, stored+1)` and snapshots the raw incoming write AND the
  merge; merges over 5 MB fall back to the old overwrite. No same-device exception (the stored row may be
  a merge that device has not absorbed yet). `scripts/desplegar.sh` restarts on `merge.js` changes.
  Agent conflict path checked against the real server (scratchpad script): its note lands on top of the
  other device's version, nothing lost.
- S3 feat(sync): client. `sitio/storage-remote.js` is the TxeGym client with OsmaGym's names (global
  `OsmaSync`, event `a47sync`, key `a47v1`, Pi :10003); the pre-change OsmaGym file was verified equal to
  the TxeGym base modulo those names, so nothing OsmaGym-specific was dropped. RED
  `node --test sitio/test/storage-remote.test.js` -> 11 failing (`R.decidirRefresco is not a function`,
  `R.trasSubir`, `R.haceCuanto`, `R.etiquetaConexion`, `R.mensajeError`, `R.tocaRefrescar`); GREEN 24/24.
- S4 feat(sitio): reload S on `bajado`/`fusionado` through motor.js `cargarDesde` (the startup path,
  without saving), re-apply the appearance profile and repaint the open tab keeping scroll, open
  exercises and the draft; deferred while typing or with the confirm dialog open; toast. Ajustes gets a
  "Sincronización" section (connection, central URL, last sync, pending, device, last merge, last error,
  "Sincronizar ahora", "Copiar datos para migrar", Vercel-copy sentence on the remote copy). No unit
  harness exists for app.js; the behaviour is proven by the S6 browser smoke. SW cache og-v15 -> og-v16.
- S5 feat(agente): `analisis.sincronizacion(meta, ahora)` (pure) and `resumen_general.sincronizacion`
  `{ actualizado ISO, dispositivo, hace, obsoleta }` read from the state API row (`mcp-osma.js` now keeps
  `actualizado`/`dispositivo`; `leerEstado` unchanged for callers; clock injectable via `opts.ahora`).
  Missing/broken metadata -> `hace: 'sin fecha', obsoleta: true`. SOUL.md rule: say the data is from
  `hace`, open the app with Tailscale on, never present stale numbers as current. RED: 5 failing
  (2 analisis, 2 mcp-osma, 1 hermes SOUL); GREEN. End to end against a spawned server with a 50 h old
  row: `{ hace: 'hace 2 d', obsoleta: true, dispositivo: 'movil-osma' }`. LEEME updated (sync rules, tool).
- S6 two-device Playwright smoke (scratchpad `smoke-dos-OsmaGym.js`, not in repo; A = static origin with
  the Pi override = Vercel-like copy, B = Pi origin; 390x780): 26/26 PASS. Concurrent offline/online edits
  on different records (hist + hoy date on A, cuerpo + another hoy date on B) both survive on the server
  and on A without reload; idle B on Historial shows A's session via the 20 s interval (18 s), keeps its
  tab, toast shown; A refreshes on visibilitychange keeping Cuerpo; typing defers the reload until blur;
  a fast-forward deletion sticks (server, other device, and after a later write); Ajustes panel shows
  "Conectado a la Pi", then "Sin conexión con la Pi" + pending + last error with the server down, the app
  keeps saving locally, and "Sincronizar ahora" uploads after the server is back; Vercel-copy sentence only
  on the remote copy; no console/page errors on either device. Screenshots `osma-sync-conectado.png` and
  `osma-sync-sin-conexion.png` reviewed. Existing first-contact smoke `smoke-primer-OsmaGym.js` 6/6.
- Full suite: `npm run test:agente` 184/184 (baseline 140).

Known limits: a conflict merge is a union, so a deletion made on a stale base comes back (fast-forward
deletions stick); a meal or note edited on both sides during a conflict can appear twice; `plan`, `regen`,
`ejCustom` and `platos` are taken whole from the newer blob, so one side's change there can be lost in a
conflict (it stays in `historial`).

## Next step
Native review of the five commits, then deploy (Vercel + Pi; the Pi needs a service
restart for merge.js, `scripts/desplegar.sh` does it) and recreate the Hermes profile so the new SOUL
rule lands (`agente/hermes/crear-perfil.sh`).
