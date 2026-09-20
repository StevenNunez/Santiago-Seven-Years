export type Invitation = { id: string; recipient_name: string; email: string; phone: string; token: string; active: boolean; created_at: string; email_sent_at: string | null; access_code?: string; checked_in_at?: string | null };
export type GuestInvitation = { id: string; recipient_name: string; venue: string; address: string; map_url: string; access_code?: string; attending?: boolean | null };
export function formatGuestCode(code: string) { return /^[0-9a-f]{20}$/i.test(code) ? code.match(/.{1,4}/g)!.join('-') : code; }
export function invitationStorageKey(search: string): string | undefined {
  const token = new URLSearchParams(search).get('invite');
  if (token === null) return undefined;
  return `santiago-invitation-${/^[a-f0-9]{64}$/.test(token) ? token : 'invalid'}`;
}
export function invitationUrl(token: string, origin: string, preview = false) {
  const url = new URL('/', origin);
  url.searchParams.set('invite', token);
  if (preview) url.searchParams.set('preview', '1');
  return url.href;
}
export function invitationMessage(name: string, link: string) {
  return `¡Hola, ${name}! 💙\n\n¡Santiago llega al nivel 7 y quiere celebrarlo contigo! 🎉\n\nTe esperamos el sábado 26 de septiembre. Abre tu invitación para ver el lugar, el horario y confirmar tu asistencia:\n${link}\n\n¡Prepárate para una aventura a toda velocidad! 🦔💨`;
}
export function normalizePhone(value: string) { return value.replace(/[\s()+-]/g, ''); }
export function whatsappUrl(phone: string, message: string) {
  const digits = normalizePhone(phone);
  if (digits && !/^[1-9]\d{7,14}$/.test(digits)) throw new Error('Usa el número completo con código de país; por ejemplo +56912345678.');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
