# Animaciones — Gamificación Ultracem

Especificación de todas las animaciones de la interfaz. Cubre botón por botón qué se mueve, cuándo, cuánto tiempo y con qué curva.

- **Fuente de inspiración:** la guía de diseño `Copiloto Ultracem.html` (carpeta `tercera_entrega`), que anima todo con **GSAP 3.12.5**.
- **Rama:** `interfaz`, actualizada con `origin/main` en `eb22f58` (incluye tienda, modo Halloween y "Confirmar venta").
- **Estado (2026-10-22):** al fusionar `interfaz` con `main`, el equipo eligió las animaciones del tablero que ya estaban en `main` (`advisor-entrance.js` y `advisor-effects.js`). **§1–12 quedan como referencia histórica, sin código vigente.** Lo único implementado de este documento es la **§13 (intro de bienvenida)**, en `src/welcome-motion.js`, `src/welcome.js` y `src/loader.js`.

Cada valor marcado **[Guía]** se copia tal cual del HTML. Lo marcado **[Adaptación]** es una propuesta para botones o flujos que la guía no tiene, construida con el mismo lenguaje de movimiento.

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Motor | **GSAP instalado por npm** (`npm i gsap`), importado en Vite. Nada de CDN. |
| Alcance | Entrada de vista, celebración de tarea, mascota y avisos, y ranking animado (FLIP), más la microinteracción de cada botón. |
| Animaciones actuales | **Se reemplazan**: confeti CSS al 4/4, corazones de la mascota y mensajes de ánimo cada 2 tareas (ver §9). |
| Base de código | Rama `interfaz` actualizada con `origin/main`. |

---

## 2. Principios de movimiento

1. **El movimiento confirma lo que guardó la base de datos.** Ninguna celebración se dispara antes de que la RPC responda bien. Esto ya existe hoy con `isTaskCompletionConfirmed`.
2. **Rápido y con rebote solo en los logros.** Las entradas usan `power3.out` y los premios (check, mascota, burbuja) usan `back.out`.
3. **Una sola capa de efectos.** Confeti, chip de XP y burbujas viven en una capa fija (`#fx`) que no se borra cuando `render()` reconstruye el DOM.
4. **Nada bloquea al usuario.** Las animaciones nunca deshabilitan la navegación. Solo el botón pulsado queda en estado "Guardando…" mientras espera.
5. **Accesible por defecto.** Con `prefers-reduced-motion: reduce` todo salta al estado final sin movimiento (ver §8).

---

## 3. Tokens de movimiento

Valores únicos para todo el proyecto. Irán en un módulo nuevo `src/motion.js`.

### 3.1 Duraciones

| Token | Valor | Uso | Origen |
|---|---|---|---|
| `fast` | 0,14–0,18 s | latidos y pulsos (`yoyo`) | [Guía] fila 0,14 s, KPI 0,18 s |
| `short` | 0,25–0,35 s | toast, scrim, burbuja, chip de XP al entrar | [Guía] |
| `base` | 0,5 s | entrada de tarjetas y banner "Todo al día" | [Guía] |
| `medium` | 0,6–0,65 s | check pop, mascota, FLIP | [Guía] |
| `long` | 0,8–1,0 s | barras y contadores | [Guía] |
| `idle` | 1,9 s | flotación de la mascota (ida y vuelta infinita) | [Guía] |

### 3.2 Curvas

| Token | Curva GSAP | Sensación | Uso |
|---|---|---|---|
| `enter` | `power3.out` | llega rápido y frena suave | tarjetas, toast, banner, drawer |
| `fill` | `power2.out` | crecimiento natural | barras, contadores, confeti hacia afuera |
| `fall` | `power1.in` | acelera al caer | confeti cayendo, chip de XP saliendo |
| `reward` | `back.out(3)` | rebote fuerte | check de tarea |
| `pop` | `back.out(2)` – `back.out(2.4)` | rebote medio | chip "+10 XP", burbuja |
| `bounce` | `back.out(1.7)` | rebote suave | entrada de la mascota |
| `float` | `sine.inOut` | respiración | mascota en reposo |
| `swap` | `power3.inOut` | desplazamiento | reordenar el ranking (FLIP) |

### 3.3 Escalonado (stagger)

