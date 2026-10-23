# Commission wallet

Objective: add the smallest secure commission-wallet flow for confirmed sales on `codex/advisor-client-history`.
Delivery: local migration and advisor UI; no migration push, commit, payment integration, or admin settings UI in this work unit.

## Specs

S1. "En la cartera de comisiones el asesor ve las ventas confirmadas, las toneladas vendidas, precio aplicado, la comisión generada."

S2. "Botón que diga reclamar" and, before real payment integration, "Tu solicitud de comisión fue registrada satisfactoriamente."

S3. "La comisión es la comisión" and it remains separate from points.

S4. "precio por comisión general y precio de tonelada" are future administrator configuration; this slice uses safe initial defaults and snapshots them on sale confirmation.

## Tasks

- T1 — S1, S3, S4 — inline — complete — Added secure commission schema, sale snapshots, and advisor-only request function; migration remains local pending explicit db push authorization.
- T2 — S1, S2, S3 — inline — complete — Added advisor wallet route, compact UI, and claim feedback.
- T3 — S1-S4 — inline — complete — 71 tests pass, build succeeds, and git diff --check passes; build retains the existing MapLibre chunk warning.

## Log

L1 — User request: "listo, ahora implementa la cartera de comisiones"

L2 — Existing evidence: `mvp_sales` already has confirmed sales and `tons_sold`; `mvp_app_settings` currently owns only Halloween configuration. No actual bank integration exists, so a claim can only register a pending request.

L3 — User selected COP 800.000 per ton and delegated the initial commission choice; MVP uses 3% (COP 24.000 per ton), with future admin editing and sale-level snapshots.

L4 — User requested clearer UI: highlight the available commission by client, separate redeemed commissions, remove "Solicitudes registradas", and use a light green block for redeemed entries. Implemented without changing the backend pending-request state.
