# Decisiones del MVP

Este documento registra las decisiones que cambiaron el alcance o la implementación de Gamificación Ultracem.

## Decisión 1: separar administrador y asesor

**Propuesta de la persona usuaria:** agregar un botón para cambiar entre administrador y usuario, pero mostrar dos páginas visualmente distintas.

**Propuesta de ChatGPT:** mantener una sola URL, con una vista administrativa para pendientes y clientes, y una vista comercial para el trabajo de los asesores.

**Decisión elegida:** usar dos vistas completamente diferentes dentro de la misma URL. El rol real se obtiene desde la sesión de Supabase; no se simula con un selector de rol.

**Conclusión:** el administrador ve la operación general y el asesor ve únicamente su cartera de clientes.

## Decisión 2: usar autenticación y no un cambio de rol simulado

**Propuesta de la persona usuaria:** que existieran usuarios administrador y asesor, con una autenticación sencilla.

**Propuesta de ChatGPT:** usar Supabase Auth y guardar el rol en un perfil relacionado con `auth.users`.

**Decisión elegida:** usar registro e inicio de sesión con Supabase Auth. Las cuentas nuevas se registran como asesores y la primera cuenta administradora se activa desde Supabase.

**Conclusión:** la vista y los permisos dependen de una sesión real, no de un botón que cualquiera pueda cambiar.

## Decisión 3: conectar las funcionalidades a Supabase

**Propuesta de la persona usuaria:** conectar las funcionalidades con la base de datos, manteniéndolas sencillas.

**Propuesta de ChatGPT:** crear tablas nuevas para el MVP, con políticas RLS y sin reutilizar automáticamente el modelo antiguo.

**Decisión elegida:** usar `mvp_profiles`, `mvp_clients` y `mvp_tasks`, además de `auth.users`.

**Conclusión:** usuarios, clientes y tareas persisten en Supabase y tienen políticas de acceso. Las tablas antiguas quedaron fuera del flujo actual.

## Decisión 4: conservar o borrar las tablas antiguas

**Propuesta de la persona usuaria:** revisar si las tablas antiguas (`clients`, `goals`, `profiles` y `sales`) servían o debían eliminarse.

**Propuesta de ChatGPT:** ignorarlas inicialmente para no romper datos ni relaciones mientras se construía el MVP nuevo.

**Decisión elegida:** conservarlas intactas durante el desarrollo y dejar de usarlas. Después se confirmó que estaban vacías y se indicó cómo borrarlas manualmente.

**Conclusión:** el MVP actual no depende de esas tablas; las tablas activas son las que empiezan por `mvp_`.

## Decisión 5: escoger las tres funcionalidades principales

**Propuesta de la persona usuaria:** una funcionalidad debía ser la gestión de usuarios administrador y asesor, y se necesitaban al menos tres.

**Propuesta de ChatGPT:** completar el MVP con autenticación, creación y asignación de clientes comerciales, y tareas con progreso para el asesor.

**Decisión elegida:** implementar esos tres recorridos de punta a punta.

**Conclusión:** el administrador crea clientes y los asigna; el asesor consulta sus clientes, completa tareas y el administrador ve el estado general.

## Decisión 6: diferenciar asesor de cliente comercial

**Propuesta de la persona usuaria:** aclarar que el usuario operativo no es un cliente, sino un asesor; los clientes son negocios como ferreterías y constructoras.

**Propuesta de ChatGPT:** separar las entidades `advisor` y `client` tanto en la interfaz como en los datos.

**Decisión elegida:** usar “asesor” para la cuenta de trabajo y “cliente comercial” para el negocio asignado.

**Conclusión:** cada cliente comercial pertenece a un asesor y sus tareas se muestran dentro de esa relación.

## Decisión 7: crear tareas sencillas automáticamente

**Propuesta de la persona usuaria:** mantener las funcionalidades super sencillas, pero conectadas a la base de datos.

**Propuesta de ChatGPT:** crear cuatro tareas básicas automáticamente cuando el administrador registra un cliente.

**Decisión elegida:** una función de base de datos crea cuatro tareas pendientes por cliente.

