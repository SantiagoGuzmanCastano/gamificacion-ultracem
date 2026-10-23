import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
const text = (value: unknown, fallback = '—') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Supabase no está configurado.' }, 500);
  if (!resendKey) return json({ error: 'El correo no está configurado todavía.' }, 503);
  if (!token) return json({ error: 'Sesión requerida.' }, 401);

  try {
    const authClient = createClient(url, anonKey);
    const auth = await authClient.auth.getUser(token);
    if (auth.error || !auth.data.user) return json({ error: 'Sesión inválida.' }, 401);

    const adminClient = createClient(url, serviceKey);
    const body = await request.json();
    const eventId = typeof body?.event_id === 'string' ? body.event_id : '';
    const eventType = body?.event_type === 'client_request' || body?.event_type === 'client_assigned' ? body.event_type : '';
    if (!eventId || !eventType) return json({ error: 'Evento inválido.' }, 400);

    let notifications;
    let assignedClient: { name: string; type: string; city: string; department: string } | null = null;
    if (eventType === 'client_request') {
      const requestResult = await adminClient.from('mvp_client_requests').select('id,advisor_id').eq('id', eventId).eq('advisor_id', auth.data.user.id).single();
      if (requestResult.error) return json({ error: 'Solicitud no encontrada.' }, 404);
      const result = await adminClient.from('mvp_notifications').select('id,recipient_id,title,body').eq('related_request_id', eventId).eq('kind', eventType);
      if (result.error) return json({ error: 'No se pudieron consultar las notificaciones.' }, 500);
      notifications = result.data;
    } else {
      const caller = await adminClient.from('mvp_profiles').select('role').eq('user_id', auth.data.user.id).single();
      if (caller.data?.role !== 'admin') return json({ error: 'Solo un administrador puede notificar una asignación.' }, 403);
      const clientResult = await adminClient.from('mvp_clients').select('name,type,city,department').eq('id', eventId).single();
      if (clientResult.error || !clientResult.data) return json({ error: 'Cliente no encontrado.' }, 404);
      assignedClient = {
        name: text(clientResult.data.name, 'Nuevo cliente'),
        type: text(clientResult.data.type),
        city: text(clientResult.data.city),
        department: text(clientResult.data.department),
      };
      const result = await adminClient.from('mvp_notifications').select('id,recipient_id,title,body').eq('related_client_id', eventId).eq('kind', eventType);
      if (result.error) return json({ error: 'No se pudieron consultar las notificaciones.' }, 500);
      notifications = result.data;
    }

    if (!notifications?.length) return json({ error: 'No hay notificaciones para este evento.' }, 404);
    const from = Deno.env.get('RESEND_FROM') || 'Ultracem <notificaciones@ultracemcrm.com>';
    const appUrl = Deno.env.get('APP_URL') || '#';
    let sent = 0;
    for (const notification of notifications) {
      const recipient = await adminClient.auth.admin.getUserById(notification.recipient_id);
      if (recipient.error) return json({ error: 'No se pudo consultar el destinatario.', sent }, 500);
      const email = recipient.data.user?.email;
      if (!email) return json({ error: 'El destinatario no tiene un correo configurado.', sent }, 422);
      const advisor = await adminClient.from('mvp_profiles').select('full_name').eq('user_id', notification.recipient_id).single();
      const advisorName = text(advisor.data?.full_name, 'asesor');
      const subject = eventType === 'client_assigned' && assignedClient
        ? `🐧 Topitín te trae una nueva misión: ${assignedClient.name}`
        : notification.title;
      const html = eventType === 'client_assigned' && assignedClient
        ? `<div style="font-family:Arial,sans-serif;color:#12304a;line-height:1.6;max-width:560px"><h2 style="color:#0078a8">¡Hola, ${escapeHtml(advisorName)}!</h2><p>Topitín está muy feliz porque tienes una nueva misión comercial.</p><p><strong>Cliente:</strong> ${escapeHtml(assignedClient.name)}<br><strong>Tipo:</strong> ${escapeHtml(assignedClient.type)}<br><strong>Ciudad:</strong> ${escapeHtml(assignedClient.city)}<br><strong>Departamento:</strong> ${escapeHtml(assignedClient.department)}</p><p>Tu primera tarea ya está disponible en Gamificación Ultracem. Entra a la plataforma y comienza tu ruta.</p><p><strong>¡Topitín confía en ti! 💙</strong></p><p><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#ffd124;color:#00243a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Ver mis próximas acciones</a></p></div>`
        : `<h2>${escapeHtml(notification.title)}</h2><p>${escapeHtml(notification.body)}</p><p>Entra a Gamificación Ultracem para continuar.</p>`;
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        // shortcut: Resend deduplicates for 24 hours; durable retries need persisted delivery state.
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `mvp-notification/${notification.id}` },
        body: JSON.stringify({
          from,
          to: [email],
          subject,
          html,
        }),
      });
      const providerResult = await emailResponse.json().catch(() => null);
      if (!emailResponse.ok) {
        const knownCodes = ['validation_error', 'missing_api_key', 'invalid_api_key', 'restricted_api_key', 'rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded'];
        const code = knownCodes.includes(providerResult?.name) ? providerResult.name : 'provider_error';
        const message = typeof providerResult?.message === 'string' ? providerResult.message : '';
        const hint = /domain.*not verified|verify.*domain/i.test(message)
          ? 'Verifica el dominio remitente en Resend.'
          : /api.?key|authentication/i.test(message) || ['missing_api_key', 'invalid_api_key', 'restricted_api_key'].includes(code)
            ? 'Revisa RESEND_API_KEY y sus permisos de envío en Supabase.'
            : /testing emails|own email address/i.test(message)
              ? 'Resend está restringiendo los destinatarios de prueba. Verifica el dominio remitente.'
              : 'Revisa el dominio remitente, los límites y la configuración de Resend.';
        console.error('notification_email_rejected', { status: emailResponse.status, code });
        return json({ error: `No se pudo enviar el correo. ${hint}`, provider_status: emailResponse.status, provider_code: code, sent }, 502);
      }
      if (typeof providerResult?.id !== 'string' || !providerResult.id) return json({ error: 'Resend no confirmó la aceptación del correo.', sent }, 502);
      sent += 1;
    }
    return json({ sent });
  } catch {
    return json({ error: 'No se pudo enviar el correo. Intenta de nuevo más tarde.' }, 500);
  }
});
