import { createClient } from '@supabase/supabase-js';
import { invitationStorageKey } from './invitations';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Each personal link has its own guest session. Opening one while logged in as
// organizer can never turn an organizer's session into a guest or reveal admin UI.
const storageKey = invitationStorageKey(window.location.search);
export const supabase = url && key ? createClient(url, key, storageKey ? {
  auth: { storageKey, detectSessionInUrl: false },
} : undefined) : null;
export function db() {
  if (!supabase) throw new Error('La invitación todavía está en preparación. Pronto podrás confirmar y compartir recuerdos.');
  return supabase;
}
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message);
    if (/schema cache|Anonymous sign-ins are disabled/i.test(message)) return 'Estamos preparando el acceso a la fiesta. Vuelve a intentarlo pronto.';
    if (/Failed to fetch|fetch failed|NetworkError/i.test(message)) return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
    if (/Invalid login credentials/i.test(message)) return 'El correo o la contraseña no son correctos.';
    if (/row-level security|permission denied/i.test(message)) return 'No tienes acceso a esta acción o el plazo para publicar terminó.';
    return message;
  }
  return 'Algo no salió bien. Inténtalo de nuevo.';
}
