revoke all on schema app_private from public, anon;
revoke all on function app_private.is_admin() from public, anon;
revoke all on function app_private.is_advisor(uuid) from public, anon;
revoke all on function app_private.handle_new_mvp_user() from public, anon, authenticated;
revoke all on function app_private.create_mvp_tasks() from public, anon, authenticated;
