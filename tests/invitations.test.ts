import { describe, expect, it } from 'vitest';
import { formatGuestCode, invitationMessage, invitationStorageKey, invitationUrl, normalizePhone, whatsappUrl } from '../src/invitations';

describe('personal invitation sharing', () => {
  it('keeps themed words intact and still groups legacy hexadecimal codes', () => {
    expect(formatGuestCode('Santiago-Creeper-K7M4P9X2')).toBe('Santiago-Creeper-K7M4P9X2');
    expect(formatGuestCode('1234567890ABCDEF1234')).toBe('1234-5678-90AB-CDEF-1234');
  });
  const token = 'a'.repeat(64);
  it('isolates personal links from the organizer session, including malformed links', () => {
    expect(invitationStorageKey('')).toBeUndefined();
    expect(invitationStorageKey('?preview=1')).toBeUndefined();
    expect(invitationStorageKey('?invite=bad')).toBe('santiago-invitation-invalid');
    expect(invitationStorageKey(`?invite=${token}`)).toBe(`santiago-invitation-${token}`);
    expect(invitationStorageKey(`?invite=${token}`)).not.toBe(invitationStorageKey(`?invite=${'b'.repeat(64)}`));
  });
  it('shares a clean personalized public URL without preview or admin route', () => {
    const link = invitationUrl(token, 'https://santiago.teolabs.app/?preview=1#organizar');
    expect(link).toBe(`https://santiago.teolabs.app/?invite=${token}`);
    expect(new URL(link).hash).toBe('');
  });
  it('previews locally without changing the shared link', () => {
    const link = new URL(invitationUrl(token, 'http://127.0.0.1:5173', true));
    expect(link.searchParams.get('preview')).toBe('1');
    expect(link.searchParams.get('invite')).toBe(token);
    expect(link.origin).toBe('http://127.0.0.1:5173');
  });
  it('encodes name and link in a WhatsApp draft', () => {
    const link = invitationUrl(token, 'https://santiago.teolabs.app');
    const message = invitationMessage('María & familia', link);
    const url = new URL(whatsappUrl('+56 (9) 1234-5678', message));
    expect(url.pathname).toBe('/56912345678');
    expect(url.searchParams.get('text')).toBe(message);
    expect(message).toContain('María & familia');
    expect(message).toContain(link);
  });
  it('allows choosing a contact in WhatsApp and rejects invalid numbers', () => {
    expect(whatsappUrl('', 'Hola')).toBe('https://wa.me/?text=Hola');
    expect(normalizePhone('+56 9 1234 5678')).toBe('56912345678');
    expect(() => whatsappUrl('abc', 'Hola')).toThrow();
  });
});
