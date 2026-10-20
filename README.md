# Gamificación Ultracem

MVP de seguimiento comercial con tres recorridos conectados a Supabase:

1. Un asesor crea su cuenta e inicia sesión. El administrador y el asesor ven paneles distintos según su rol real.
2. El administrador crea un cliente comercial, lo asigna a un asesor y la base crea cuatro tareas.
3. El asesor ve únicamente sus clientes, completa tareas y su progreso aparece también en el panel del administrador.
4. El administrador puede borrar todas las tareas de un asesor. La acción elimina las tareas actuales, incluidas las completadas, y deja sus clientes sin tareas.
5. El administrador puede borrar todos los clientes asignados a un asesor. Sus tareas se eliminan automáticamente junto con ellos.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+ y npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Sustituye `VITE_SUPABASE_PUBLISHABLE_KEY` por la clave **publishable** del proyecto. `.env.local` está excluido de Git. El URL y la clave publishable son públicos por diseño; nunca uses una clave secreta o `service_role` en Vite.

La migración en [supabase/migrations/20261020000000_mvp_core.sql](supabase/migrations/20261020000000_mvp_core.sql) crea las tablas `mvp_*` y sus políticas RLS. No modifica las tablas anteriores. Las cuentas nuevas se registran como asesores. Para activar al primer administrador, este debe registrarse y confirmar el correo; después ejecuta en el SQL Editor de Supabase:

```sql
update public.mvp_profiles
set role = 'admin'
where user_id = (
  select id from auth.users
  where email = '<correo-del-administrador>'
    and email_confirmed_at is not null
);
```

Confirma que el resultado actualizó una fila. Cierra sesión y vuelve a entrar para cargar el panel administrador. No se pide ni se guarda la contraseña fuera de Supabase Auth.

## Comprobación

```bash
npm test
npm run build
```

El administrador necesita al menos un asesor registrado para crear clientes. Las tareas son una simulación comercial; no verifican ventas reales. Las imágenes de mascota son opcionales y sus rutas se configuran en `src/mascot.js`.

Esta rama no despliega la aplicación. El plan inicial se conserva en `PLAN-MVP-ESTATICO.md`.
