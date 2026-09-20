import { useEffect, useState } from 'react';
import { db, errorMessage } from './supabase';
import type { GuestInvitation } from './invitations';

export function useInvitation() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('invite');
  const preview = params.get('preview') === '1';
  const [invitation, setInvitation] = useState<GuestInvitation | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function resolve() {
      try {
        if (!/^[a-f0-9]{64}$/.test(token!)) throw new Error('Este enlace de invitación no es válido. Pide uno nuevo a la organización.');
        const { data, error } = await db().rpc('resolve_invitation_entry', { invite_token: token });
        if (error) throw error;
        if (!data?.[0]) throw new Error('Esta invitación ya no está disponible. Pide un nuevo enlace a la organización.');
        if (!cancelled) { setInvitation(data[0]); setError(''); }
      } catch (e) { if (!cancelled) { setError(errorMessage(e)); setInvitation(null); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [token, revision]);
  return { token, preview, invitation, loading, error, refresh: () => setRevision(v => v + 1) };
}