**Conclusión:** el administrador no tiene que crear tareas una por una y el asesor puede empezar a trabajar inmediatamente.

## Decisión 8: borrar tareas sin recrearlas

**Propuesta de la persona usuaria:** agregar un botón de administrador que borre todas las tareas de un usuario, incluso las completadas.

**Propuesta inicial de ChatGPT:** interpretar la acción como un reinicio: borrar las tareas y crear cuatro nuevas pendientes.

**Corrección de la persona usuaria:** al probarlo, señaló que seguían apareciendo pendientes porque se habían creado nuevas tareas.

**Decisión elegida:** el botón ahora elimina todas las tareas del asesor y no crea reemplazos. Los clientes permanecen registrados y quedan con cero tareas.

**Conclusión:** el comportamiento coincide con “borrar todas”, con confirmación antes de ejecutar la acción.

## Decisión 9: trabajar con ramas y PRs

**Propuesta de la persona usuaria:** proteger `main`, trabajar en ramas y usar nombres como `feat` y `fix`, sin referencias a Codex.

**Propuesta de ChatGPT:** separar cada cambio funcional en una rama con prefijos convencionales y revisarlo mediante un PR.

**Decisión elegida:** usar ramas como `feat/advisor-dashboards` y `feat/admin-reset-tasks`, con commits descriptivos y PRs hacia `main`.

**Conclusión:** `main` queda reservado para cambios revisados y las funcionalidades se entregan de forma independiente.

## Decisión 10: priorizar lógica antes que decoración

**Propuesta de la persona usuaria:** resolver primero las funcionalidades y dejar para después la decoración y las mejoras visuales.

**Propuesta de ChatGPT:** completar primero los recorridos de datos, autenticación, permisos y persistencia; después pulir la interfaz.

**Decisión elegida:** terminar la lógica del MVP antes de hacer una renovación visual.

**Conclusión:** la siguiente etapa puede enfocarse en identidad de marca, componentes visuales y experiencia de usuario sin cambiar la base funcional.

## Decisión 11: no desplegar todavía

**Propuesta de la persona usuaria:** trabajar localmente y no desplegar mientras se siguen haciendo cambios.

**Propuesta de ChatGPT:** dejar el despliegue para después de validar el flujo con cuentas reales y cerrar la revisión del PR.

**Decisión elegida:** mantener la aplicación en local por ahora.

**Conclusión:** antes del despliegue faltan validar el recorrido completo con cuentas reales y definir la versión visual final.

## Decisión 12: separar el borrado de tareas del borrado de clientes

**Propuesta de la persona usuaria:** agregar una opción para borrar los clientes de un asesor y sus tareas.

**Propuesta de ChatGPT:** separar la acción en dos botones: uno para borrar solo tareas y otro para borrar clientes, evitando que una limpieza de tareas elimine negocios por accidente.

**Decisión elegida:** mantener **Borrar tareas** como acción independiente y agregar **Borrar clientes**. El segundo elimina los clientes asignados al asesor y sus tareas relacionadas.

**Conclusión:** el administrador puede limpiar tareas sin perder clientes, o eliminar explícitamente clientes y sus tareas cuando ya no deben existir.

## Decisión 13: XP y ranking sencillo

**Propuesta de la persona usuaria:** dar XP por cada tarea completada y mostrar un ranking de asesores. Si se elimina un cliente, también deben desaparecer los puntos ganados con sus tareas; los puntos de otros clientes se conservan.

**Propuesta de ChatGPT:** calcular el XP desde las tareas completadas y consultar un ranking agregado desde Supabase, sin crear un sistema complejo de historial.

**Decisión elegida:** cada tarea completada vale 10 XP. El ranking se calcula en una función segura de Supabase contando las tareas actuales por asesor. Borrar tareas o clientes elimina sus registros y por eso sus puntos dejan de contar automáticamente.

**Conclusión:** el XP siempre refleja el estado real de las tareas en la base de datos, tanto para el asesor como para el administrador.

## Decisión 14: administrar cuentas de asesores

**Propuesta de la persona usuaria:** mostrar el correo de cada asesor y permitir que el administrador borre una cuenta desde su panel.

