export function reminderFor(now = new Date(), startsAt = '2026-09-26T15:30:00-03:00') {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const partyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(startsAt));
  const messages = {
    '2026-09-20': ['¡Faltan 5 días!', 'En 5 días Santiago cumple 7. ¡Prepara tus ganas de celebrar!'],
    '2026-09-22': ['¡Faltan 3 días!', 'Santiago está a punto de llegar al nivel 7. ¡Nos vemos en su fiesta!'],
    '2026-09-24': ['¡Mañana es su cumpleaños!', 'Mañana Santiago cumple 7. ¡Ya falta poquito para celebrar juntos!'],
    '2026-09-25': ['¡Hoy Santiago cumple 7!', '¡Feliz cumpleaños, Santiago! La pandilla ya está lista para celebrar.'],
  };
  if (date === partyDate) messages[date] = ['¡Hoy es la fiesta de Santiago!', `Te esperamos a las ${new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(startsAt))}. Cuando llegues, abre tu invitación y pulsa «¡Ya llegué a la fiesta!».`];
  const message = messages[date];
  if (date === '2026-09-25' && partyDate === '2026-09-26') message[1] = '¡Feliz cumpleaños, Santiago! Mañana celebramos juntos. ¡Prepara tus ganas de jugar!';
  return message ? { key: `birthday-${date}`, title: message[0], body: message[1] } : null;
}

export function allowedEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname.endsWith('.push.apple.com'));
  } catch { return false; }
}