| Grupo | Stagger | Origen |
|---|---|---|
| Bloques de la vista (`[data-a]`) | 0,07 s | [Guía] |
| Barras (`[data-bar]`) | 0,05 s | [Guía] |
| Tarjetas de la tienda | 0,05 s | [Adaptación] |

### 3.4 Colores del confeti

- **[Guía]:** `#FFC20E` amarillo, `#1F6FE5` azul, `#1FA971` verde, `#6A3DE0` morado y `#F28C1F` naranja.
- El proyecto hoy usa `#0876d1, #19b889, #ffc629, #ff7a35, #55c9f2`. **Se adopta la paleta de la guía.**

---

## 4. Problema técnico a resolver primero

Hoy cada acción llama a `refresh()`, que ejecuta `loadData()` + `render()` y **reconstruye todo el DOM**. Si no se controla, cada refresco repetiría la animación de entrada y los contadores arrancarían siempre desde 0.

Reglas de implementación:

1. **Entrada solo al cambiar de vista.** `enter()` corre en estos casos:
   - el primer `boot()`;
   - un cambio entre Mi tablero y Tienda;
   - un cambio de cliente;
   - el login.

   Después de `refresh()` **no** se repite.
2. **Contadores desde el valor anterior.** Antes de `render()` se guardan los valores de los KPI en memoria (`previousMetrics[label]`). Después del render, cada número cuenta del valor viejo al nuevo, igual que `tween(el, to, {from})` en la guía.
3. **Barras desde el ancho anterior.** Al refrescar, la barra de progreso arranca en el porcentaje previo y crece al nuevo (`gsap.fromTo(width)`). Solo en la entrada de vista crece desde 0 con `scaleX`.
4. **Limpieza.** Antes de cada `render()` se ejecuta `killFx()`: mata los tweens de `#page *` y la flotación de la mascota. Así no quedan animaciones huérfanas sobre nodos que ya no existen.
5. **`clearProps`.** Toda animación de entrada termina con `clearProps:'transform,opacity'` para no dejar estilos en línea que rompan el hover o el tema oscuro.

---

## 5. Catálogo de animaciones base

Estas son las piezas reutilizables. Los botones (§6) se componen con ellas.

### A1 · Entrada escalonada de la vista [Guía]
- **Qué:** cada bloque marcado con `data-a` (encabezado, KPI, tarjetas, ranking, Trompín, tareas).
- **Cómo:** `gsap.from(items, { y: 18, opacity: 0, duration: .5, stagger: .07, ease: 'power3.out', clearProps: 'transform,opacity' })`.
- **Dónde poner `data-a`:**
  - `.page-intro`;
  - cada `.metric`;
  - `.ranking-section`;
  - `.advisor-client-panel`;
  - `.ai-recommendation`;
  - `.tasks-section`;
  - cada `.task`;
  - en admin: `.metrics-dashboard`, cada `.advisor-row` y `.admin-management`;
  - en la tienda: `.shop-heading`, `.shop-collection` y cada `.shop-card`.

### A2 · Barras que crecen [Guía]
- **Qué:** `<progress>` del cliente y cualquier barra con `data-bar`.
- **Cómo (entrada):** `gsap.from(bars, { scaleX: 0, duration: .9, delay: .25, stagger: .05, ease: 'power2.out', clearProps: 'transform' })`, con `transform-origin: 0 50%`.
- **Cómo (actualización):** `gsap.to(bar, { width: nuevo%, duration: .8, ease: 'power2.out' })`.
- **Nota:** `<progress>` nativo no anima bien. Se reemplaza por `div.bar > i`, igual que en la guía, y se conservan `role="progressbar"`, `aria-valuenow`, `aria-valuemin` y `aria-valuemax`.

### A3 · Contadores numéricos [Guía]
- **Qué:** todos los valores de `.metric-value`, los totales del admin, las ventas del ranking y las ventas confirmadas de la tienda.
- **Cómo:** se anima un objeto `{v}` de `from` a `to` en 1 s (entrada) o 0,6–0,8 s (actualización) con `power2.out`. En cada `onUpdate` se escribe el número formateado con `es-CO`, con miles separados por punto.
- **Valores no numéricos** (por ejemplo `#3` o `—`) no se animan: se cambian directo.
- **Montos** (`$1.234.567`) usan prefijo `$` y 0 decimales.

