-- Covering indexes for foreign keys flagged by the Supabase performance advisor.
-- Deletes of clients, requests or profiles no longer scan the referencing tables.
create index if not exists mvp_client_requests_resolved_by_idx
  on public.mvp_client_requests (resolved_by);

create index if not exists mvp_notifications_related_client_id_idx
  on public.mvp_notifications (related_client_id);

create index if not exists mvp_notifications_related_request_id_idx
  on public.mvp_notifications (related_request_id);
