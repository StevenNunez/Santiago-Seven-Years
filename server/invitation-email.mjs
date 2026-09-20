import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { createInvitationEmail } from './email-template.mjs';

export function emailConfig() {
  return { ...(existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {}), ...process.env };
}
export function smtpTransport(config) {
  if (!config.EMAIL_HOST || !config.EMAIL_USER || !config.EMAIL_PASS) throw new Error('El envío por correo todavía no está configurado.');
  const port = Number(config.EMAIL_PORT || 587);
  return nodemailer.createTransport({ host: config.EMAIL_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: config.EMAIL_USER, pass: config.EMAIL_PASS }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}

export function invitationEmailMiddleware(config = emailConfig()) {
  return async (req, res, next = () => {}) => {
    if (req.url?.split('?')[0] !== '/api/invitations/email') return next();
    function respond(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return respond(405, { error: 'Método no permitido.' }); }
    const bearer = req.headers.authorization;
    if (!bearer?.startsWith('Bearer ')) return respond(401, { error: 'Inicia sesión en el panel.' });
    try {
      const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: bearer } } };
      const client = createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_PUBLISHABLE_KEY, options);
      const { data: { user }, error: userError } = await client.auth.getUser(bearer.slice(7));
      if (userError || !user) return respond(401, { error: 'La sesión venció. Vuelve a entrar al panel.' });
      const admin = await client.rpc('is_admin');
      if (admin.error || admin.data !== true) return respond(403, { error: 'Solo la organización puede enviar invitaciones.' });
      // Vercel parses JSON bodies; the local Node/Vite server supplies a stream.
      let input;
      try { input = await readInvitationBody(req); } catch (error) { return respond(error.status ?? 400, { error: error.status === 413 ? 'Solicitud demasiado grande.' : 'Solicitud no válida.' }); }
      if (!/^[a-f0-9-]{36}$/.test(input.invitationId ?? '')) return respond(400, { error: 'Selecciona una invitación válida.' });
      if (!config.SUPABASE_SERVICE_ROLE_KEY) return respond(503, { error: 'El servicio de correo todavía no está configurado.' });
      const transport = smtpTransport(config);
      const [schedule, details] = await Promise.all([
        client.from('event_settings').select('*').eq('id', 'santiago-7').single(),
        client.from('event_details').select('*').eq('id', 'santiago-7').single(),
      ]);
      if (schedule.error || details.error) return respond(503, { error: 'No pudimos obtener los datos de la fiesta.' });
      const claim = await client.rpc('claim_invitation_email', { invitation: input.invitationId });
      if (claim.error) return respond(503, { error: 'No pudimos preparar el correo.' });
      const invitation = claim.data?.[0];
      if (!invitation) return respond(409, { error: 'Revisa que la invitación esté activa y tenga correo. Si acabas de enviarla, espera un minuto antes de repetir.' });
      const origin = config.PUBLIC_SITE_URL || config.VITE_PUBLIC_SITE_URL || 'https://santiago.teolabs.app';
      const message = createInvitationEmail(invitation, schedule.data, details.data, origin);
      const imageFile = existsSync('public/share.jpg') ? 'public/share.jpg' : 'dist/share.jpg';
      const result = await transport.sendMail({
        from: { name: 'Santiago · Nivel 7', address: config.EMAIL_FROM || config.EMAIL_USER },
        to: { name: invitation.recipient_name, address: invitation.email },
        ...message, attachments: [{ filename: 'santiago.jpg', content: readFileSync(imageFile), contentType: 'image/jpeg', cid: 'santiago-level7' }],
      });
      if (!result.accepted?.length) return respond(502, { error: 'El servidor de correo no aceptó al destinatario. Revisa su dirección.' });
      const service = createClient(config.VITE_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const updated = await service.from('invitations').update({ email_sent_at: new Date().toISOString() }).eq('id', invitation.id);
      return respond(200, { ok: true, recorded: !updated.error });
    } catch (error) {
      // Never return SMTP configuration, credentials or raw transport errors.
      const unavailable = error?.code === 'EAUTH';
      return respond(502, { error: unavailable ? 'El servidor rechazó las credenciales del correo. Revisa la configuración SMTP.' : 'No pudimos completar el envío. Si no aparece como enviado, revisa el correo del destinatario antes de volver a intentar.' });
    }
  };
}

export async function readInvitationBody(req) {
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  else { raw = ''; for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 2048) throw Object.assign(new Error('Body too large'), { status: 413 }); } }
  if (!raw || Buffer.byteLength(raw) > 2048) throw Object.assign(new Error('Invalid body'), { status: raw ? 413 : 400 });
  const input = JSON.parse(raw);
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Invalid body');
  return input;
}
