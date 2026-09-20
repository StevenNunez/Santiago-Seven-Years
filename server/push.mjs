import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { allowedEndpoint, reminderFor } from './reminders.mjs';

export function authorizedCron(header, secret) {
  if (!secret || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function pushHandler(req, res, test = false) {
  const config = process.env;
  const reply = (status, data) => { res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(data); };
  if (req.method !== (test ? 'POST' : 'GET')) return reply(405, { error: 'Método no permitido.' });
  if (!test && !authorizedCron(req.headers.authorization, config.CRON_SECRET)) return reply(401, { error: 'No autorizado.' });
  try {
    const service = createClient(config.VITE_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    let target = null, message;
    if (test) {
      const jwt = req.headers.authorization?.replace(/^Bearer /, '');
      if (!jwt) return reply(401, { error: 'Entra con tu invitación.' });
      const { data, error } = await service.auth.getUser(jwt);
      if (error || !data.user) return reply(401, { error: 'Vuelve a entrar con tu invitación.' });
      const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!/^[a-f0-9-]{36}$/i.test(input?.subscriptionId ?? '')) return reply(400, { error: 'Selecciona este teléfono.' });
      const owned = await service.from('push_subscriptions').select('id').eq('id', input.subscriptionId).eq('user_id', data.user.id).maybeSingle();
      if (owned.error || !owned.data) return reply(403, { error: 'Activa los avisos en este teléfono primero.' });
      target = owned.data.id;
      message = { key: `test-${Math.floor(Date.now() / 60000)}`, title: '¡Tu teléfono está listo! 💙', body: 'Así recibirás los recordatorios del cumpleaños de Santiago. ¡Nos vemos en la fiesta!' };
    } else {
      const event = await service.from('event_settings').select('starts_at').eq('id', 'santiago-7').single();
      if (event.error) throw event.error;
      message = reminderFor(new Date(), event.data.starts_at);
      if (!message) return reply(200, { ok: true, scheduled: false, sent: 0 });
    }
    if (!config.VITE_VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return reply(503, { error: 'Estamos preparando los avisos.' });
    const claimed = await service.rpc('claim_push_batch', { reminder: message.key, target });
    if (claimed.error) throw claimed.error;
    if (test && !claimed.data.length) return reply(429, { error: 'Espera un minuto para repetir la prueba.' });
    let sent = 0, failed = 0;
    const queue = [...claimed.data];
    await Promise.all(Array.from({ length: Math.min(10, queue.length) }, async () => {
      while (queue.length) {
        const subscription = queue.shift();
        try {
          if (!allowedEndpoint(subscription.endpoint)) throw new Error('Invalid provider');
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), {
            vapidDetails: { subject: config.VAPID_SUBJECT || 'https://santiago.teolabs.app', publicKey: config.VITE_VAPID_PUBLIC_KEY, privateKey: config.VAPID_PRIVATE_KEY },
            TTL: 60 * 60 * 12, urgency: 'normal', topic: message.key, timeout: 8000,
          });
          const recorded = await service.from('push_deliveries').update({ status: 'sent' }).eq('subscription_id', subscription.id).eq('reminder_key', message.key);
          if (recorded.error) throw recorded.error;
          sent++;
        } catch (error) {
          failed++;
          if (error?.statusCode === 410 || error?.statusCode === 404) await service.from('push_subscriptions').delete().eq('id', subscription.id);
          else await service.from('push_deliveries').update({ status: 'failed' }).eq('subscription_id', subscription.id).eq('reminder_key', message.key);
        }
      }
    }));
    return reply(test && !sent ? 502 : 200, { ok: failed === 0, sent, failed, ...(test && !sent ? { error: 'No pudimos entregar el aviso. Desactiva y activa los recordatorios para renovar el permiso.' } : {}) });
  } catch { return reply(503, { error: 'No pudimos preparar la notificación. Inténtalo nuevamente.' }); }
}
