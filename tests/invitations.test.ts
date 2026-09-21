import { describe, expect, it } from 'vitest';
import { formatGuestCode, groupInvitations, invitationMessage, invitationStatus, invitationStorageKey, invitationUrl, normalizePhone, peopleSummary, whatsappUrl } from '../src/invitations';
import type { InvitationRsvp } from '../src/invitations';

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

describe('invitation status grouping', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const rsvps: InvitationRsvp[] = [
    { invitation_id: 'a', family_name: 'A', attending: true, adults: 2, children: 1, note: 'Llevamos torta' },
    { invitation_id: 'b', family_name: 'B', attending: false, adults: 0, children: 0, note: '' },
    { invitation_id: null, family_name: 'Legacy', attending: true, adults: 1, children: 3, note: '' },
  ];
  it('splits invitations into pending, confirmed and declined and keeps legacy responses apart', () => {
    const groups = groupInvitations(rows, rsvps);
    expect(groups.confirmed.map(r => r.id)).toEqual(['a']);
    expect(groups.declined.map(r => r.id)).toEqual(['b']);
    expect(groups.pending.map(r => r.id)).toEqual(['c', 'd']);
    expect(groups.confirmed[0].rsvp?.note).toBe('Llevamos torta');
    expect(groups.orphans.map(r => r.family_name)).toEqual(['Legacy']);
  });
  it('counts only attending families in the totals, including legacy responses', () => {
    expect(groupInvitations(rows, rsvps).totals).toEqual({ families: 2, adults: 3, children: 4 });
  });
  it('drops a deleted invitation from every group once its rows are gone', () => {
    const after = groupInvitations(rows.filter(r => r.id !== 'a'), rsvps.filter(r => r.invitation_id !== 'a'));
    expect(after.confirmed).toEqual([]);
    expect(after.totals).toEqual({ families: 1, adults: 1, children: 3 });
  });
  it('describes people in natural Spanish', () => {
    expect(invitationStatus(null)).toBe('pending');
    expect(peopleSummary({ invitation_id: 'a', family_name: 'A', attending: true, adults: 1, children: 1, note: '' })).toBe('1 adulto · 1 niño');
    expect(peopleSummary({ invitation_id: 'a', family_name: 'A', attending: true, adults: 2, children: 0, note: '' })).toBe('2 adultos · 0 niños');
  });
});