### A4 · Pulso de KPI [Guía]
- **Qué:** el número que acaba de cambiar.
- **Cómo:** `fromTo(el, {scale:1}, {scale:1.18, duration:.18, yoyo:true, repeat:1, ease:'power2.out'})`.
- **En el ranking (FLIP):** escala 1.25 en vez de 1.18.

### A5 · Chip flotante "+N" [Guía]
- **Qué:** una pastilla amarilla (`--yellow`, texto navy) que nace sobre el botón pulsado.
- **Cómo:**
  1. Se crea en `#fx`, centrada horizontalmente sobre el botón (`left = centro - 30px`, `top = borde superior del botón`).
  2. Entra: `{y:0, opacity:0, scale:.7}` → `{y:-46, opacity:1, scale:1}` en 0,35 s con `back.out(2)`.
  3. Sale a los 0,55 s: `{y:-86, opacity:0}` en 0,5 s con `power1.in`, y se elimina.
- **Textos:**
  - "+10 XP" al completar una tarea;
  - "+1 venta" al confirmar una venta [Adaptación].

### A6 · Ráfaga de confeti desde el botón [Guía]
- **Qué:** 26 piezas cuadradas de 9×9 px con radio de 2 px, en la capa `#fx`.
- **Cómo:** cada pieza sale del centro del botón con un ángulo aleatorio en el semicírculo superior (`-π..0`) y una velocidad de 70–180 px.
  1. **Explosión** (desde 0,05 s): `x = cos(a)·v`, `y = sin(a)·v − 24`, rotación aleatoria de ±270°; 0,55 s con `power2.out`.
  2. **Caída** (desde 0,6 s): `y += 110`, `opacity → 0`; 0,7 s con `power1.in`. Luego se elimina.
- **Variante grande [Adaptación]:** para "Confirmar venta" se usan 40 piezas con velocidad de 90–220 px.

### A7 · Toast superior [Guía]
- **Qué:** reemplaza la animación del `#notice` actual. Pasa a ser una pastilla navy fija arriba al centro, con `role="status"`.
- **Cómo:**
  1. Entra: `fromTo({y:-14, opacity:0}, {y:0, opacity:1, duration:.3, ease:'power3.out'})`.
  2. Sale: `to({opacity:0, y:-10, delay:2.6, duration:.3})`.
  3. Antes de mostrar uno nuevo se ejecuta `killTweensOf(toast)`.
- **Errores [Adaptación, aprobado]:** usan fondo `--red-ink` y `role="alert"`, **no se ocultan solos** y se cierran con el siguiente aviso o con un clic.

### A8 · Mascota [Guía]
- **Entrada:** `from({y:26, opacity:0, scale:.88})` en 0,6 s, con delay de 0,5 s y `back.out(1.7)`.
- **Flotación en reposo:** `to({y:-5, rotation:1.4})` en 1,9 s con `yoyo` infinito, `sine.inOut` y delay de 1,2 s. Se guarda en `float` para pausarla.
- **Salto de premio:**
  1. Se pausa `float`.
  2. `fromTo({y:0, scale:1}, {y:-18, scale:1.08, duration:.2, yoyo:true, repeat:1, ease:'power2.out'})`.
  3. Se reanuda `float`.
- **Burbuja:** globo junto a la mascota, con radio `14px 14px 14px 4px` y `transform-origin: 0 100%`.
  - Entra: `fromTo({scale:0, opacity:0}, {scale:1, opacity:1, duration:.35, ease:'back.out(2.4)'})`.
  - Sale después de 1,2 s: `to({scale:.9, opacity:0, duration:.3})`.
- **Textos de la burbuja [Adaptación, aprobados]:** se elige según el progreso del cliente.
  - "¡Excelente trabajo!" a 1/4 (texto de la guía);
  - "¡Vas con todo!" a 2/4;
  - "¡Una más!" a 3/4;
  - "¡Lo lograste!" a 4/4;
  - "¡Venta confirmada!" al confirmar la venta.
- **Skin:** aplica igual con la skin esqueleto (`/skins/skeleton/*`).

