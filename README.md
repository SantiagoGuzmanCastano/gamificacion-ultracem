# Demo de gamificación Ultracem

Prototipo estático en español con dos vistas. Administrador crea asesores, registra clientes comerciales y los asigna a un asesor. Cada cliente recibe cuatro tareas ficticias. Asesor consulta sus clientes y simula la finalización de sus tareas.

## Ejecutar

Requiere Node.js 20.19+ dentro de la versión 20, o 22.12+ (se verificó con Node.js 24.15.0), y npm.

```bash
npm ci
npm run dev
```

Abre la URL que imprime Vite. Para verificar y preparar la versión estática:

```bash
npm test
npm run build
npm run preview
```

El build se genera en `dist/`. `npm run preview` permite revisar ese build localmente; no se usa como servidor de producción.

## Probar el recorrido

1. En Administrador, crea los asesores Ana y Luis. Registra dos negocios ficticios, por ejemplo una ferretería para Ana y una constructora para Luis.
2. Pulsa **Cambiar a Asesor** en la barra superior. Elige a Ana y un cliente de su cartera. Completa tareas y observa el progreso de ese cliente.
3. Selecciona a Luis: el cliente y las tareas de Ana permanecen independientes. Regresa a Administrador para ver los pendientes agrupados por asesor. Recarga para comprobar la persistencia.
4. Reiniciar demo pide confirmación. Cancelar conserva todo; aceptar elimina únicamente la clave de esta aplicación.

| Tareas completadas | Progreso | Estado |
| --- | --- | --- |
| 0/4 y 1/4 | 0 % y 25 % | Triste |
| 2/4 | 50 % | Neutral |
| 3/4 | 75 % | Feliz |
| 4/4 | 100 % | Muy feliz |

## Datos y límites

Se utiliza la clave `ultracem-gamificacion-demo-v1` de localStorage. Su formato actual es la versión 2, con asesores y clientes comerciales separados. Los datos de la primera versión se migran conservando las tareas; cada participante anterior pasa a ser asesor y sus tareas se vinculan a un cliente rotulado «Cliente anterior de …». El progreso y estado de mascota se calculan desde las tareas de cada cliente. Los datos permanecen únicamente en ese navegador y origen: cambiar de dispositivo, puerto o URL de despliegue crea un almacenamiento distinto.

Si el contenido guardado es inválido, aparece un aviso y la demo inicia vacía. Si guardar falla, la interacción continúa y un aviso indica que los cambios no se conservarán al recargar. Usa nombres ficticios.

Cambiar de vista simula roles; no ofrece autenticación ni seguridad de acceso. No hay backend, servicios de datos, IA, CRM, puntos, rankings ni ventas verificadas.

## Incorporar la mascota

No se incluyen imágenes. Cuando estén disponibles, crea `public/mascota/`, añade los SVG o PNG entregados y actualiza `src/mascot.js`:

```javascript
export const mascotImages = {
  sad: '/mascota/triste.svg',
  neutral: '/mascota/neutral.svg',
  happy: '/mascota/feliz.svg',
  energetic: '/mascota/muy-feliz.svg',
};
```

Esas rutas son ejemplos: configúralas únicamente cuando existan los archivos. Los valores iniciales son `null`. Si una imagen falla, se muestra «Mascota pendiente» y se conserva la etiqueta del estado actual.

## Vercel

La configuración está en `vercel.json`: framework Vite, raíz `.`, build `npm run build`, salida `dist`. No requiere variables de entorno ni secretos.

Con una cuenta de Vercel conectada, importa el repositorio o ejecuta desde esta carpeta:

```bash
npx vercel
```

La publicación y su URL deben verificarse en la cuenta de destino. No hay un despliegue registrado todavía.

## Verificación realizada

- Siete pruebas con `node:test`: asignación por cliente, IDs únicos, independencia, idempotencia, porcentajes, estados, migración, validación de referencias, fallos de almacenamiento y reinicio selectivo.
- `npm run build`: correcto con Vite 8.3.4.
- Navegador Chromium: creación de dos asesores y dos clientes asignados, cambio de vista desde la barra superior, avance de tareas, aislamiento entre asesores y persistencia al recargar.
- Revisión visual actualizada a 1440 × 1000 y 375 × 812; sin desbordamiento horizontal ni errores de ejecución JavaScript.
- Revisión estática de código: sin hallazgos importantes.

El plan inicial se conserva en `PLAN-MVP-ESTATICO.md` como registro de la primera versión. Esta rama incorpora la separación posterior entre asesores y clientes comerciales.
