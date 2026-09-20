import { createClient } from '@supabase/supabase-js';
import { emailConfig, readInvitationBody } from './invitation-email.mjs';

const API = 'https://api.walletwallet.dev';
export function trustedShareUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['walletwallet.dev', 'www.walletwallet.dev', 'api.walletwallet.dev'].includes(url.hostname)
      && !url.username && !url.password && !url.port && /^\/p\/[^/]+$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
export function passPayload(invitation, event, details, now = Date.now()) {
  const date = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long', year: 'numeric' });
  const time = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false });
  const start = new Date(event.starts_at), end = new Date(event.ends_at);
  return {
    logoText: 'Santiago · Nivel 7', organizationName: 'Cumpleaños de Santiago',
    description: `Invitación personal de ${invitation.recipient_name} al cumpleaños de Santiago`,
    colorPreset: 'blue', sharingProhibited: true,
    primaryFields: [{ label: '¡ESTÁS INVITADO!', value: invitation.recipient_name }],
    headerFields: [{ label: 'NIVEL', value: '7' }],
    secondaryFields: [{ label: 'FIESTA', value: date.format(start) }, { label: 'HORARIO', value: `${time.format(start)}–${time.format(end)}` }],
    backFields: [{ label: 'Lugar', value: details.address }, { label: 'Tu código personal', value: invitation.access_code },
      { label: 'Invitación y recuerdos', value: `https://santiago.teolabs.app/?invite=${invitation.token}` }],
    barcodeValue: `https://santiago.teolabs.app/?invite=${invitation.token}`,
    barcodeFormat: 'QR', barcodeAltText: invitation.access_code,
    expirationDays: Math.max(1, Math.ceil((Date.parse(event.uploads_close_at) - now) / 86400000)),
  };
}

export function illustratedPass(payload, invitation) {
  // WalletWallet requires nonempty logoText. A word joiner leaves only the
  // graphical wordmark visible; description still supplies accessible text.
  return { ...payload, logoText: '\u2060', color: '#071C54',
    wideLogoURL: 'https://santiago.teolabs.app/wallet-wordmark.png',
    stripURL: 'https://santiago.teolabs.app/wallet-sonic-strip.png',
    iconURL: 'https://santiago.teolabs.app/icon-192.png',
    primaryFields: [],
    headerFields: [{ label: 'FIESTA', value: payload.secondaryFields[0].value }],
    secondaryFields: [{ label: 'TU PASE PERSONAL', value: invitation.recipient_name }, payload.secondaryFields[1]],
  };
}

export function walletMiddleware(config = emailConfig(), dependencies = {}) {
  const request = dependencies.fetch ?? fetch;
  const client = () => dependencies.client ?? createClient(config.VITE_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  return async (req, res, next = () => {}) => {
    if (req.url?.split('?')[0] !== '/api/wallet') return next();
    const respond = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(JSON.stringify(body)); };
    const configured = Boolean(config.WALLETWALLET_API_KEY && config.SUPABASE_SERVICE_ROLE_KEY);
    if (req.method === 'GET') return respond(200, { available: configured });
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return respond(405, { error: 'Método no permitido.' }); }
    if (!configured) return respond(503, { error: 'El pase estará disponible pronto.' });
    try {
      const input = await readInvitationBody(req);
      if (!/^[a-f0-9]{64}$/.test(input.token ?? '')) return respond(400, { error: 'Abre tu enlace personal de invitación.' });
      const db = client();
      const invitation = await db.from('invitations').select('id,recipient_name,token,access_code').eq('token', input.token).eq('active', true).maybeSingle();
      if (invitation.error) throw new Error('Database unavailable');
      if (!invitation.data) return respond(404, { error: 'Esta invitación no está disponible.' });
      const id = invitation.data.id;
      const saved = await db.from('wallet_passes').select('status,share_url').eq('invitation_id', id).maybeSingle();
      if (saved.error) throw new Error('Cache unavailable');
      if (saved.data?.status === 'ready' && trustedShareUrl(saved.data.share_url)) return respond(200, { shareUrl: saved.data.share_url });
      if (saved.data) return respond(409, { error: 'Tu pase se está preparando o necesita revisión. Si no aparece en unos minutos, avisa a la organización.' });
      const [event, details] = await Promise.all([
        db.from('event_settings').select('*').eq('id', 'santiago-7').single(),
        db.from('event_details').select('address').eq('id', 'santiago-7').single(),
      ]);
      if (event.error || details.error || !event.data.starts_at || !event.data.ends_at) throw new Error('Missing event');
      if (Date.now() >= Date.parse(event.data.uploads_close_at)) return respond(410, { error: 'La fiesta ya terminó. Puedes seguir visitando los recuerdos.' });
      const payload = passPayload(invitation.data, event.data, details.data);
      // A failed/uncertain request stays locked. Never blindly retry a paid provider operation.
      const claim = await db.from('wallet_passes').insert({ invitation_id: id });
      if (claim.error?.code === '23505') return respond(409, { error: 'Tu pase se está preparando. Espera un momento y vuelve a abrirlo.' });
      if (claim.error) throw new Error('Claim failed');
      const headers = { Authorization: `Bearer ${config.WALLETWALLET_API_KEY}`, 'Content-Type': 'application/json' };
      const usageResponse = await request(`${API}/api/auth/usage`, { headers, signal: AbortSignal.timeout(10000) });
      const usage = usageResponse.ok ? await usageResponse.json() : null;
      if (!usage || !['free', 'trial'].includes(usage.plan) || !(usage.remaining > 0) || !(usage.count < 1000)) {
        await db.from('wallet_passes').update({ status: 'failed' }).eq('invitation_id', id);
        return respond(503, { error: 'No podemos emitir el pase ahora. Avisa a la organización.' });
      }
      const design = usage.plan === 'trial' ? illustratedPass(payload, invitation.data) : payload;
      const response = await request(`${API}/api/passes`, { method: 'POST', headers, body: JSON.stringify(design), signal: AbortSignal.timeout(20000) });
      if (!response.ok) {
        await db.from('wallet_passes').update({ status: 'failed' }).eq('invitation_id', id);
        throw new Error('Issuance failed');
      }
      const pass = await response.json();
      const shareUrl = trustedShareUrl(pass.shareUrl);
      if (!shareUrl || typeof pass.serialNumber !== 'string' || !pass.serialNumber) throw new Error('Invalid provider response');
      const update = await db.from('wallet_passes').update({ status: 'ready', serial_number: pass.serialNumber, share_url: shareUrl }).eq('invitation_id', id);
      if (update.error) throw new Error('Save failed');
      return respond(200, { shareUrl });
    } catch {
      return respond(502, { error: 'No pudimos preparar tu pase. Intenta abrirlo más tarde; si sigue igual, avisa a la organización.' });
    }
  };
}
