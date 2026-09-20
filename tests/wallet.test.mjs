import { describe, it, expect, vi } from 'vitest';
import { passPayload, illustratedPass, trustedShareUrl, walletMiddleware } from '../server/wallet.mjs';

const token = 'a'.repeat(64);
const invitation = { id: 'demo', token, recipient_name: 'Familia Demo', access_code: 'Santiago-Rex-ABCDEFGH' };
const event = { starts_at: '2026-09-26T18:30:00Z', ends_at: '2026-09-26T22:00:00Z', uploads_close_at: '2026-10-04T03:00:00Z' };
function database({ active = true, cached = null, collision = false } = {}) {
  return { from: vi.fn(table => {
    let operation = 'select';
    const chain = { select: () => chain, eq: () => chain, insert: () => { operation = 'insert'; return chain; }, update: () => { operation = 'update'; return chain; },
      maybeSingle: () => Promise.resolve({ data: table === 'invitations' ? active ? invitation : null : cached }),
      single: () => Promise.resolve({ data: table === 'event_settings' ? event : { address: 'Nicaragua 1913, La Serena, Coquimbo' } }),
      then: resolve => resolve({ error: operation === 'insert' && collision ? { code: '23505' } : null }) };
    return chain;
  }) };
}
async function call(options = {}) {
  const request = options.request ?? vi.fn();
  let status, body;
  const res = { writeHead: value => { status = value; }, setHeader: () => {}, end: value => { body = JSON.parse(value); } };
  await walletMiddleware({ WALLETWALLET_API_KEY: 'private-key', SUPABASE_SERVICE_ROLE_KEY: 'private-service' }, { client: database(options), fetch: request })
    ({ url: '/api/wallet', method: 'POST', body: { token: options.token ?? token } }, res);
  return { status, body, request };
}
describe('personal Wallet passes', () => {
  it('uses Chile party time, personalized QR and only free fields', () => {
    const payload = passPayload(invitation, event, { address: 'La Serena' }, Date.parse('2026-09-17T12:00:00Z'));
    expect(payload.secondaryFields[1].value).toBe('15:30–19:00');
    expect(payload.primaryFields[0].value).toBe('Familia Demo');
    expect(payload.barcodeValue).toContain(token);
    expect(payload.expirationDays).toBe(17);
    expect(payload.colorPreset).toBe('blue');
    expect(payload.wideLogoURL).toBeUndefined();
    expect(Object.keys(payload).sort()).toEqual(['logoText','organizationName','description','colorPreset','sharingProhibited','primaryFields','headerFields','secondaryFields','backFields','barcodeValue','barcodeFormat','barcodeAltText','expirationDays'].sort());
  });
  it('keeps the guest name below the image in the illustrated pass', () => {
    const payload = illustratedPass(passPayload(invitation,event,{address:'La Serena'}),invitation);
    expect(payload.primaryFields).toEqual([]);
    expect(payload.secondaryFields[0].value).toBe('Familia Demo');
    expect(payload.stripURL).toContain('wallet-sonic-strip.png');
    expect(payload.wideLogoURL).toContain('wallet-wordmark.png');
  });
  it('rejects external or unsafe install links', () => {
    expect(trustedShareUrl('https://api.walletwallet.dev/p/demo')).toBeTruthy();
    for (const value of ['javascript:alert(1)', 'https://api.walletwallet.dev.evil.com/p/a', 'https://secret@api.walletwallet.dev/p/a']) expect(trustedShareUrl(value)).toBeNull();
  });
  it('rejects malformed and revoked invitations before contacting the provider', async () => {
    for (const options of [{ token: 'bad' }, { active: false }]) {
      const result = await call(options);
      expect([400,404]).toContain(result.status); expect(result.request).not.toHaveBeenCalled();
    }
  });
  it('reuses saved passes without another provider request', async () => {
    const result = await call({ cached: { status: 'ready', share_url: 'https://api.walletwallet.dev/p/demo' } });
    expect(result.status).toBe(200); expect(result.request).not.toHaveBeenCalled();
  });
  it('does not reissue uncertain or concurrent passes', async () => {
    for (const options of [{ cached: { status: 'pending' } }, { collision: true }]) {
      const result = await call(options); expect(result.status).toBe(409); expect(result.request).not.toHaveBeenCalled();
    }
  });
  it('refuses quota overflow even during a large trial', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plan: 'trial', count: 1000, remaining: 99000 }) });
    const result = await call({ request }); expect(result.status).toBe(503); expect(request).toHaveBeenCalledTimes(1);
  });
  it('returns only an install link, never provider credentials or pass contents', async () => {
    const request = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ plan: 'free', count: 1, remaining: 999 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ serialNumber: 'demo', shareUrl: 'https://api.walletwallet.dev/p/demo', applePass: 'private-binary' }) });
    const result = await call({ request }); expect(result.body).toEqual({ shareUrl: 'https://api.walletwallet.dev/p/demo' });
  });
});