### A9 · Reordenar el ranking (FLIP) [Guía]
- **Qué:** las filas `.ranking-row`, identificadas con `data-k = advisor_id`.
- **Cómo:**
  1. **Antes** del `render()` se guarda el `top` de cada fila.
  2. Después del render se calcula `dy = topAnterior − topNuevo`.
  3. Si `dy ≠ 0`: `gsap.from(fila, {y: dy, duration: .65, ease: 'power3.inOut', clearProps: 'transform'})`.
- El número de ventas de la fila que cambió cuenta del valor viejo al nuevo (A3) y pulsa a escala 1.25 (A4).
- Si cambia el puesto 1 → toast "Cambio en el ranking: {nombre} sube al puesto 1" [Guía].

### A10 · Aparición de bloque nuevo [Guía]
- **Qué:** un bloque que aparece tras una acción. Casos:
  - la nota "¡Todo al día!";
  - el aviso de venta (`.sale-notice`);
  - el botón "Confirmar venta";
  - la recomendación de Trompín.
- **Cómo:** `fromTo({y:10, opacity:0}, {y:0, opacity:1, duration:.5, delay:.6, ease:'power3.out'})`. El `delay` de 0,6 s deja terminar primero la celebración.

---

## 6. Botón por botón

### 6.0 Comportamiento común a todos los botones

| Estado | Animación | Origen |
|---|---|---|
| Hover (solo con `hover:hover`) | Cambio de fondo en 160 ms `ease`. Los botones `.primary` y `.task` suben `translateY(-1px)` / `-2px`. | Proyecto actual (se conserva) |
| Presionado (`:active`) | `transform: scale(.98)` en 130 ms con `cubic-bezier(.23,1,.32,1)`. Hoy solo la navegación lo tiene; se extiende a todos los botones. | Proyecto + [Adaptación] |
| Foco de teclado | Contorno amarillo de 3 px con `outline-offset: 2px`, sin animación. | [Guía] `:focus-visible` |
| Cargando | El texto cambia a "Guardando…", "Analizando…" o "Cargando…" y el botón queda `disabled`. Sin spinner. | Proyecto actual |
| Deshabilitado | `opacity:.5` y `cursor:not-allowed`. | [Guía] |
| Área táctil | Mínimo 44 px de alto. | [Guía] |

### 6.1 Asesor — "Completar tarea" ⭐ (animación principal)

Es la celebración completa de la guía (`celebrate()`), adaptada al flujo real.

1. **Clic** → el botón muestra "Guardando…" y queda deshabilitado. Se guardan el rectángulo del botón (origen de los efectos) y los valores actuales de los KPI.
2. **RPC `complete_mvp_task`**. Si falla: el botón vuelve a su estado normal y aparece un toast de error. No hay celebración.
3. **Si responde bien**, se ejecuta un timeline GSAP con este orden:

| t (s) | Elemento | Animación |
|---|---|---|
| 0 | check de la tarea (`.task-status` pasa a "Completada" con ícono ✓) | A-check: `fromTo({scale:.3, rotation:-25}, {scale:1, rotation:0, duration:.6, ease:'back.out(3)'})` |
| 0 | fila `.task` | latido: `scale 1 → 1.02`, 0,14 s, yoyo ×1, `power1.out`; la fila pasa al fondo `--green-soft` |
| 0 | chip "+10 XP" | A5 |
| 0,05 | confeti | A6 (26 piezas desde el botón) |
| 0,1 | KPI "Completadas" y "Por completar" | A3 desde el valor anterior + A4 en "Completadas" |
| 0,1 | mascota | A8 salto |
| 0,25 | burbuja | A8 burbuja con el texto según el progreso |
| 0,25 | barra de progreso del cliente | A2 actualización al nuevo % |
| 0,9 | toast | "Tarea completada." (o el de §6.2 si era la última) |

4. Mientras el timeline corre, un flag `busy` impide disparar otra celebración encima. **[Guía]** usa `S.busy`.
5. El `refresh()` corre **en paralelo**. Como los efectos viven en `#fx`, sobreviven al re-render. La fila y el check se animan sobre el DOM nuevo, después del render.

### 6.2 Asesor — última tarea (4/4)
Igual que §6.1 y además:
- La nota "¡Todo al día!" y el aviso "Las cuatro tareas están completas. Confirma la venta para registrarla." aparecen con A10.
- El botón **"Confirmar venta"** aparece con A10 (delay de 0,6 s) y después hace un **pulso de atención** [Adaptación]: `scale 1 → 1.04`, 0,18 s, yoyo ×1. Ocurre una sola vez, no en bucle.
- **Se elimina** la lluvia de confeti actual a pantalla completa. La celebración grande queda reservada para "Confirmar venta".

