import { describe, expect, it } from 'vitest';
// @ts-expect-error Server JavaScript tested without sending mail.
import { invitationEmailMiddleware } from '../server/invitation-email.mjs';
describe('SMTP endpoint before authentication', () => {
  it('rejects unauthenticated sends without contacting SMTP', async () => {
    let status = 0; let body = '';
    const res = { setHeader() {}, writeHead(code: number) { status = code; }, end(text: string) { body = text; } };
    await invitationEmailMiddleware({})({ url: '/api/invitations/email', method: 'POST', headers: {} }, res);
    expect(status).toBe(401); expect(body).toContain('Inicia sesión');
  });
  it('does not send mail from GET requests or a link preview crawler', async () => {
    let status = 0;
    const res = { setHeader() {}, writeHead(code: number) { status = code; }, end() {} };
    await invitationEmailMiddleware({})({ url: '/api/invitations/email', method: 'GET', headers: {} }, res);
    expect(status).toBe(405);
  });
});
