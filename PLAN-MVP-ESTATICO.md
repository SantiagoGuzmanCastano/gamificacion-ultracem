# Plan sencillo · demo estática de gamificación Ultracem

## Instrucción para la nueva sesión

Crear un proyecto nuevo e independiente en la carpeta de trabajo de la nueva sesión. Este documento contiene todos los requisitos necesarios: no depende de otro repositorio, conversación, archivo de configuración ni planificación. Implementar directamente en la raíz del proyecto.

Objetivo: demostrar crear participante -> asignar tareas -> cambiar de vista -> completar tareas -> actualizar progreso y estado de mascota. Interfaz genérica en español; marca, colores definitivos y archivos de mascota se entregarán después.

## Stack definido

- Vite con plantilla vanilla para desarrollo y generación de archivos estáticos.
- JavaScript con módulos ES, HTML y CSS; sin React ni TypeScript.
- localStorage para persistir clientes/tareas en ese navegador y origen.
- Node.js compatible con Vite y npm para herramientas; node:test para pruebas de lógica.
- Vercel para publicar los archivos estáticos.

Sin servidor de aplicación, endpoints, base de datos, autenticación real ni API de IA. localStorage no sincroniza dispositivos ni distintas URLs de despliegue.

Scripts esperados: npm run dev, npm run build, npm run preview y npm test. El build genera dist/. Versionar package-lock.json e ignorar node_modules/ y dist/.

## Fuente y recorte

Contexto comercial: Ultracem busca acompañar a su equipo comercial con acciones concretas para recuperar clientes, captar nuevos y atender municipios sin compra. El catálogo ficticio incluido más abajo basta para desarrollar esta demo; no es necesario tener acceso al PDF.

Referencia opcional: PRD Reto Ultracem MVP.pdf, v2 del 19/10/2026, páginas 2, 3 y 6–8. Si se adjunta, usarlo solo como contexto comercial y no ampliar el alcance definido aquí.

El PRD describe administrador/vendedor. Por petición del usuario las pestañas serán Administrador y Cliente; aquí Cliente es el participante de la simulación que realiza las acciones comerciales. No modelar además empresas, asesores y compradores como entidades diferentes.

Este prototipo NO implementa todo el PRD: sin KPI de participación, ventas/metas, IA, CRM, rankings, puntos, rachas, niveles ni mapa. La motivación se representa solo mediante progreso y estado de mascota. No presentar tareas aleatorias como recomendaciones de IA ni su finalización como prueba de una venta.

## Flujo obligatorio

1. Administrador: formulario de nombre -> Crear cliente. Rechazar nombre vacío o solo espacios.
2. Crear identificador único y asignar exactamente cuatro tareas distintas elegidas al azar del catálogo local. Guardar cliente y tareas juntos. No reasignar ni sortear al recargar o cambiar pestaña.
3. Admin muestra clientes y permite seleccionar uno para consultar sus tareas y estados.
4. Cambiar a Cliente; mantener el cliente seleccionado y permitir elegir otro. Sin clientes, mostrar una indicación para crearlo desde Admin.
5. Arriba: nombre, completadas/total, porcentaje, barra de progreso y espacio reservado para mascota.
6. Abajo: título, explicación, motivo y estado de cada tarea. Botón Completar tarea únicamente para pendientes.
7. Completar actualiza estado, guarda, recalcula progreso/estado de mascota y actualiza ambas vistas sin recargar. Pulsar repetidamente no produce efectos adicionales.
8. Reiniciar demo pide confirmación, borra solo la clave de esta aplicación y vuelve al estado inicial vacío.

Cambiar pestaña simula roles: no ofrece seguridad real. No pedir correo, contraseña, documentos ni datos personales reales.

## Datos y reglas

Guardar bajo la clave ultracem-gamificacion-demo-v1:

- version: 1.
- clients: lista de {id, name, tasks}.
- Cada tarea: {id, templateId, title, description, reason, completed}. IDs de instancia únicos; guardar una copia del contenido asignado.

Selección de pestaña/cliente puede ser estado de interfaz; persistir al menos clientes y tareas. No guardar porcentajes o estados de mascota: siempre derivarlos de las tareas.

Progreso = completadas / total × 100. Si total=0, devolver 0. Mostrar porcentaje redondeado, pero clasificar usando el valor sin redondear:

| Porcentaje real | Clave de estado | Etiqueta |
|---|---|---|
| 0 a 25 inclusive | sad | Triste |
| Mayor que 25 hasta 50 | neutral | Neutral |
| Mayor que 50 hasta 75 | happy | Feliz |
| Mayor que 75 hasta 100 | energetic | Muy feliz |

Así no quedan huecos para decimales como 25.5 %. Las cuatro tareas tienen el mismo peso; no agregar puntos ni prioridades.

localStorage: validar formato al leer. Si falta o está corrupto, iniciar vacío con aviso legible; si guardar falla, informar que los cambios no se conservarán, sin romper la interacción. No usar localStorage.clear(). Nombres introducidos se muestran como texto, sin interpretar HTML.

## Catálogo ficticio inicial