### 6.3 Asesor — "Confirmar venta" ⭐ [Adaptación]
Es el logro más importante del flujo, porque el ranking se ordena por ventas.
1. **Clic** → "Guardando…" y deshabilitado.
2. **RPC `confirm_mvp_sale`**. Si hay error → toast de error.
3. **Si responde bien**:

| t (s) | Elemento | Animación |
|---|---|---|
| 0 | chip "+1 venta" | A5 |
| 0,05 | confeti grande | A6 variante grande (40 piezas) |
| 0,1 | mascota | A8 salto + burbuja "¡Venta confirmada!" |
| 0,1 | KPI "Ventas" | A3 + A4 |
| 0,2 | botón | se desvanece (`opacity 0`, `scale .9`, 0,25 s) y se retira |
| 0,3 | ranking | A9 FLIP si cambió el orden; A3 + A4 en las ventas de la fila "tú" |
| 0,9 | toast | "Venta confirmada correctamente." |

### 6.4 Asesor — "Limpiar tareas completadas"
1. Primero se muestra el `confirm()` nativo, como hoy.
2. **Si responde bien** [Adaptación]: las 4 filas `.task` salen en cascada con `to({x:24, opacity:0, height:0, margin:0, padding:0}, {duration:.35, stagger:.06, ease:'power2.in'})`. Después corre el `refresh()`.
3. La barra del cliente baja a 0 con A2.
4. La mascota no salta: no es un logro.
5. Toast "Tareas completadas de {cliente} limpiadas…".

### 6.5 Asesor — "Sugerir siguiente acción" (Trompín)
1. **Clic** → "Analizando…". [Adaptación] Tres puntos laten dentro del botón: cada punto hace `opacity .3 ↔ 1` en 0,6 s con yoyo infinito y stagger de 0,15 s. Se detiene al responder.
2. **Si responde bien:** el párrafo de la recomendación entra con A10 sin delay, y la tarjeta `.ai-recommendation` late una vez (`scale 1.01`, 0,14 s, yoyo).
3. **Si hay error:** toast de error.

### 6.6 Asesor — selector de cliente (`.customer-option`)
- **Clic** → cambia el cliente seleccionado. Solo se anima la parte derecha (`.customer-detail`, ranking y tareas) con A1, con stagger reducido a 0,05 s. La barra lateral de clientes no se re-anima.
- La barra de progreso crece desde 0 (A2) y la mascota hace su entrada (A8) con la imagen del nuevo estado.
- El botón seleccionado cambia de fondo con la transición de 160 ms.

### 6.7 Asesor — navegación "Mi tablero" / "Tienda" (lateral y móvil)
- **Clic** → `killFx()`, `render()` y luego A1 completo para la nueva vista. Después `scrollTo(0,0)` y foco al `h1`, como hoy.
- El ítem activo (`aria-current="page"`) cambia de fondo con 150 ms. **[Guía]** usa el degradado `#2F82F0 → #1F6FE5` en el ítem activo.
- **En la tienda**, A1 se aplica a `.shop-heading`, a la sección Halloween si está activa y a las tarjetas (stagger 0,05 s). El contador "Ventas confirmadas" usa A3 desde 0.

### 6.8 Tienda — "Equipar" (skin)
1. **Clic** → RPC `equip_mvp_skin`.
2. **Si responde bien** [Adaptación]:
   - el botón cambia a "✓ Equipado" con A-check (`scale .3 → 1`, `back.out(3)`, 0,6 s);
   - la tarjeta late (`scale 1.02`, 0,14 s);
   - la tarjeta que antes estaba equipada pierde el borde sin animación;
   - toast "Skin equipada.".
3. **Si hay error:** toast de error.
4. Los botones "Bloqueado" y "Próximamente" no se animan: están deshabilitados.

### 6.9 Tienda — aparición de la sección Halloween
Cuando el administrador activa el modo, la sección `#halloween-collection` puede aparecer en vivo (sincronización cada 10 s). [Adaptación]: se aplica A10 a la sección y A1 a sus dos tarjetas, con stagger de 0,07 s. Al desactivarse: `to({opacity:0, y:-10}, {duration:.3})` y luego `remove()`.

