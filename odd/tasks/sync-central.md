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
- [ ] S3 `storage-remote.js`: adopt merged responses, `refrescar()` on focus/visibility/online/interval, `forzar()`, status
- [ ] S4 app wiring: re-render on remote change keeping UI state; "Sincronización" panel in Ajustes; SW cache bump
- [ ] S5 freshness for the trainer agent: `resumen_general.sincronizacion` + SOUL rule
- [ ] S6 two-device browser smoke test

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

## Next step
S3.
