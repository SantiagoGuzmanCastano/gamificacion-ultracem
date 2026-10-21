# Global Halloween shop section
Objective: administrator-controlled seasonal catalog shared by all advisors. Branch: `codex/halloween-tienda`, baseline `8ec6e18`.
Delivery: feature-branch work-unit commit; no push or production deployment. Forecast: ~300 authored lines; runner: `node --test`, `npm run build`, local browser and isolated PostgreSQL permission probes.

## Specs
S1. "no es local, se debe activar para todos los asesores, modo hallowen activado por el admin despliega las nuevas skins en la tienda". Persist one global setting in Supabase, disabled initially. Authenticated users read it; only an administrator may update it. Reject advisor/anonymous writes and keep all existing data intact.
S2. "aun no cambie nada de la UI UX en cuantoa decoracion, si no que en la tienda aparezca la seccion de las dos skins de halloween". Place Zombie and Esqueleto in a separate section above the normal collection only when enabled. Reuse existing visuals and supplied PNG bytes. Purchases and equipping remain disabled; seasonal prices are not yet specified.
S3. "ahora trabajemos en la rama nueva con los cambios propuestos". Preserve pre-existing dirty work and delivery folders. Global changes become visible on shop entry, window focus, and within 10 seconds while the shop is visible. Stop synchronization at logout and reject stale responses. A settings failure must not block existing clients, tasks, ranking or the normal shop.

## Tasks
T1 | S1–S3 | inline (one coherent implementation; no writer trigger) | in progress | baseline 8ec6e18; migration/UI/tests/docs and browser checks
T2 | S1–S3 | delegated verifier (permissions/migration and async synchronization) | pending | independent review after own checks
T3 | S1 | production application | pending explicit destination/session authorization | no remote database access performed

## Log
L1 (2026-10-21). User: "listo listo, ya esta el pr, ahora trabajemos en la rama nueva con los cambios propuestos". Clarification: "no es local, se debe activar para todos los asesores, modo hallowen activado por el admin despliega las nuevas skins en la tienda".
L2. Branch created preserving existing local changes. Read-only explorer confirmed existing `app_private.is_admin()` and reusable shop cards. Selected singleton with RLS and column-level UPDATE grants; periodic refresh avoids adding a Realtime publication/channel. No user-data migrations or XP changes.
L3. Engram and project skill registry/resolver are unavailable: memory mirror pending. Native gentle-ai CLI is unavailable. Supabase CLI/psql absent and Docker daemon stopped; isolated SQL verification needs temporary tooling. Production application remains a separate explicitly authorized operation; finish and verify local candidate first.
