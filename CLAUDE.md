# CLAUDE.md — Gamificación Ultracem

Contexto para asistentes de IA (Claude Code, Codex, etc.) y para el equipo. Describe el estado de `origin/main` en el commit `eb22f58` (PR #10, 2026-10-21).

## 1. Qué es

MVP web de **gamificación comercial** para Ultracem (proyecto del semillero COOWEB, tercera entrega). Los **asesores** trabajan a **clientes comerciales** (ferreterías, constructoras, distribuidores) completando cuatro tareas por cliente. Al terminar las cuatro confirman una **venta simulada**. Un **administrador** asigna clientes, ve métricas y controla el modo Halloween.

- Repositorio: `github.com/SantiagoGuzmanCastano/gamificacion-ultracem`
- Idioma de la interfaz, commits, docs y mensajes: **español**.
- Mascota: pingüino **Topitín** (cambia de ánimo con el progreso y tiene skins).
- Asistente de IA: **Trompín**, un elefante asesor comercial.
- Estado: **local, sin desplegar** (ver `DECISIONES.md`, Decisión 11), aunque existe `vercel.json`.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite 8, JavaScript vanilla (ES modules), CSS plano, sin framework |
| Backend | Supabase: Auth, Postgres con RLS, funciones RPC `security definer` |
| IA | Supabase Edge Function (Deno) → OpenRouter (principal) / Gemini (respaldo) |
| Tests | `node --test` (sin dependencias) |
| Node | `^20.19.0 \|\| >=22.12.0` |

## 3. Comandos

```bash
npm ci                     # instalar (necesario antes del build)
cp .env.example .env.local # luego poner la clave PUBLISHABLE real
npm run dev                # servidor local Vite
npm test                   # tests unitarios (tests/*.test.js)
npm run build              # build de producción a dist/
```

Sin `.env.local` la app solo muestra "Falta configurar Supabase en .env.local.".
Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. **Nunca** usar `service_role` ni claves secretas en Vite.

Edge Function (secretos en Supabase, nunca en el frontend):
```bash
supabase secrets set OPENROUTER_API_KEY=... GEMINI_API_KEY=...
supabase functions deploy recommend-client
```
Variables opcionales: `OPENROUTER_MODEL` (por defecto `google/gemini-2.5-flash`) y `GEMINI_MODEL` (por defecto `gemini-2.5-flash`).

## 4. Estructura

```
index.html                 # monta #app y carga src/main.js
src/main.js                # TODA la UI y el estado (~620 líneas): auth, paneles, tienda, Halloween
src/game.js                # lógica pura: progreso, XP, estado de mascota, ánimo (con tests)
src/mascot.js              # rutas/etiquetas de imágenes del pingüino base
src/shop.js                # catálogo de skins + render de la tienda (innerHTML)
src/style.css              # estilos generales, tema claro/oscuro (data-theme)
src/shop.css               # estilos de la tienda
public/mascot/             # pingüino base: feliz / serio / sad
public/skins/              # skins de la tienda (+ skeleton/happy|sad|serious.png)
SKINS/                     # originales de las skins (duplicados de public/skins, ~22 MB)
supabase/migrations/       # esquema y funciones, en orden por timestamp
supabase/functions/recommend-client/index.ts  # Edge Function de IA
supabase/tests/halloween_mode.sql             # pruebas SQL de permisos del modo Halloween
tests/                     # game.test.js, shop.test.js, halloween.test.js
docs/superpowers/          # spec y plan del XP/ranking
odd/tasks/                 # bitácoras de las features tienda y Halloween
DECISIONES.md              # registro de decisiones de producto (leer antes de cambiar alcance)
PLAN-MVP-ESTATICO.md       # plan inicial
```

## 5. Modelo de datos (Supabase)

Las tablas activas empiezan por `mvp_`. Las tablas antiguas (`clients`, `goals`, `profiles`, `sales`) **no se usan**.

| Tabla | Clave | Notas |
|---|---|---|
| `mvp_profiles` | `user_id` → `auth.users` (cascade) | `full_name`, `role` (`admin`/`advisor`, por defecto `advisor`), `equipped_skin` (`classic`/`skeleton`) |
| `mvp_clients` | `id` | `name`, `type` (Ferretería/Constructora/Distribuidor/Otro), `advisor_id` → profiles |
| `mvp_tasks` | `id` | `client_id` (cascade), `title`, `description`, `completed_at` |
| `mvp_sales` | `id` | `client_id` **único** (cascade), `advisor_id`, `amount` aleatorio 100.000–1.000.000, `confirmed` |
| `mvp_app_settings` | `id = true` (fila única) | `halloween_enabled` (solo el admin puede actualizarlo) |

Triggers:
- `on_auth_user_created_mvp`: crea el perfil de asesor al registrarse.
- `on_mvp_client_created`: crea las 4 tareas fijas (Preparar una visita, Contactar al cliente, Revisar una cotización, Planear el siguiente paso).

Helpers en el esquema `app_private`: `is_admin()` e `is_advisor(uuid)`.

### RPC públicas (todas `security definer`, `search_path = ''`)

| Función | Quién | Qué hace |
|---|---|---|
| `get_mvp_advisors()` | admin | asesores con su email |
| `get_mvp_advisor_ranking()` | autenticado | ranking: ordena por **ventas confirmadas**, luego XP (tareas × 10) y luego nombre |
| `complete_mvp_task(task)` | asesor dueño | marca la tarea como completada; devuelve `true/false` (ya **no** crea ventas) |
| `confirm_mvp_sale(client)` | asesor dueño | exige 4/4 tareas; crea o marca la venta como `confirmed` |
| `clear_mvp_completed_tasks(client)` | asesor dueño | borra las 4 tareas si están completas; la venta se conserva |
| `reset_mvp_advisor_tasks(advisor)` | admin | borra todas las tareas del asesor (no las recrea) |
| `delete_mvp_advisor_clients(advisor)` | admin | borra los clientes del asesor y, en cascada, sus tareas y ventas |
| `delete_mvp_advisor(advisor)` | admin | borra los clientes y la cuenta en `auth.users` |
| `equip_mvp_skin(skin)` | asesor | `classic` siempre; `skeleton` exige modo Halloween y ≥1 venta confirmada |

El rol del primer admin se asigna a mano en el SQL Editor (ver README).

## 6. Flujo de la app (`src/main.js`)

1. `boot()` → `db.auth.getUser()`. Sin sesión se muestra `authPage()` (login o registro).
2. `loadData()` → perfil, asesores (solo admin), clientes con tareas, ventas y ranking.
3. `render()` → `shell()` reconstruye todo el layout y luego:
   - admin → `adminPage()`: métricas, ranking, ventas por asesor, pendientes por asesor, botones de borrado, formulario de nuevo cliente y control del **modo Halloween**.
   - asesor + `advisorView === 'shop'` → `renderShop()` (src/shop.js).
   - asesor → `advisorPage()`: métricas, ranking, selector de cliente, progreso con mascota, **Confirmar venta**, **Limpiar tareas completadas**, Trompín y lista de tareas.
4. Cada acción → RPC → `refresh(msg)` = `loadData()` + `render()` + aviso.
5. Modo Halloween: `refreshHalloween()` se ejecuta al iniciar, al enfocar la ventana y cada 10 s (admin, o asesor en la tienda); se detiene con `stopHalloweenSync()` al cerrar sesión o en `pagehide`.
6. Efectos: confeti al completar la 4.ª tarea, corazón de la mascota en cada tarea y mensaje de ánimo cada 2 tareas. Todos respetan `prefers-reduced-motion`.

Navegación del asesor: "Mi tablero" y "Tienda", en la barra lateral y en `nav.advisor-nav` para móvil. La barra lateral del admin es decorativa.

## 7. Tienda de skins (`src/shop.js`)

- 10 atuendos normales: Clásico (incluido), Playero 50, Urbano 100, … Absoluto 450 "ventas". **Todos muestran "Próximamente"**: el canje no está implementado.
- Halloween (solo si el admin lo activa): Zombie (300) y Esqueleto (precio mostrado 40). **Esqueleto se puede equipar con 1 venta confirmada** (regla real de backend).
- Al equipar el esqueleto, la mascota del tablero usa `public/skins/skeleton/*`.
- Los tests comparan el **SHA-256** de los PNG: no recomprimas ni modifiques esas imágenes, o fallarán los tests.

## 8. Ramas y PRs (estado al 2026-10-21)

Todas las ramas remotas ya están fusionadas en `main` (0 commits por delante).

| Rama | PR | Contenido |
|---|---|---|
| `feat/advisor-dashboards` | #1 | paneles separados admin/asesor |
| `feat/admin-reset-tasks` | #2 | borrar tareas de un asesor |
| `feat/delete-advisor-clients` | #3 | borrar clientes de un asesor |
| `feat/admin-metrics-sales` | #4 | ventas simuladas y métricas |
| `feat/ai-client-recommendations` | #5 | Trompín (Edge Function de IA) |
| `feat/ui-polish` | #6 | rediseño del tablero del asesor |
| `feat/task-completion-confetti` | #7 | confeti, corazones y mensajes de ánimo |
| `feat/tienda-cosmeticos` | #8 | catálogo de la tienda |
| `codex/halloween-tienda` | #9, #10 | modo Halloween global, ventas confirmadas, skin esqueleto |
| `interfaz` (solo local) | — | rama de trabajo de interfaz y animaciones; actualizada sobre `eb22f58` (PR #10). Ver `animaciones.md` |

Convenciones (`DECISIONES.md`, Decisión 9):
- `main` está protegida y solo recibe PRs.
- Una rama por cambio, con prefijo `feat/`, `fix/`, `docs/`, etc.
- Commits estilo Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`.
- Evitar referencias a Codex en ramas y commits. Nota: `codex/halloween-tienda` rompe esta regla.

## 9. Puntos frágiles conocidos

1. **`main.js` monolítico con estado global.** `render()` reconstruye todo el DOM, incluido `shell()`. Al re-renderizar se pierden el foco, el scroll y las animaciones. La barra lateral del asesor se modifica después de crearla (parche dentro de `shell()`).
2. **Acoplamiento JS↔CSS.** Las animaciones buscan `.mascot`, `#halloween-toggle`, `.shop-page`, etc. Si renombras una clase o un id, fallan sin mostrar errores.
3. **Limpiar antes de confirmar.** "Limpiar tareas completadas" aparece aunque la venta no esté confirmada. Si el asesor limpia primero, ya no puede confirmar la venta de ese cliente.
4. **El XP depende de que las tareas existan.** Limpiar o borrar tareas resta XP. El ranking ya prioriza ventas, pero el XP sigue siendo el segundo criterio.
5. **`delete_mvp_advisor`** no comprueba que el objetivo sea un asesor: llamando la RPC directamente, un admin podría borrar a otro admin o a sí mismo.
6. **Edge Function**: CORS `*`, sin límite de tamaño de la entrada, y el JSON del cliente va directo al prompt. El prompt pide 35 palabras y `DECISIONES.md` dice 25. En el front, los errores no-2xx se ven genéricos porque el mensaje real queda en `error.context`.
7. **Imágenes pesadas.** Las skins pesan 1–2,3 MB cada una, se cargan con `loading="eager"` y están duplicadas en `SKINS/` y `public/skins/`.
8. **Textos inconsistentes en la tienda.** Esqueleto muestra "40 ventas" pero se desbloquea con 1. Los precios dicen "ventas" mientras el spec original hablaba de XP.
9. **Tests.** Solo hay tests de lógica pura y del catálogo; no hay tests de UI ni de integración con Supabase (salvo `supabase/tests/halloween_mode.sql`).

## 10. Reglas para asistentes de IA

- Leer `DECISIONES.md` antes de cambiar el alcance o el comportamiento. Si se toma una decisión nueva, agregarla allí con el mismo formato.
- No modificar migraciones ya aplicadas: crear una **nueva** migración con timestamp posterior.
- Mantener `security definer` + `set search_path = ''` + `revoke ... from public, anon` en toda función nueva.
- Construir el DOM con `el()`/`textContent`. Usar `innerHTML` solo con contenido estático (hay que evitar XSS).
- No tocar los PNG de `public/skins` ni de `SKINS/` (tests con hash).
- No subir secretos. `.env.local` está en `.gitignore`.
- No hacer push, merge a `main` ni deploy sin autorización explícita. Trabajar en rama y abrir PR.
- Verificar con `npm test` y `npm run build` antes de proponer un commit.
