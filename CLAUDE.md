# CLAUDE.md — Gamificación Ultracem

Contexto para asistentes de IA (Claude Code, Codex, etc.) y para el equipo.

- **Secciones 1–10:** el código que existe hoy. Se escribieron sobre `eb22f58` (PR #10). El 2026-10-22 `interfaz` se fusionó con `main` en `d0d07f1` (PR #17) y otra vez en `1d479ad` (PR #20, mapa e historial de clientes): el tablero del asesor, la navegación, el perfil, la tienda, la pantalla de carga y el mapa son los de `main`, con las mejoras de `interfaz` de las Decisiones 18–23. Las §4, §6, §8, §9 y §18 están actualizadas; **§5 y §7 todavía no reflejan** las migraciones de toneladas, fotos de perfil y skins de `main` (`20261022020000` en adelante).
- **Secciones 11–17:** el producto objetivo según el documento *Contexto de desarrollo · Copiloto comercial gamificado Ultracem v1.0* (21 oct 2026).

Las dos versiones **no coinciden** (ver §15). Antes de construir algo, decide con el responsable hacia cuál se avanza.

## 0. PROTOCOLO DE TRABAJO (PRIORIDAD MÁXIMA)

**No se hace ningún cambio sin confirmación explícita del responsable del proyecto.** Esta regla manda sobre cualquier otra de este archivo.

**Qué cuenta como cambio:**
- Crear, modificar, mover o borrar archivos o carpetas.
- Instalar, actualizar o quitar dependencias.
- Tocar el esquema de datos, las migraciones o los datos de muestra.
- Cambiar tokens de diseño, textos de la interfaz o nombres del juego.
- Cambiar reglas de negocio, fórmulas, puntos, umbrales o textos de la mascota.
- Cambiar el alcance (pantallas, historias o mecánicas).
- Ejecutar comandos que escriban, borren o envíen datos fuera del entorno local (push, PR, merge, deploy, SQL remoto).

**Qué sí se puede hacer sin preguntar:**
- Leer y explorar el repositorio.
- Analizar, resumir, listar riesgos y proponer opciones.
- Ejecutar comandos de solo lectura y pruebas que no modifiquen datos (`npm test`, `npm run build`, `git log/diff/status`).

**Cómo preguntar:**
1. Describe el cambio y su motivo en una línea.
2. Ofrece opciones A/B/C con ventajas y costos, y di cuál recomiendas y por qué.
3. Lista qué se tocaría (archivos, tablas, pantallas) y qué no.
4. Espera la respuesta. Si es ambigua, vuelve a preguntar; no asumas.
5. Haz una sola ronda de preguntas a la vez, agrupadas por tema, con máximo 4 preguntas.
6. Tras la aprobación, haz solo lo aprobado y reporta qué cambió.

**Conflictos y datos:**
- Si el contexto contradice el PRD, **gana el PRD**, y se pregunta antes de seguir.
- Las contradicciones entre pantallas o datos se señalan y se preguntan; no se arreglan en silencio.
- No se inventan cifras, razones ni clientes. Si falta un dato, se dice.
- Todo lo marcado **Propuesta** está sin validar y no es requisito.

Etiquetas usadas en §11–17:

| Etiqueta | Significado |
|---|---|
| **PRD** | Requisito del cliente |
| **Propuesta** | Idea del equipo, por validar |
| **Muestra** | Dato ficticio para diseño y demo |
| **Por confirmar** | Abierto; requiere decisión |

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

**Modo demo (sin Supabase):** con `VITE_DEMO=true` (en Vercel, o `set VITE_DEMO=true&& npm run dev` en Windows) la app usa `src/demo-client.js`, que imita la forma del cliente de Supabase con datos de muestra en memoria. No hace llamadas de red, se reinicia al recargar y muestra la franja "Modo demo · datos de muestra". Por defecto entra como asesor; con `?rol=admin` entra como administrador. Las fotos, crear cuentas y borrar la cuenta quedan desactivados, y la sugerencia de Trompín sale de la primera tarea pendiente, sin IA. Spec: `tests/demo-client.spec.js`.
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
src/main.js                # TODA la UI y el estado (~1.090 líneas): auth, paneles, tienda, mapa, perfil, Halloween
src/game.js                # lógica pura: progreso, XP, estado de mascota, ánimo (con tests)
src/mascot.js              # rutas/etiquetas de imágenes del pingüino base
src/shop.js                # catálogo de skins + render de la tienda (innerHTML)
src/style.css              # estilos generales, tema claro/oscuro (data-theme)
src/shop.css               # estilos de la tienda
src/advisor.css            # tablero oscuro del asesor (de main)
src/advisor-*.js           # métricas (toneladas, ventas semanales, cartera, racha desde ayer), íconos, entrada, ráfaga de tarea y destello de venta con GSAP
src/advisor-map.js         # mapa de clientela con MapLibre (de main) + mapa de calor de oportunidad (getOpportunityHeat)
src/admin-advisors.js      # tarjeta por asesor del admin: semáforo del PRD sobre 100 t/mes y menú "Gestionar"
src/streak-nudge.js        # llama de la racha (hot/cold) y franja de Topitín en mala racha (0 días), una vez por sesión
src/reminder.js            # recordatorio amable (V5): después de las 14:00 sin tareas completadas hoy
src/format.js              # formatPercent: "50 %", "7,83 %" (§14)
src/mascot-feedback.js     # mensajes de la mascota en el tablero (de main) + frases al tocar a Topitín
src/profile.js             # validación de la foto de perfil (de main)
src/profile-view.js        # perfil (de main) + "Tu progreso", skin equipada y logros con datos reales
src/loading-screen.js      # pantalla de carga con cemento (de main); es la que se usa
src/demo-client.js         # modo demo: cliente falso de Supabase con datos de muestra en memoria
public/shop/chests/        # cofres de la tienda de main (PNG)
public/data/               # GeoJSON de departamentos y capitales (de main)
public/mascot/             # pingüino base: feliz / serio / sad
public/skins/              # skins de la tienda (+ skeleton/happy|sad|serious.png)
SKINS/                     # originales de las skins (duplicados de public/skins, ~22 MB)
supabase/migrations/       # esquema y funciones, en orden por timestamp
supabase/functions/recommend-client/index.ts  # Edge Function de IA
supabase/tests/halloween_mode.sql             # pruebas SQL de permisos del modo Halloween
tests/*.test.js            # node --test (lógica pura, catálogo, métricas del tablero)
tests/*.spec.js            # Vitest + jsdom: demo, racha, perfil, admin, mapa de calor, zonas y recordatorio (npm run test:spec)
docs/superpowers/          # spec y plan del XP/ranking
odd/tasks/                 # bitácoras de las features tienda, Halloween y perfil
DECISIONES.md              # registro de decisiones de producto (leer antes de cambiar alcance)
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

El rol del primer admin se asigna a mano en el SQL Editor: `update public.mvp_profiles set role = 'admin' where user_id = (select id from auth.users where email = '<correo>' and email_confirmed_at is not null);` (el README se eliminó en `main`).

## 6. Flujo de la app (`src/main.js`)

1. `boot()` → `showLoadingScreen()` (pantalla de carga de `main`) → `db.auth.getUser()`. Sin sesión se muestra `authPage()` (login o registro). Con `VITE_DEMO=true`, `db` es `createDemoClient()`.
2. `loadData()` → perfil, asesores (solo admin), clientes con tareas, ventas y ranking.
3. `render()` → `shell()` reconstruye todo el layout y luego:
   - admin → `adminPage()`: métricas, ranking, ventas por asesor, **tarjetas de asesor** (semáforo, meta, "Ver clientes", "Gestionar"), formulario de nuevo cliente y control del **modo Halloween**.
   - asesor + `advisorView === 'shop'` → `renderShop()` (skins, Halloween y cofres).
   - asesor + `'map'` → mapa de clientela con mapa de calor; `'history'` → historial; `'profile'` → perfil con progreso.
   - asesor → `advisorPage()`: hero con anillo, racha (llama), recordatorio amable y Topitín que se puede tocar; franja de mala racha; métricas, ranking, selector de cliente, **Confirmar venta**, **Limpiar tareas** (solo con la venta confirmada), Trompín y lista de tareas.
4. Cada acción → RPC → `refresh(msg)` = `loadData()` + `render()` + aviso.
5. Modo Halloween: `refreshHalloween()` se ejecuta al iniciar, al enfocar la ventana y cada 10 s (admin, o asesor en la tienda); se detiene con `stopHalloweenSync()` al cerrar sesión o en `pagehide`.
6. Animaciones (GSAP):
   - **Tablero:** `playAdvisorEntrance()` (una vez por sesión; las métricas y los porcentajes de los anillos suben de 0 al valor). Tarea = ráfaga de 12 piezas; venta = destello dorado de 1,1 s (`advisor-effects.js`).
   - **CSS:** la llama de la racha titila, Topitín "respira" y las burbujas entran con 260 ms.
   - **Sin bienvenida** desde la Decisión 18.
   - Todo respeta `prefers-reduced-motion`.

Navegación del asesor (de `main`): Inicio, Historial clientes, Mapa clientela, Tienda y Perfil.

## 7. Tienda de skins (`src/shop.js`)

- 10 atuendos normales: Clásico (incluido), Playero 50, Urbano 100, … Absoluto 450 "ventas". **Todos muestran "Próximamente"**: el canje no está implementado.
- Halloween (solo si el admin lo activa): Zombie (300) y Esqueleto (precio mostrado 40). **Esqueleto se puede equipar con 1 venta confirmada** (regla real de backend).
- Al equipar el esqueleto, la mascota del tablero usa `public/skins/skeleton/*`.
- Los tests comparan el **SHA-256** de los PNG: no recomprimas ni modifiques esas imágenes, o fallarán los tests.

## 8. Ramas y PRs (estado al 2026-10-22)

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
| `feat/gamificacion-mapa-demo` | #28 (abierto) | rama limpia desde `main` (`6755ffe`) con 2 commits (docs y código): modo demo, mapa de calor 3D con oportunidad por zona, racha viva, Topitín que habla, perfil con progreso, tarjetas de asesor, recordatorio amable y celebraciones sobrias (Decisiones 18–24). Reemplaza al #11. **Sin merge**: requiere autorización |
| `interfaz` | #11 (por cerrar) | historial de trabajo con los mismos cambios; su contenido se pasó limpio al #28 |
| ramas de `main` posteriores | #12–#20 | tienda con marcos y fondos, admin con pestañas, logo PNG, toneladas, tablero oscuro, perfil con foto y borrado de cuenta, pantalla de carga, avatares del ranking, mapa (MapLibre) e historial de clientes |
| `wip/mapa-leaflet` | — (solo local) | mapa con Leaflet de `interfaz`, reemplazado por el de `main`; se guarda como referencia |

Nota de acceso: el remoto `origin` usa SSH y la llave local es rechazada. Push y fetch funcionan por HTTPS con Git Credential Manager. Solo se hacen con autorización.

Convenciones (`DECISIONES.md`, Decisión 9):
- `main` está protegida y solo recibe PRs.
- Una rama por cambio, con prefijo `feat/`, `fix/`, `docs/`, etc.
- Commits estilo Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`.
- Evitar referencias a Codex en ramas y commits. Nota: `codex/halloween-tienda` rompe esta regla.

## 9. Puntos frágiles conocidos

1. **`main.js` monolítico con estado global.** `render()` reconstruye todo el DOM, incluido `shell()`. Al re-renderizar se pierden el foco, el scroll y las animaciones. La barra lateral del asesor se modifica después de crearla (parche dentro de `shell()`).
2. **Acoplamiento JS↔CSS.** Las animaciones buscan `.mascot`, `#halloween-toggle`, `.shop-page`, etc. Si renombras una clase o un id, fallan sin mostrar errores.
3. ~~**Limpiar antes de confirmar.**~~ Resuelto en la Decisión 22: "Limpiar tareas" solo aparece con la venta confirmada (`canClearCompletedTasks`). La RPC sigue permitiéndolo si se llama directo.
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
- Ante cualquier duda, cambio no previsto o contradicción entre fuentes: **detenerse y preguntar** con el formato de §0.

---

## 11. Producto objetivo: Copiloto comercial gamificado (contexto v1.0)

Fuentes del contexto:
- el PRD MVP v2 (PDF, **fuente de verdad**);
- el brief de gamificación y las guías de diseño y de marca;
- los prompts y pantallas de Stitch (2 de 10 generadas);
- el guion del pitch de 7 minutos.

Estado: diseño en curso, desarrollo por iniciar.

**Qué es:** un copiloto complementario al CRM. Convierte los datos del CRM, cargados desde un **archivo**, en una **tarea diaria por asesor**: una lista corta de clientes a visitar, cada uno con su razón. Cada avance suma **UltraPuntos**, racha y niveles. La mascota es **Cemi la Hormiga**.

**Vistas:**
- **Vendedor:** mobile first, referencia de 390 px.
- **Administrador:** escritorio de 1280 px, responsive.

**Problema (PRD):**
- Hay que vender unas 55.000 t al mes con 18 asesores, y unos 7 no llegan a su presupuesto.
- El seguimiento actual llega tarde y solo dice "cumpliste o no".

**Meta de negocio (PRD):** subir la participación en el canal distribución del **7,83 % al 10 %**.

| Cifra | Valor | Origen |
|---|---|---|
| Mercado total | 4.653.177 t | PRD |
| Ventas Ultracem | 364.322 t | PRD |
| Brecha | 2,17 pp | PRD |
| Oportunidad | ≈100.996 t (el PRD pide confirmar contra 100.974) | PRD / Por confirmar |
| Aporte por asesor | ≈5.611 t (oportunidad / 18) | PRD |

`Oportunidad = (0,10 − 0,0783) × Mercado total`.

**Resultado esperado (PRD):** que un asesor que sigue el sistema llegue a más del 80 % de su objetivo. No se promete más.

### 11.1 Alcance
- **Dentro (PRD):**
  - Vendedor: mi avance, clientes por color, tarea del día, puntos, racha, niveles y recordatorio amable.
  - Admin: KPI nacional, avance por asesor, brecha por departamento, cobertura por municipio y metas.
  - Datos desde un archivo cargado; IA para elegir y explicar clientes y redactar ánimo.
  - Recálculo al editar una meta y demo de 6 pasos sin intervención manual.
- **Extras (Propuesta):** ranking por zona, insignias, premios simbólicos y Cemi con 3 estados.
- **Fuera (PRD):**
  - Conexión automática al CRM y app nativa.
  - Puntos convertibles en dinero o comisión.
  - Promociones a clientes y variables extra.
  - Puntos por SKU y bonos por leads de WhatsApp.

### 11.2 Historias
| ID | Historia | Origen |
|---|---|---|
| A1 | Avance por asesor ordenable (meta, venta, cumplimiento, brecha, clientes activos/nuevos/recuperados, estado) | PRD |
| A2 | Brecha por departamento ordenada por oportunidad, con estado atacar/defender | PRD |
| A3 | Cobertura por municipio (con y sin compra, %, alertas de concentración) | PRD |
| A4 | KPI nacional de participación y oportunidad en toneladas | PRD |
| A5 | Definir la meta de un asesor (participación y clientes objetivo) con recálculo | PRD |
| V1 | Mi avance: meta, ventas, clientes, pedido promedio y aporte a la meta | PRD |
| V2 | Clientes por color, filtro y detalle con historial | PRD |
| V3 | Tarea del día: lista corta con la razón de cada cliente | PRD |
| V4 | Puntos, racha y niveles | PRD |
| V5 | Recordatorio amable | PRD |
| V6 | Ranking de mi zona | Propuesta |
| V7 | Insignias y canje simbólico | Propuesta |

Los criterios Gherkin de V3–V7, A1 y A5 están en el documento de contexto (§9). **Falta redactar** los de V1, V2, A2, A3 y A4 con el responsable.

### 11.3 Vistas
| # | Vista | Rol | Stitch | MVP |
|---|---|---|---|---|
| 1 | Inicio (Cemi + tareas de hoy) | Vendedor | Generada | Obligatoria |
| 2 | Mi avance | Vendedor | Prompt | Obligatoria (puede ser tarjeta en Inicio) |
| 3 | Clientes (lista + detalle) | Vendedor | Prompt | Obligatoria |
| 4 | Ranking y logros | Vendedor | Generada | Opcional |
| 5 | Premios y canje | Vendedor | Prompt | Opcional |
| 6 | Perfil | Vendedor | Por definir | Opcional (preguntar) |
| 7 | Panel nacional | Admin | Prompt | Obligatoria |
| 8 | Asesores | Admin | Prompt | Obligatoria |
| 9 | Departamentos y municipios | Admin | Prompt | Obligatoria |
| 10 | Metas | Admin | Prompt | Obligatoria |

**Navegación:**
- **Vendedor:** barra inferior con Inicio, Clientes, Ranking, Premios y Perfil.
- **Admin:** barra lateral con Panel, Asesores, Departamentos y Metas.

**Rutas sugeridas (Propuesta):** `/`, `/avance`, `/clientes/:id`, `/ranking`, `/premios`, `/perfil`, `/admin`, `/admin/asesores`, `/admin/departamentos/:id` y `/admin/metas`.

**Demo de 6 pasos (PRD):**
1. Admin · Panel nacional.
2. Admin · Departamentos.
3. Admin · Metas (editar y ver el recálculo).
4. Vendedor · Mi avance + Clientes.
5. Vendedor · Inicio con la tarea del día y Cemi seria.
6. Vendedor · completar las tareas: Cemi feliz, suman puntos y sigue la racha.

## 12. Reglas de negocio (PRD salvo indicación)

| Semáforo | Regla |
|---|---|
| Participación | ≥10 % verde · 8–9,99 % amarillo · <8 % rojo |
| Asesor | ≥100 % cumple · 80–99 % en riesgo · <80 % crítico |
| Cliente | **Por confirmar** |
| Zona | Supera su objetivo → oportunidad 0 y "Defender"; si no, "Atacar" |

- **Referencia por asesor:** 50 clientes activos, 20 recuperados, 10 nuevos y el 80 % de sus municipios con compra.
- **Regla de clientes:** para tener el 25 % del mercado de una zona hay que venderle al 25 % de sus clientes.
- **Fórmulas** (confirmar con el PRD):
  - `Pedido promedio necesario = Meta (t) / Clientes objetivo`
  - `Cumplimiento = Venta / Meta × 100`
  - `Brecha = Meta − Venta`
- **Por confirmar:** cómo se deriva la meta en toneladas a partir de la participación objetivo.
- **Arquitectura de cálculo:** con reglas exactas se calculan avance, oportunidad, semáforos, puntos, niveles, rankings y metas. La IA solo prioriza clientes, explica el porqué en una frase y redacta ánimo, siempre con los datos cargados. Si falta información, dice "Faltan datos de este cliente".

## 13. Sistema de juego (valores = Propuesta)

**UltraPuntos:**

| Acción | Puntos |
|---|---|
| Completar la tarea del día | 50 (una vez al día) |
| Recuperar un cliente | 150 |
| Ganar un cliente nuevo | 200 |
| Llegar a un municipio sin compra | 250 |
| Subir el pedido promedio | 100 |
| Hito de racha (5 / 10 / 20 días) | 100 / 200 / 400 |

Los puntos se otorgan una sola vez por cliente y periodo, y nunca se convierten en dinero.

**Niveles:**

| Nivel | Rango | Puntos |
|---|---|---|
| 1 | Novato Ultra | 0 |
| 2 | Aprendiz Ultra | 500 |
| 3 | Asesor Ultra | 1.500 |
| 4 | Experto Ultra | 3.500 |
| 5 | Maestro Ultra | 7.000 |

**Racha:** suma un día al completar la tarea del día y vuelve a 0 si se pierde un día hábil. Al perderla, solo ánimo, sin reproche. **Por confirmar:** si cuenta de lunes a viernes o hasta el sábado.

**Recordatorio amable:** después de la hora de corte (Propuesta: 14:00), la tarjeta pasa a ámbar con un mensaje que no menciona a otros asesores.

**Ranking (V6):**
- Se agrupa por zona o región, no a nivel nacional.
- Muestra el Top 3 y la posición propia con los 2 asesores de arriba y los 2 de abajo.
- Ordena por **% de avance hacia la meta propia**.
- **Nunca muestra los últimos puestos.**

**Insignias:** Pionero de Mezcla Lista, Rayo Vanesa (requiere datos de leads), Aliado Brilla, Embajador Ruta 360 y Racha de fuego.

**Premios simbólicos:**
- Sello "Asesor Ultra Top" (800), boletín interno (1.000) y marco dorado (500).
- Bono D1 y Día libre quedan bloqueados, sujetos a aprobación del cliente.

**Principio:** el sistema **nunca regaña ni compara** de forma que exponga al vendedor.

## 14. Diseño y marca (Propuesta; el manual oficial de Ultracem manda si existe)

**Paleta desaturada:**

| Token | Hex | Uso |
|---|---|---|
| `bg` | #F8F9FA | fondo |
| `card` | #FFFFFF | tarjetas |
| `border` | #E5E7EB | bordes |
| `ink` | #1E293B | texto y estructura |
| `ink-muted` | #64748B | texto secundario |
| `progress` | #475569 | barras |
| `accent` | #F59E0B | **solo** puntos, monedas, medallas y premios |
| `accent-soft` | #FEF3C7 | fondos de puntos |
| `ok` | #5E9C7E | al día, hecho |
| `risk` | #C8A951 | en riesgo |
| `alert` | #C9605A | crítico |

**Reglas de color:** el color nunca va solo (siempre con ícono y etiqueta), el semáforo no se usa como fondo grande y el acento no marca errores.

**Tipografía:**
- **Montserrat** para títulos (24/700 y 18/600) y cifras.
- **Inter** para el texto (16 y 14) y los metadatos (12/500); números tabulares en tablas.
- Texto esencial de al menos 14 px.

**Forma:**
- Tarjetas con radio de 12 px, borde de 1 px y sombra suave; márgenes de 16 px y base de 8 px.
- Zonas táctiles de 44 × 44 px.

**Cemi la Hormiga:**
- Cuerpo #334155, cara #F1F5F9, casco #E3C16F con "U" y chaleco reflectivo.
- Estados: **Triste** al 0 %, **Serio** del 1 al 99 % y **Feliz** al 100 %.
- Acompaña y anima; nunca critica. **Por confirmar:** la aprobación del cliente.

**Movimiento (diferente a lo implementado):**
- Transiciones de 200–300 ms.
- Destello dorado de menos de 1,5 s, que se puede omitir.
- Contador de puntos que sube número a número.
- **Sin confeti saturado.**
- Con "reducir movimiento", un cambio de color estático.

**Voz:**
- Habla de **tú**, con frases cortas.
- Números con punto de miles y coma decimal (`1.480`, `7,83 %`) y unidades en "t".
- Nunca regañar, prometer dinero ni inventar datos.

## 15. Brechas entre el código actual y el producto objetivo

Ninguna se resuelve sin preguntar (§0).

| Tema | Código actual (§1–10) | Producto objetivo (§11–14) |
|---|---|---|
| Stack | Vite + JS vanilla + Supabase (ya construido) | Abierto en el contexto: Django+HTMX, Django/FastAPI+React o Next.js |
| Datos | Clientes creados a mano por el admin; ventas simuladas aleatorias | Archivo cargado con toneladas, municipios y zonas (formato por definir) |
| Tareas | 4 tareas fijas por cliente (trigger) | Tarea del día = lista corta de clientes con su razón (IA) |
| Puntos | XP: 10 por tarea | UltraPuntos por acción (50/150/200/250/100) y 5 niveles |
| Ranking | Global y por ventas confirmadas; muestra a todos y anuncia "sube al puesto 1" | Por zona, % de avance, Top 3 ±2, sin últimos puestos ni comparaciones expuestas |
| Mascota | Pingüino **Topitín** con skins (PNG protegidos por hash en los tests) | **Cemi la Hormiga** con 3 estados |
| Asistente IA | **Trompín** (elefante) sugiere la siguiente acción | IA sin personaje: prioriza clientes y redacta ánimo |
| Tienda | Skins con precios en "ventas" y modo Halloween | Premios simbólicos canjeados con UltraPuntos |
| Admin | Panorama, borrado de tareas/clientes/asesores y Halloween | Panel nacional KPI, Asesores, Departamentos/municipios y Metas con recálculo |
| Diseño | Navy/amarillo, Poppins (guía `Copiloto Ultracem.html`) | Paleta desaturada, Montserrat + Inter |
| Animación | Entrada del tablero de `main`; ráfaga de 12 piezas por tarea y destello dorado de 1,1 s por venta (Decisión 23); sin intro | Animación sobria, destello <1,5 s, **sin confeti saturado** |
| Navegación | SPA sin rutas; lateral (asesor) | Barra inferior de 5 destinos (vendedor) y rutas |
| Niveles en guías | `Copiloto Ultracem.html`: Cimiento → Torre, 10 XP por tarea | Novato → Maestro Ultra, UltraPuntos |

**Inconsistencias internas del contexto (§14 del documento):**
1. Roberto C. es "Maestro Ultra · Nivel 5" con 1.480 puntos, pero ese rango exige 7.000.
2. "Te faltan 220 puntos para tu próximo rango" aparece estando en el rango máximo.
3. Los premios piden niveles 6 y 7, pero solo hay 5 niveles.
4. Las tareas de Inicio dan +150/+80/+120/+100 puntos, pero el modelo da 50 por la tarea del día.
5. El ranking es de la zona Bolívar, semana 3: hay que confirmar el agrupador y si es semanal o mensual.
6. La oportunidad aparece como 100.974 o 100.996 t.

## 16. Decisiones abiertas (preguntar al responsable)

- **Tecnología:**
  - ¿Se mantiene Vite + Supabase o se cambia de stack?
  - ¿Dónde se despliega y con qué base de datos?
  - ¿Qué proveedor de IA se usa, y se llama en vivo o se precalcula?
  - ¿Cómo se maneja el acceso y los roles?
- **Datos:**
  - ¿Formato y columnas del archivo, y si existe uno real?
  - ¿Cómo se deriva la meta en toneladas?
  - ¿Cada cuánto se recarga el archivo y cuándo se otorgan los puntos?
- **Juego:**
  - Valores de puntos, niveles y racha (días y hora de corte).
  - Umbrales de color de los clientes.
  - Premios aprobados.
  - Si Ranking, Premios y Perfil entran al MVP.
- **Diseño:**
  - Marca oficial.
  - Aprobación de Cemi.
  - **¿Topitín y Trompín se reemplazan o conviven?**
  - ¿El admin usará escritorio o celular?
- ~~**Confeti de `main`**~~: resuelto en la Decisión 23 (ráfaga de 12 piezas y destello dorado).

## 17. Plan sugerido (Propuesta; cada fase se aprueba antes)

| Fase | Contenido |
|---|---|
| 0 | Resolver §15–16 |
| 1 | Andamiaje, tokens y componentes base |
| 2 | Datos de muestra y reglas de cálculo con pruebas |
| 3 | Vendedor: Inicio, Mi avance y Clientes |
| 4 | Admin: Panel, Asesores, Departamentos y Metas |
| 5 | IA: tarea del día y mensajes |
| 6 | Extras: Ranking, insignias, Premios y Perfil |
| 7 | Ensayo de la demo de 6 pasos, accesibilidad y pulido |

**Definición de terminado por vista:**
- Coincide con Stitch y con los tokens de §14.
- Cumple su Gherkin.
- El color va siempre con ícono y texto.
- Zonas táctiles ≥44 px y texto ≥14 px.
- Funciona a 390 px o a 1280 px.
- Respeta "reducir movimiento".
- Usa el tono y el formato numérico definidos.
- No tiene datos inventados.
- Está probada con los datos de muestra.

**Documentos del proyecto (fuera del repo):**
- `PRD_Reto_Ultracem_MVP.pdf` (fuente de verdad).
- `gamificacion-prd-ultracem.md`.
- `guia-marca-ultracem-copiloto.md`.
- `guia-diseno-stitch-ultracem-v2.md`. La v1, con colores saturados, está reemplazada: no usarla.
- Los prompts de Stitch.
- `pitch-7-minutos-reto-ultracem.md`.

---

## 18. Estado de trabajo y traspaso (actualizado 2026-10-22)

**Ramas y remotos**
- Rama de trabajo: **`interfaz`** (local). Sigue a **`fork/interfaz`**.
- `fork` = `https://github.com/jesus123-git/gamificacion-ultracem.git` (fork de Jesus14, para su Vercel). Último push: `3626cb4` (intro v2); **atrasado** respecto a `interfaz`.
- `origin` = repo de SantiagoGuzmanCastano (SSH falla; usar HTTPS con Git Credential Manager: `GCM_INTERACTIVE=never git push https://github.com/SantiagoGuzmanCastano/gamificacion-ultracem.git interfaz`). Su `interfaz` y el **PR #11** están en `e352b38`, sin conflictos con `main` (`1d479ad`). **Preguntar siempre a qué remoto subir.**
- 2026-10-23: los cambios de `interfaz` se pasaron en 2 commits a `feat/gamificacion-mapa-demo` (PR #28) sobre `main` `6755ffe`, sin la bienvenida, el loader viejo ni `animaciones.md`. El historial completo sigue en `interfaz` (PR #11, por cerrar).
- El título del PR #11 no se pudo cambiar: el panel del navegador no tiene sesión en GitHub. El texto aprobado está en el traspaso del 2026-10-22.
- `.env.example` tiene una línea en blanco solo en `stash@{0}`: **nunca incluirla** en commits.

**Vercel (cuenta jesus-project-jm, proyecto `gamificacion-ultracem`, conectado al fork)**
- Production sigue `main` → `gamificacion-ultracem-nine.vercel.app`, **sin** modo demo. `interfaz` sale como **Preview**.
- Para la demo: variable `VITE_DEMO=true` de tipo **Config** (no Secret) en Preview, y luego **Deployments → deploy de `interfaz` → ⋯ → Redeploy**.
- La app real necesita `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`. El responsable **no tiene acceso a Supabase**; la clave la tiene Santiago. Su `.env.local` local todavía tiene `your_publishable_key`.

**Pruebas y demo local**
- `npm test` = `node --test` (63) + Vitest `*.spec.js` (82). `npm run build` debe pasar (avisa de un chunk >500 kB por MapLibre; es solo un aviso).
- `.claude/launch.json` (sin commit) tiene la config `demo` para abrir el modo demo en el puerto 5179 desde el panel del navegador.
- Demo local sin Supabase: `set VITE_DEMO=true&& npm run dev` (Windows cmd). Con `?rol=admin` entra el administrador.
- **No dejar servidores de Vite corriendo** al terminar: bloquean `node_modules` y `npm ci` falla con EPERM.

**Preferencias del responsable**
- Responder en español, paso a paso, con capturas cuando las pide.
- Una sola rama con todo; nada de ramas apiladas.
- TDD: spec en Red, mostrarlo y preguntar antes de implementar (Green).
- Preguntar antes de cualquier cambio (§0); push, PR y deploy solo con orden explícita.

**Pendiente**
- Push del último lote (recordatorio, celebraciones y docs) y cambiar el título del PR #11 en GitHub.
- Subir `interfaz` al fork y redeploy del Preview de Vercel con `VITE_DEMO=true` para la demo.
- Actualizar §5 y §7 con las migraciones de `main` (toneladas, fotos, ubicación de clientes, skeleton con 2 ventas).
- Si Vitest falla con "Failed to start worker", correr `npx vitest run .spec. --pool=forks --no-file-parallelism`.
- Ideas no hechas: textos de 11–12 px en el tablero (el §17 pide ≥14 px), "Avance de tu cartera" repite el anillo del hero, y la hora de corte del recordatorio sigue siendo Propuesta.
