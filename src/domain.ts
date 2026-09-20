export const EVENT_ID = 'santiago-7';
export type EventSettings = {
  id: string; starts_at: string | null; ends_at: string | null;
  uploads_open_at: string; uploads_close_at: string; uploads_enabled: boolean; album_test_mode?: boolean;
};
export const defaultEvent: EventSettings = {
  id: EVENT_ID, starts_at: '2026-09-26T15:30:00-03:00', ends_at: '2026-09-26T19:00:00-03:00',
  uploads_open_at: '2026-09-26T00:00:00-03:00',
  uploads_close_at: '2026-10-04T00:00:00-03:00', uploads_enabled: true,
};
export type Profile = { user_id: string; display_name: string; role: 'guest' | 'admin'; invitation_id?: string | null; album_verified?: boolean };
export type Details = { venue: string; address: string; map_url: string };
export type Rsvp = { user_id: string; family_name: string; attending: boolean; adults: number; children: number; note: string };
export type Photo = { id: string; user_id: string; storage_path: string; caption: string; created_at: string; profiles: { display_name: string }; url?: string };
export type Comment = { id: string; user_id: string; photo_id: string; body: string; created_at: string; profiles: { display_name: string } };
export type Like = { user_id: string; photo_id: string };
export function uploadState(event: EventSettings, now = Date.now()): 'open' | 'soon' | 'closed' {
  if (!event.uploads_enabled) return 'closed';
  if (event.album_test_mode) return 'open';
  if (now < Date.parse(event.uploads_open_at)) return 'soon';
  return now < Date.parse(event.uploads_close_at) ? 'open' : 'closed';
}
export function validateRsvp(value: Rsvp): string | null {
  if (value.family_name.trim().length < 2 || value.family_name.trim().length > 80) return 'Escribe el nombre de tu familia (2 a 80 caracteres).';
  if (value.attending && (!Number.isInteger(value.adults) || value.adults < 1 || value.adults > 20 || !Number.isInteger(value.children) || value.children < 0 || value.children > 20)) return 'Indica entre 1 y 20 adultos y entre 0 y 20 niños.';
  if (value.note.length > 500) return 'El mensaje puede tener hasta 500 caracteres.';
  return null;
}
export function niceDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', timeZone: 'America/Santiago' }).format(new Date(value));
}
export function niceTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Santiago' }).format(new Date(value));
}
export function safeHttps(value: string | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
