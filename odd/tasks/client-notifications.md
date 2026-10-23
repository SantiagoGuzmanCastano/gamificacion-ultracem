# Client request and assignment notifications

Objective: make advisor client requests and admin assignments visible in-app and ready for email delivery on `codex/advisor-client-history`.
Delivery: local migration, advisor/admin UI, and optional Resend Edge Function; no remote migration push, commit, push, or deploy.

## Specs

S1. "El botón de solicitar un cliente sirva como tal y le llegue una notificación al correo y una notificación tipo push a la vista del administrador."

S2. "cuando un administrador le asigne un cliente nuevo a ese asesor, le salga una notificación push pequeña y una notificación en su respectivo correo."

S3. Interpretación MVP: la notificación tipo push será un aviso visible dentro de la aplicación; no se implementará push nativo del navegador.

S4. El sistema debe conservar la notificación interna aunque el proveedor de correo no esté configurado.

S5. "enfócate antes de hacer la ui hacer el backend, porfa, o sea soluciona que el botón de notificaciones sí envíe las notificaciones al correo porque no lo está haciendo."

## Tasks

- T1 — S1-S4 — inline — complete — Added request/notification schema, RLS, realtime publication, idempotent request RPC, assignment RPC, and read RPC.
- T2 — S1-S3 — inline — complete — Activated request button and added in-app badge/toast notifications with realtime subscription.
- T3 — S2 — inline — complete — Admin assignment now emits advisor notification; added optional Resend Edge Function.
- T4 — S1-S4 — inline — complete — 73 tests pass, build succeeds, and git diff --check passes; remote migration/function deployment remains pending.
- T5 — S1-S2, S4-S5 — inline; independent verification for delivery risk — partial — Reproduced remote HTTP 502; repaired silent failures and inaccurate accepted counts; added notification-scoped provider idempotency (24-hour window). Runtime regressions: 5 RED before correction; 11 GREEN after correction. Full suite: 86/86. Build and diff check pass. Independent verifier confirmed auth boundaries and partial accepted-count accuracy. Hardened pre-existing raw exception response after verifier advisory. Provider rejection cause, updated deployment and real delivery remain pending. No commit authorized.
- T6 — S1-S3 — inline; independent verification for async UI race — complete — Added floating bell center for both roles, individual read/action behavior, admin assignment shortcut, advisor task shortcut, realtime refresh preservation, and styled the existing “Solicitar un cliente” control with loading feedback. Full suite: 95/95; build and diff check pass.

## Log
L12 — User requested archiving Resend for the MVP: no real email calls; keep in-app notifications and show simulated email confirmations for admin request and advisor assignment. No backend changes.
L13 — User requested replacing the technical simulated-email wording with friendly Topitín messages, without exposing that the email is simulated.

L1 — User request: "ejecuta con [$ponytail:ponytail](C:\Users\linao\\.codex\\plugins\\cache\\ponytail\\ponytail\\5.3.2\\skills\\ponytail\\SKILL.md)"

L2 — Product plan: persist requests and notifications; use visible in-app notifications for MVP; keep email delivery behind an Edge Function and provider secret.

L3 — User clarified that push means a small in-app notification, not native browser or operating-system push.

L4 — Independent audit found and the implementation fixed a concurrent duplicate-request race using an idempotent unique-index conflict path. Email still requires Edge Function deployment and Resend secrets.

L5 — User correction: "Primero el botón está maluco, está feito, no me llega ningún mensaje al correo y además la pestaña de notificaciones de ninguno de los dos funciona muy bien." Backend first; floating notification UI deferred.

L6 — Remote Supabase logs show POST 502 for send-notification-email. Resend log connector authentication failed twice; no inference was made about the Edge Function's separate key. Existing tests only checked source patterns, not actual delivery. Function now reports controlled provider status/code, validates notification queries and recipients, requires provider acceptance ID, and counts accepted messages only. Frontend preserves saved business operations but warns when their email fails. No database or auth changes; no deployment in this repair task. Durable retry tracking beyond the provider's 24-hour idempotency window is not implemented.

L7 — User explicitly authorized redeployment. Deployed backend repair to Supabase project iynwzclstiusgxxevmlp; functions list verifies send-notification-email ACTIVE version 4 with JWT verification enabled. T5 remains partial: actual provider rejection and inbox receipt require real request/assignment tests, reserved to the user. Frontend error-feedback changes remain local and are not yet deployed to the public website. No email test sent, no database mutation, no commit or push.

L8 — User correction: “recuerda cambiar el boton de solicitar un cliente”. The request control now has the same intentional Ultracem styling in its enabled and loading states; its existing RPC/email flow remains unchanged. UI regression test also covers stale realtime refreshes not restoring a notification already marked read.

L9 — User requested explicit notification controls for both panels: a “Marcar como leído” button per unread item and a compact “Limpiar leídas” control in the dropdown. Read items are hidden locally for the current session without deleting notification history from Supabase. Full suite: 96/96; diff check passes.

L10 — User correction: an administrator must not mark a client-request notification as read before assigning the requested client. The read handler now checks the request status and rejects pending requests with “Asigna el cliente antes de marcar esta solicitud como leída.” Regression coverage added; full suite: 97/97 and build passes. No migration was needed.

L11 — User correction: when an advisor receives a new client assignment, the current actions must open immediately instead of requiring a notification click. Realtime client-assigned events now load the client, select it, navigate to the advisor dashboard, and focus the actions panel. Regression coverage added; full suite: 98/98 and build passes.
