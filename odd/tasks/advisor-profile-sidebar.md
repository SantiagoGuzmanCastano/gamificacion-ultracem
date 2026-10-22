# Advisor profile sidebar
Branch: `codex/advisor-profile-sidebar` from `origin/main`; delivery: work-unit commit; runner: `npm test`, `npm run build`.
Objective: move advisor identity and sign-out into a sidebar profile, with an optional device-file photo selected only during registration.

## Specs

1. **S1 — Registration photo**: "El selector de foto aparece **solo al registrar un asesor**." The selector must use device files, allow skipping, and never appear on ordinary sign-in.
2. **S2 — Sidebar profile**: "En el sidebar muestra la foto guardada y permite cambiarla desde Perfil." The advisor profile must expose the saved photo, a change-photo action, and a default avatar when absent.
3. **S3 — Sign out placement**: "Cerrar sesión también queda allí." Remove advisor user identity and sign-out from the top bar without removing unrelated top-bar controls.
4. **S4 — Scope**: "SOLO ARCHIVOS DEL DISPOSITIVO POR LO PRONTO". Camera capture, cropping, gallery, name editing, and administrator UX changes are out of scope.
5. **S5 — Safety**: preserve existing auth, role separation, themes, responsive behavior, active assets, and historical migrations; add only the minimum profile/storage/RLS migration if the audit proves it is missing.

## Tasks

- T1 (S1, S5) — inline — inspect auth/profile/storage and implement registration photo persistence — pending.
- T2 (S2-S4) — inline — render sidebar profile, change-photo, and move advisor sign-out — pending.
- T3 (S1-S5) — inline — add focused tests/docs, run `npm test` and `npm run build` — pending.

## Log

L1: "listo, entonces dame el plan final [$ponytail:ponytail]"
L2: User confirmed the photo is requested only during advisor registration and selected from device files only; no camera for now.
L3: Current checkout was dirty and historical; implementation is isolated in a new worktree from `origin/main`.

L4: Local origin/main is at 7b73bbc (PR #7); local origin/codex/advisor-dashboard is at 0e562c7 and contains the known dashboard/Skeleton/deprecated-file lineage. Remote fetch was not performed because remote authorization is not yet explicit.
L5: User explicitly authorized git fetch origin; origin/main updated to 2caff35 (merged PR #15), and codex/advisor-profile-sidebar now tracks that commit. No source code was modified.
L6: Implemented T1-T3: private Storage/RLS migration, advisor registration-time profile prompt with optional device-file upload, sidebar/mobile profile access, advisor sign-out moved out of top bar, image validation tests. 
pm test passed 25/25; 
pm run build passed.
L7: Independent verification found expiring signed avatar URLs; added a 50-minute renewal timer and server-side Storage bucket MIME/5 MB limits. No other blocker remained.
L8: Final verifier recheck confirmed signed URL renewal starts after upload and clears on sign-out. 
pm test passed 25/25 after the correction; git diff --check passed.
L9: User clarified that Perfil must be a first-class advisor navigation view like Inicio, Tienda, and Mapa clientela. Added active Perfil navigation and dedicated profile page; photo editing remains available from that page.