Cada entrada tiene título, acción concreta y motivo. Ejemplos propuestos a partir del PRD, no instrucciones literales ni recomendaciones basadas en datos reales:

| Título | Qué hacer en la simulación | Motivo |
|---|---|---|
| Recuperar un cliente inactivo | Simular una llamada a un distribuidor que dejó de comprar y preguntar por qué. | Recuperar compradores. |
| Contactar un prospecto | Simular el primer contacto con una ferretería potencial y registrar interés. | Buscar clientes nuevos. |
| Preparar una visita | Definir objetivo y preguntas para una visita comercial ficticia. | Convertir seguimiento en una acción concreta. |
| Dar seguimiento a una cotización | Simular una llamada para conocer si una cotización pendiente sigue vigente. | Acompañar oportunidades abiertas. |
| Explorar un municipio sin compra | Identificar un distribuidor ficticio de una localidad sin cobertura. | Ampliar cobertura comercial. |
| Revisar un cliente con caída | Revisar un caso ficticio de menor compra y proponer una llamada. | Detectar oportunidades de recuperación. |
| Revisar el pedido promedio | Comparar dos pedidos ficticios y preparar preguntas sobre necesidades del cliente. | Explorar crecimiento del pedido. |
| Actualizar el seguimiento | Escribir qué acción comercial realizar después de una conversación ficticia. | Mantener continuidad comercial. |

No construir formularios extra ni evidencias para esas actividades: Completar tarea simula su realización. Mostrar Datos de demostración y Cumplimiento simulado.

## Mascota pendiente

No generar ni elegir mascota, emojis, logos o ilustraciones. Reservar un contenedor estable con texto Mascota pendiente y la etiqueta del estado actual. El estado debe cambiar aunque todavía no haya imagen.

Archivo de configuración único con claves sad, neutral, happy y energetic, inicialmente con valor null. Cuando el equipo entregue SVG/PNG, apuntar cada clave al archivo correspondiente en public/mascota/. No referenciar imágenes inexistentes. Si una imagen falla, volver al espacio reservado; incluir texto alternativo. El cambio de estado depende solo del porcentaje, no de nombres de archivos ni animaciones.

## Organización mínima

En la raíz del proyecto: index.html, package.json, lockfile, src/main.js (interfaz), src/style.css, src/catalog.js (plantillas), src/game.js (asignación/finalización/progreso), src/storage.js, src/mascot.js (mapa de imágenes) y tests/game.test.js. Crear public/mascota/ cuando existan archivos reales. No añadir arquitectura genérica ni rutas de servidor.

## Tasks de implementación

- [ ] 1. Base y lógica: preparar Vite, catálogo y modelo; probar asignación de cuatro tareas únicas, independencia entre clientes, finalización idempotente y límites de porcentaje/estado con node:test.
- [ ] 2. Flujo Admin: crear/listar/seleccionar clientes y ver sus tareas. Guardar/recuperar estado con localStorage y manejar datos corruptos/errores de almacenamiento.
- [ ] 3. Flujo Cliente: selector, tareas, botón Completar, contador/barra y contenedor de mascota sin imagen; reflejar cambios en Admin.
- [ ] 4. Verificación y entrega: reiniciar con confirmación, probar recorrido en navegador y pantalla pequeña, ejecutar tests/build, documentar ejecución y desplegar en Vercel cuando corresponda.

Actualizar estos checkboxes con evidencia. Si el proyecto usa Git, hacer un commit por task terminada en una rama de trabajo y revisar antes de integrar en main. No es necesario dividir en subagentes ni crear más documentos de arquitectura.

## Criterios de aceptación

- [ ] Desde vacío, crear Ana y Luis; cada uno recibe cuatro tareas distintas, todas pendientes.
- [ ] Completar tareas de Ana deja intactas las de Luis y persiste tras recargar.
- [ ] Con cuatro tareas: 0/4 y 1/4 -> sad; 2/4 -> neutral; 3/4 -> happy; 4/4 -> energetic.
- [ ] Repetir una finalización no cambia el total; cero tareas no genera NaN.
- [ ] Admin y Cliente muestran el mismo estado; no se necesita iniciar sesión.
- [ ] Sin imágenes se ve un espacio reservado; después basta configurar rutas SVG/PNG.
- [ ] Reiniciar elimina solo los datos de esta demo; sin confirmación no borra nada.
- [ ] Tests y build pasan; no hay peticiones a servicios de datos, IA o API propia ni secretos en el bundle.
- [ ] Vercel: directorio raíz del proyecto (.), build npm run build, salida dist. Comprobar la URL publicada; si se usa Git, registrar el commit desplegado.

## Prompt para iniciar

Lee PLAN-MVP-ESTATICO.md y crea este proyecto nuevo e independiente en la raíz de la carpeta de trabajo. Usa Vite vanilla con JavaScript, HTML, CSS y localStorage. Prioriza el flujo funcional, la lógica y la persistencia local. Interfaz sencilla y genérica; no inventes marca ni mascota: deja su espacio y configuración para SVG/PNG futuros. Implementa las cuatro tasks, marca avances y verifica tests, build y recorrido en navegador. Este Markdown es suficiente; el PRD, si se adjunta, es solo contexto comercial.
