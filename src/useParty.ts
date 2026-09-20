import { useCallback, useEffect, useState } from 'react';
import { db, supabase, errorMessage } from './supabase';
import { defaultEvent, EVENT_ID } from './domain';
import type { EventSettings, Details, Profile } from './domain';

export function useParty() {
  const [event, setEvent] = useState<EventSettings>(defaultEvent);
  const [details, setDetails] = useState<Details | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: settings, error: settingsError } = await db().from('event_settings').select('*').eq('id', EVENT_ID).single();
      if (settingsError) throw settingsError;
      setEvent(settings);
      const { data: { session }, error: authError } = await db().auth.getSession();
      if (authError) throw authError;
      if (!session) { setProfile(null); setDetails(null); return; }
      const { data: person, error: personError } = await db().from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
      if (personError) throw personError;
      setProfile(person);
      if (person) {
        const { data, error: detailError } = await db().from('event_details').select('venue,address,map_url').eq('id', EVENT_ID).single();
        if (detailError) throw detailError;
        setDetails(data);
      } else setDetails(null);
      setError('');
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(() => void refresh(), 0); });
    const timer = setInterval(() => void refresh(), 60_000);
    return () => { data.subscription.unsubscribe(); clearInterval(timer); };
  }, [refresh]);
  return { event, details, profile, loading, error, refresh };
}
