import type { Details, EventSettings } from './domain';

export function googleCalendarUrl(event: EventSettings, details: Details | null) {
  const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const url = new URL('https://calendar.google.com/calendar/r/eventedit');
  const dates = event.starts_at && event.ends_at
    ? `${stamp(event.starts_at)}/${stamp(event.ends_at)}`
    : '20260926/20260927';
  url.search = new URLSearchParams({
    action: 'TEMPLATE', text: '¡Santiago cumple 7! Fiesta de cumpleaños', dates,
    ctz: 'America/Santiago', stz: 'America/Santiago', etz: 'America/Santiago',
    location: details?.address || 'Revisa el lugar en tu invitación',
    // Never include a private invitation token in an external calendar URL.
    details: '¡Una aventura a toda velocidad! Celebremos el nivel 7 de Santiago. Invitación y recuerdos: https://santiago.teolabs.app',
  }).toString();
  return url.href;
}
