import { describe, expect, it } from 'vitest';
// @ts-expect-error Server JavaScript is exercised at runtime.
import { createInvitationEmail } from '../server/email-template.mjs';

describe('personal invitation email', () => {
  it('escapes guest content and includes the same bearer link in HTML and text', () => {
    const email = createInvitationEmail({ recipient_name: '<img src=x> & María', token: 'a'.repeat(64) }, { starts_at: '2026-09-26T18:30:00Z', ends_at: '2026-09-26T22:00:00Z' }, { address: 'Nicaragua 1913, La Serena' }, 'https://santiago.teolabs.app');
    expect(email.html).not.toContain('<img src=x>');
    expect(email.html).toContain('&lt;img src=x&gt; &amp; María');
    expect(email.text).toContain('15:30 a 19:00');
    expect(email.html).toContain('https://santiago.teolabs.app/?invite=' + 'a'.repeat(64));
    expect(email.text).toContain('https://santiago.teolabs.app/?invite=' + 'a'.repeat(64));
  });
  it('rejects non-HTTPS public invitation origins', () => {
    expect(() => createInvitationEmail({}, {}, {}, 'javascript:alert(1)')).toThrow();
  });
});