### 6.10 Admin — "Crear cliente y tareas"
1. **Clic** → "Guardando…".
2. **Si responde bien** [Adaptación]:
   - el KPI "Clientes comerciales" usa A3 + A4;
   - el KPI "Tareas pendientes" usa A3 (+4);
   - en la fila del asesor elegido, el nuevo cliente entra con A10 sin delay;
   - el formulario se limpia;
   - toast "Cliente creado con cuatro tareas.".
3. Sin confeti, porque es una acción administrativa.

### 6.11 Admin — "Borrar tareas" / "Borrar clientes" / "Borrar asesor"
1. Se mantiene el `confirm()` nativo.
2. **Si responde bien** [Adaptación]: los elementos que desaparecen salen con `to({opacity:0, x:-16, duration:.3, stagger:.04, ease:'power2.in'})` antes del `refresh()`:
   - "Borrar tareas": la lista de pendientes;
   - "Borrar clientes": los clientes;
   - "Borrar asesor": toda la `.advisor-row`.
3. Los KPI bajan con A3, sin pulso. Las bajas no se celebran.
4. El ranking se reordena con A9.
5. Toast de confirmación.

### 6.12 Admin — "Activar / Desactivar Halloween"
1. **Clic** → "Guardando…".
2. **Si responde bien** [Adaptación]: el botón late (`scale 1.04`, 0,18 s, yoyo) y el texto de estado entra con A10 sin delay.
3. Toast "Modo Halloween activado para todos los asesores.".

### 6.13 Barra superior — tema claro/oscuro
- Sin animación de layout, porque `shell()` + `render()` reconstruyen todo.
- [Adaptación]: un fundido global con `document.documentElement` en `opacity .85 → 1` durante 0,2 s, para que el cambio de colores no sea brusco.
- **No** se repite A1, porque cambiar el tema no es cambiar de vista.

### 6.14 Barra superior — "Cerrar sesión"
- **Si responde bien:** `killFx()` y la vista de login entra con A1. Sin toast.

### 6.15 Login / registro — "Entrar" / "Crear cuenta" / alternar formulario
- **Envío:** "Cargando…". Si hay error, el texto de `.form-error` entra con A10 sin delay. [Adaptación, aprobado] El formulario hace un temblor corto: `x: 0 → -6 → 6 → -4 → 4 → 0` en 0,35 s. Con movimiento reducido no tiembla.
- **Alternar** entre "Crear cuenta de asesor" y "Ya tengo cuenta": el formulario nuevo entra con A1.
- **Login correcto:** el tablero entra con A1 completo, más la mascota (A8) en la vista del asesor.

### 6.16 "Reintentar" (error de carga)
- Al pulsarlo, si la carga funciona, la vista entra con A1 (cuenta como una entrada de vista).

---

## 7. Efectos de la guía que NO aplican todavía

Están en `Copiloto Ultracem.html` pero dependen de datos o pantallas que la app no tiene. Quedan documentados para el futuro:

| Efecto de la guía | Por qué no entra |
|---|---|
| Camino de niveles (relleno + nodos con `back.out(2)` en stagger de 0,12 s) | No hay niveles (Cimiento, Columna, Viga…) en la base. |
| Racha semanal (días que suben con stagger de 0,06 s) | No existe el dato de racha. |
| Drawer de cliente (`x:60 → 0` en 0,4 s + scrim en 0,25 s) | No hay vista de detalle lateral. |
| Sparkline que se dibuja (`strokeDashoffset 1 → 0` en 1 s) | No hay historial de compras. |
| Medidor nacional (pin que se desliza de 0 % a su valor en 1,3 s) | No hay panorama nacional. |
| Sliders de metas con recálculo en 0,4 s | No hay pantalla de metas. |
| `data-tilt` en los KPI | En la guía está declarado pero no tiene manejador; no hay comportamiento que copiar. |

---

## 8. Movimiento reducido y accesibilidad

- Un único flag `anim = !prefersReducedMotion`, como `anim` en la guía. Si es `false`:
  - los contadores escriben el valor final directo;
  - las barras toman su ancho final;
  - no se crean confeti, chip ni flotación;
  - el toast aparece y desaparece **sin desplazamiento**, a los 2,6 s.
