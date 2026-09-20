import { describe, expect, it } from 'vitest';
import { defaultEvent, safeHttps, uploadState, validateRsvp } from '../src/domain';

describe('Chilean birthday upload window', () => {
  it('opens testing without moving the party dates and still honors pause', () => {
    const testing={ ...defaultEvent, album_test_mode:true };
    expect(uploadState(testing,Date.parse('2026-09-17T12:00:00Z'))).toBe('open');
    expect(uploadState({ ...testing, uploads_enabled:false })).toBe('closed');
    expect(uploadState({ ...testing, album_test_mode:false },Date.parse('2026-09-17T12:00:00Z'))).toBe('soon');
  });
  it('opens at midnight on the party day, not on the birthday', () => {
    expect(uploadState(defaultEvent, Date.parse('2026-09-26T02:59:59Z'))).toBe('soon');
    expect(uploadState(defaultEvent, Date.parse('2026-09-26T03:00:00Z'))).toBe('open');
  });
  it('allows late photos throughout October 3, then closes at midnight', () => {
    expect(uploadState(defaultEvent, Date.parse('2026-10-04T02:59:59Z'))).toBe('open');
    expect(uploadState(defaultEvent, Date.parse('2026-10-04T03:00:00Z'))).toBe('closed');
  });
  it('honors an organizer pause', () => {
    expect(uploadState({ ...defaultEvent, uploads_enabled: false }, Date.parse('2026-09-27T15:00:00Z'))).toBe('closed');
  });
});
describe('family responses', () => {
  const valid = { user_id: 'id', family_name: 'Familia Pérez', attending: true, adults: 2, children: 1, note: '' };
  it('requires an accompanying adult and integer guest counts', () => {
    expect(validateRsvp(valid)).toBeNull();
    expect(validateRsvp({ ...valid, adults: 0 })).not.toBeNull();
    expect(validateRsvp({ ...valid, children: 1.5 })).not.toBeNull();
    expect(validateRsvp({ ...valid, children: 21 })).not.toBeNull();
  });
  it('allows a family to decline without attendees', () => {
    expect(validateRsvp({ ...valid, attending: false, adults: 0, children: 0 })).toBeNull();
  });
});
describe('external links', () => {
  it('accepts HTTPS and rejects script and insecure URLs', () => {
    expect(safeHttps('https://maps.google.com')).toBe('https://maps.google.com/');
    expect(safeHttps('javascript:alert(1)')).toBeNull();
    expect(safeHttps('http://example.com')).toBeNull();
    expect(safeHttps('')).toBeNull();
  });
});