**Propuesta de ChatGPT:** resolverlo con funciones protegidas de Supabase que eliminen primero sus clientes y tareas y después la cuenta de autenticación.

**Decisión elegida:** añadir el correo bajo cada nombre y un botón separado **Borrar asesor**, con confirmación. El borrado también elimina clientes, tareas y XP asociado.

**Conclusión:** el administrador puede retirar una cuenta completa desde una acción explícita y consistente.

## Decisión 15: registrar una venta simulada al completar una misión

**Propuesta de la persona usuaria:** tratar las cuatro tareas de cada cliente como una misión comercial y registrar métricas cuando el asesor complete las cuatro.

**Propuesta de ChatGPT:** guardar una venta simulada única por cliente y calcular las métricas del administrador a partir de esos registros.

**Decisión elegida:** crear `mvp_sales`. Una función de Supabase registra un valor aleatorio una sola vez al completar la cuarta tarea. El administrador consulta misiones y valor acumulado en su panel.

**Conclusión:** las métricas permanecen después de recargar y se eliminan junto con el cliente, sin introducir un módulo de ventas real.

## Decisión 16: limpiar tareas sin perder métricas

**Propuesta de la persona usuaria:** permitir que el asesor borre las tareas una vez terminada la misión, conservando las métricas.

**Propuesta de ChatGPT:** separar las tareas operativas de la venta simulada y borrar solo las tareas completadas mediante una función protegida.

**Decisión elegida:** mostrar **Limpiar tareas completadas** al llegar a 4/4. La venta en `mvp_sales` permanece guardada y solo se eliminan las cuatro tareas.

**Conclusión:** el asesor puede dejar lista su cartera para nuevas tareas sin alterar el historial de métricas.

## Decisión 17: recomendación de IA mínima

**Propuesta de la persona usuaria:** añadir una IA muy sencilla usando Gemini u OpenRouter.

**Propuesta de ChatGPT:** ofrecer un botón de siguiente acción que envíe solo el resumen del cliente a una Edge Function, con OpenRouter como proveedor principal y Gemini como respaldo.

**Decisión elegida:** la clave queda fuera del frontend y la función devuelve una recomendación de máximo 25 palabras. La integración se puede activar configurando secretos sin cambiar la interfaz.

**Conclusión:** el MVP tiene una demostración de IA acotada y segura, sin construir todavía un sistema de recomendaciones avanzado.

## Decisión 18: vista del administrador según el PRD (A1–A5)

**Propuesta de la persona usuaria:** alinear el panel del administrador con el PRD (oportunidad nacional, avance por asesor, brecha por zona y municipio, definir metas), con una UI responsiva y "lo justo y necesario".

**Propuesta de Claude:** el documento `docs/plans/2026-10-23-admin-prd.md` sugería Tabulator y ECharts; se descartaron para no sumar dependencias. Tablas HTML que en celular pasan a tarjetas, barras y medidor en CSS, y metas editadas con inputs en la fila.

**Decisión elegida:** el admin usa el mismo armazón y sidebar que el asesor, sin tienda de cosméticos, con Resumen (A4), Asesores (A1 + A5), Zonas (A2 + A3) y Gestión (lo que ya existía). Asesores, clientes, ventas y ciudades salen de Supabase; solo el mercado por departamento sale de `zone-market.json` (el mismo del mapa del asesor, objetivo 10 %), porque la base no lo tiene. Las metas se guardan en `mvp_advisor_goals` con la función solo-admin `set_mvp_advisor_goal`; el asesor ve su meta (`mercado × participación`, 100 t por defecto). Lo que la base no registra (clientes recuperados) se muestra "s/d".

El admin también tiene **Mapa de ventas**: el mismo mapa del asesor con los clientes y ventas de todos, todo el país desbloqueado y una estrella por departamento con el cliente potencial más importante y su contacto (`prospects.json`, empresas y teléfonos ficticios de muestra).

**Conclusión:** los tres pasos de la demo del admin funcionan con los datos reales de la app, y la vista del asesor solo cambia en la meta mensual.