- Se escucha el cambio de la media query (`change`) para respetar al usuario sin recargar la página.
- La capa `#fx` lleva `aria-hidden="true"` y `pointer-events:none`.
- El toast usa `role="status"`; los errores, `role="alert"`.
- Ninguna animación mueve el foco ni roba el scroll.
- Ningún bucle infinito salvo la flotación de la mascota, que es sutil (5 px) y se pausa con `document.hidden`.

---

## 9. Qué se elimina del código actual

| Elemento | Ubicación |
|---|---|
| `celebrateCompletion()` (confeti CSS a pantalla completa) | `src/main.js` |
| `releaseMascotHeart()` (corazones) | `src/main.js` |
| `releaseMascotMessage()` (mensajes cada 2 tareas) | `src/main.js` |
| `.confetti-layer`, `.confetti-piece`, `@keyframes confetti-fall` | `src/style.css` |
| `.mascot-heart`, `@keyframes mascot-heart-rise` | `src/style.css` |
| `.mascot-message`, `@keyframes mascot-message-pop` | `src/style.css` |
| `shouldShowEncouragement()` y su test | `src/game.js`, `tests/game.test.js` |

`isTaskCompletionConfirmed()` **se conserva**: sigue siendo la puerta de entrada de las celebraciones.

---

## 10. Estructura de código propuesta

```
src/motion.js     # flag anim, tokens, enter(), tween(), bars(), pulse(), chip(), burst(),
                  # toast(), mascotFloat()/mascotJump()/bubble(), flip(), killFx()
src/motion.css    # .fx-layer, .fx-chip, .fx-confetti, .toast, .bubble, .bar (sin keyframes)
src/main.js       # solo llama a motion.js; añade data-a / data-bar / data-k al DOM
tests/motion.test.js  # lógica pura: formato de números, ángulos del confeti, texto de la burbuja
```

`gsap` se importa solo en `motion.js`. Con eso, `main.js` y `shop.js` no dependen directamente de la librería.

---

## 11. Criterios de aceptación

1. Al entrar al tablero, los bloques aparecen escalonados, las barras crecen y los números cuentan.
2. Al refrescar tras una acción, la entrada **no** se repite y los números cuentan desde su valor anterior.
3. "Completar tarea" produce, en este orden: check, latido, "+10 XP", confeti desde el botón, salto de la mascota con burbuja, barra actualizada y toast. Todo en ≤ 1,5 s.
4. Si la RPC falla, no hay ninguna celebración.
5. "Confirmar venta" produce la celebración grande y, si cambia el orden, el ranking se reordena con FLIP.
6. Con `prefers-reduced-motion: reduce` no hay movimiento y la app funciona igual.
7. Sin errores en consola y sin nodos huérfanos en `#fx` después de 3 s.
8. `npm test` y `npm run build` pasan.
9. Funciona en temas claro y oscuro, en móvil (≤ 860 px) y en escritorio.

---

## 12. Preguntas resueltas (2026-10-21)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Texto del chip al completar una tarea (§A5) | **"+10 XP"**, como en la guía. El XP sigue contando como desempate en el ranking. |
| 2 | Textos de la burbuja de Topitín (§A8) | **Aprobados**: "¡Excelente trabajo!" (1/4), "¡Vas con todo!" (2/4), "¡Una más!" (3/4), "¡Lo lograste!" (4/4), "¡Venta confirmada!" (al confirmar). |
| 3 | Errores en el toast (§A7) | **Fijos hasta cerrar**: fondo rojo; se cierran con un clic o con el siguiente aviso. |
| 4 | Temblor del formulario de login (§6.15) | **Sí se incluye**: 0,35 s, desactivado con movimiento reducido. |

No quedan preguntas abiertas. El documento está listo para implementar.

---

## 13. Excepción aprobada: intro de bienvenida con vuelo falso 3D (2026-10-22)

La guía v1.1 (p. 23) pide animaciones de 400 a 1.200 ms y solo desplazamiento y opacidad. La intro de bienvenida es una **excepción aprobada** por el responsable, con estos límites:

