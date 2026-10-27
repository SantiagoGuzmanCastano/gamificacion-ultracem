-- El administrador abre «Solicitud de cliente» desde las notificaciones y la app lee la solicitud
-- (asesor y estado). La tabla tenía RLS sin políticas ni permiso de lectura, así que fallaba siempre.
-- Solo lectura y solo para administradores; los asesores siguen sin acceso directo.
grant select on public.mvp_client_requests to authenticated;

drop policy if exists "client_requests_admin_read" on public.mvp_client_requests;
create policy "client_requests_admin_read" on public.mvp_client_requests
  for select to authenticated
  using ((select app_private.is_admin()));
