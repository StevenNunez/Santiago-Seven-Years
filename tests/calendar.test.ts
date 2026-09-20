import { describe, expect, it } from 'vitest';
import { googleCalendarUrl } from '../src/calendar';
import { defaultEvent } from '../src/domain';

describe('Google Calendar invitation', () => {
  it('preserves the party hours in Chile and the complete address', () => {
    const url = new URL(googleCalendarUrl(defaultEvent, { venue: 'Cumpleaños', address: 'Nicaragua 1913, La Serena, Coquimbo', map_url: '' }));
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20260926T183000Z/20260926T220000Z');
    expect(url.searchParams.get('ctz')).toBe('America/Santiago');
    expect(url.searchParams.get('location')).toBe('Nicaragua 1913, La Serena, Coquimbo');
    expect(url.searchParams.get('details')).toContain('https://santiago.teolabs.app');
    expect(url.href).not.toContain('invite');
  });
  it('does not disclose a private address to visitors without invitation details', () => {
    const url = new URL(googleCalendarUrl({ ...defaultEvent, starts_at: null, ends_at: null }, null));
    expect(url.searchParams.get('dates')).toBe('20260926/20260927');
    expect(url.searchParams.get('location')).toBe('Revisa el lugar en tu invitación');
    expect(url.href).not.toContain('Nicaragua');
  });
});
