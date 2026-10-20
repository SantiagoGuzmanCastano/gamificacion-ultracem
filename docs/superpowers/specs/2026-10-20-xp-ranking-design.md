# Diseño: XP y ranking de asesores

## Objetivo

Mostrar la contribución de cada asesor mediante XP y un ranking calculado a partir de las tareas completadas que todavía existen en Supabase.

## Alcance aprobado

- Cada tarea completada equivale a 10 XP.
- El ranking se ordena por XP descendente y usa el nombre del asesor.
- El administrador puede ver el ranking global.
- El asesor puede ver su posición y el ranking disponible.
- Completar una tarea aumenta el resultado porque cambia `mvp_tasks.completed_at`.
- Borrar una tarea elimina sus XP del cálculo.
- Borrar un cliente elimina sus tareas por cascada y elimina también los XP de ese cliente.
- Los XP de otros clientes del mismo asesor se mantienen.

## Modelo de datos

No se agrega una tabla. `mvp_profiles` identifica al asesor, `mvp_clients` relaciona clientes con asesores y `mvp_tasks.completed_at` determina si una tarea aporta XP.

Se agregará una función RPC protegida para agrupar tareas completadas por asesor. La función devolverá solo nombre, XP, tareas completadas y posición; no expondrá datos de clientes.

## Interfaz

El panel del administrador mostrará XP y ranking junto a sus métricas actuales. El panel del asesor mostrará su XP, su posición y la lista de ranking. Los estados sin asesores, sin tareas, carga y error conservarán mensajes claros.

## Seguridad y consistencia

La base de datos será la fuente del ranking. La función solo estará disponible para usuarios autenticados y el frontend no podrá editar XP directamente. Como el cálculo depende de tareas existentes, las eliminaciones cumplen automáticamente la regla de conservar únicamente los puntos de clientes no eliminados.

## Validación

- Comprobar el ranking con tareas completadas y pendientes.
- Comprobar que una tarea borrada resta 10 XP.
- Comprobar que borrar un cliente solo resta los XP de ese cliente.
- Ejecutar `npm test` y `npm run build`.