| Paso | Qué pasa | Duración |
|---|---|---|
| Loader | Anillo "U" de Ultracem girando y "ULTRACEM" sobre azul marino mientras cargan los datos (`src/loader.js`) | Mientras carga; sale en 400 ms |
| Fase 1 · Vuelo | La capa frontal (el mismo anillo "U") escala ×5 y se desvanece: la cámara la atraviesa. Las capas media y de fondo se acercan a ×1,1 | 1.200 ms |
| Fase 2 · Mensaje | Letras que caen girando, desenfocadas, con rebote `back.out` | 700 ms por letra, escalonadas |
| Fase 3 · Mascota y tareas | Topitín salta y saluda; el panel "Tareas del día" se desliza y sus filas entran en cascada | ≤ 750 ms cada paso |

- Solo se usa aquí: la bienvenida aparece una vez al día por dispositivo.
- Ningún paso supera 1,2 s.
- Con "reducir movimiento" no hay vuelo ni letras animadas: el loader se quita al instante y la bienvenida aparece completa.
- La capa frontal arranca oculta y solo GSAP la muestra, así que nunca tapa el contenido si no hay animación.

---

## 14. Spec: intro v2 (borrador, pendiente de respuestas)

**Pedido del responsable (2026-10-22):** quitar "Tareas del día" de la bienvenida y dejar solo la animación de inmersión. En lugar del anillo "U" dibujado con CSS en el loader, usar el **logo oficial** de la marca.

**Activo del logo:** `public/ultracem-logo.png` (de `main`), blanco sobre transparente. Pensado para fondo azul marino.

### 14.1 Qué cambia
| Pieza | Hoy (§13) | Intro v2 |
|---|---|---|
| Loader | Anillo "U" con CSS girando + "ULTRACEM" + barra | **Logo oficial** (`<img>` con alt "Ultracem") + barra de progreso; sin anillo CSS |
| Fase 1 · Vuelo | La capa frontal muestra el anillo "U" y se atraviesa (×5) | La capa frontal muestra **el logo oficial** y se atraviesa (×5, 1,2 s) |
| Fase 2 · Mensaje | "¡Hola, {nombre}! Estas son tus tareas de hoy." letra por letra | Texto **por confirmar (P2)**, letra por letra |
| Fase 3 | Topitín + panel "Tareas del día" + botón "Ir a mi tablero" | **Sin panel de tareas.** Topitín y el cierre: **por confirmar (P1, P3)** |

### 14.2 Tests que se escribirían en Red (`tests/welcome.spec.js`, `tests/loader.spec.js`)
- El loader muestra `<img src="/ultracem-logo.png" alt="Ultracem">` y ya no tiene `.loader-ring`.
- La capa frontal (`[data-layer="front"]`) contiene el logo oficial, decorativo (`alt=""`, dentro de `aria-hidden`).
- No existe `[data-testid="welcome-tasks"]` ni `[data-testid="welcome-task"]`.
- Etapas nuevas sin `tasks`: `['intro', 'mascot', 'done']` (o `['intro', 'done']` si se quita Topitín).
- Cierre según P3 (botón, automático, o ambos), sin cambiar "una vez al día" ni Esc.
- Se borran los tests de `getWelcomeTasks` y del panel.

### 14.3 Preguntas abiertas
- **P1.** ¿Topitín sigue apareciendo saludando después del texto, o la inmersión termina en el texto?
- **P2.** ¿Qué dice el texto, ahora que no hay tareas? Propuesta: "¡Hola, {nombre}! Bienvenido a tu tablero."
- **P3.** ¿Cómo pasa al tablero sin el panel? Propuesta: automático al terminar la animación (~1,5 s de pausa), con clic, toque o Esc para saltarla.
- **P4.** ¿El logo también va en la capa frontal del vuelo (se atraviesa el logo), o solo en el loader?

### 14.4 Respuestas (2026-10-22): spec cerrado
- **P1:** Topitín **sí** saluda después del texto, con "¡Bienvenido!".
- **P2:** el texto es **"¡Hola, {nombre}!"**; sin nombre, "¡Hola!".
- **P3:** **automático + saltar.** Al terminar la animación espera 1,5 s y entra el tablero solo. Un clic, un toque o Esc la saltan en cualquier momento. Sin botón.
- **P4:** el logo oficial va **en el loader y en la capa frontal del vuelo**.
- Etapas: `['intro', 'mascot', 'done']`. Se eliminan `getWelcomeTasks`, el panel y el botón "Ir a mi tablero".
