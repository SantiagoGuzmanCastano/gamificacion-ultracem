# Cosmetics shop frontend
Objective: deliver the approved normal-outfit shop without backend changes. Branch: `feat/tienda-cosmeticos`, based on `origin/main` at `7b73bbc`.
Delivery: local feature commit plus tracking closure, no push/deploy; forecast ~350 authored lines. Runner: `node --test`, `npm run build`, local browser checks.

## Specs
S1. "Por ahora, solo la colección de atuendos normales, a una pestaña aparte." Provide an advisor-only shop and a working return to the existing dashboard, including mobile navigation. Keep admin behavior unchanged.
S2. "el primer pingüino playero 50, el segundo 100, el tercero 150, el cuarto 200, así hasta llegar al último." Classic is included; normal outfits follow the supplied order: Playero 50, Urbano 100, Jazzy Dancer 150, Luchador 200, Empresario 250, Hacker 300, Hechicero 350, Fénix 400, Absoluto 450 XP.
S3. "No los modifiques, no hagas nada con ellos. Simplemente úsalos." Copy the ten normal PNGs without changing their bytes; retain all original files in SKINS. Show full characters with contain sizing, original colors and no effects on artwork.
S4. "ninguno se puede comprar" and "aun no tooquemos nada en backend". Catalog only: regular actions disabled as Próximamente. Classic is included, shown as the default outfit (Equipado, disabled); no equip, spend, persistence, auth, API, SQL or AI changes. Show only existing real XP as current experience, never invent accumulated XP or a redeemable balance.
S5. "los exclusivos de Halloween nada más van a estar cuando le administrarle un botón, que más adelante lo tendremos". Omit Halloween entirely in this delivery. No toggle, seasonal assets or hidden purchasing logic.
S6. "Un diseño usando los colores que se vienen manejando en la página". Follow the approved shop direction with navy sidebar, blue/yellow accents, pale-blue background, readable names and price below each image. Support light/dark themes, keyboard focus, small screens and reduced motion.
S7. "mira si no tenemos nada pendiente en esta rama y esta todo al dia". Preserve existing dirty files and delivery folders. Base the new branch on fetched origin/main. Verify functional checks and browser views before delivery.

## Tasks
T1 | S1–S7 | inline (existing flow understood; no parallel writer reason) | completed | 0e56090; RED missing shop module → GREEN 7/7 tests

## Implementation plan
1. Add a deterministic catalog test for outfit count/order/prices, asset existence and exclusion of seasonal outfits; observe RED with `node --test tests/shop.test.js`.
2. Add `src/shop.js` (catalog plus DOM renderer) and `src/shop.css` (scoped responsive styling). Copy normal artwork to `public/skins/` with stable ASCII filenames and byte-for-byte preservation. No new dependencies.
3. Add advisor-only Tablero/Tienda navigation to the existing shell and render branch; preserve state between views and theme switches, reset view at logout. Keep the dashboard/admin data flow unchanged.
4. Observe GREEN, full tests and build. Inspect desktop/mobile and dark shop, keyboard navigation, disabled buttons, missing-client advisor, admin and return to dashboard using local synthetic data. No production writes or credentials.
5. Independent verifier inspects the feature diff and checks navigation regressions (shared shell). Commit only this feature's paths; leave all pre-existing edits and deliverables unstaged. Update this log with evidence.

## Log
L1 (2026-10-21), user authorization: "tienes permitido usar las skills que estan instaladas, emill, frontend design... ui ux... etc, haz el plan y mejora el frontend... aun no tooquemos nada en backend, crea la rama nueva y ponte a trabajar, mira si no tenemos nada pendiente en esta rama y esta todo al dia"
L2. Fetch succeeded. Previous branch was seven merge commits behind origin/main; its tracked tree was identical. New branch starts at 7b73bbc and preserves all existing dirty changes. Removed origin/main upstream tracking from feature branch to avoid accidental delivery targeting.
L3. Skills: frontend-design, emil-design-eng, ponytail, writing-plans, executing-plans and playwright. Project skill registry and Engram are unavailable; no memory mirror can be written. Native gentle-ai CLI is unavailable; independent verification and ordinary tests remain required.
L4. Scope decision: existing XP is task-derived, so the shop labels it current experience. Persistent total/saldo and future Halloween mode remain separate backend work. No invented balances from the image mockup.
L5. RED observed with `node --test tests/shop.test.js` before implementation (module absent). GREEN: focused catalog/hash tests 2/2, full suite 7/7; Vite production build succeeded. Hash assertions use the supplied originals' SHA-256 values so tests do not require the untracked SKINS source directory.
L6. Local browser verified all ten images, prices, disabled controls, no seasonal content, keyboard navigation and heading focus, return to dashboard/client/task actions, logout reset, advisor with no clients, admin isolation, theme preservation and zero page errors. Widths 320/390/780/1024/1280/1600 had no horizontal overflow. Visually inspected desktop, mobile and dark mobile screenshots in output/playwright/. Browser used a local synthetic Supabase module and blocked external requests; no account or production data was used. Test probe files remain in ignored tmp/.
L7. Independent verifier /root/verify_shop: no blockers; S1–S7 passed within scope. Fresh TEMP baseline archive: 5/5 tests; overlaid feature: 7/7 tests; original/published PNG hashes match 10/10. Shared-shell theme/logout/admin behavior inspected independently. Review risk: item 3 (shared shell). Native gentle-ai review unavailable; not represented as a native approval. Engram mirror pending because tools are unavailable.
L8. Added the frontend catalog behavior to README without accepting any pre-existing documentation cleanup into this feature's commit. Large PNGs remain unchanged by user request; lazy loading limits initial loading work.
L9. Implementation committed locally as 0e56090 (218 insertions, 1 deletion plus ten original PNGs). Final full suite passed 7/7 and final production build succeeded (71 modules). After commit, remaining tracked changes exactly match the pre-existing cleanup: nine files, +39/-320. ENTREGA-CLIENTE, ZIP and original SKINS remain untracked. No backend files changed, no push or deployment. Next scope, only when requested: Halloween activation/redemption and persistent XP balances.
