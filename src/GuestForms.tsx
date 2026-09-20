import { useEffect, useState } from 'react';
import './confirmation.css';
import type { FormEvent } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';
import { db, errorMessage, supabase } from './supabase';
import { validateRsvp } from './domain';
import type { Profile, Rsvp } from './domain';
import type { GuestInvitation } from './invitations';

export function GuestGate({ onJoined }: { onJoined: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError('');
    try {
      const client = db(); const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) { const { error } = await client.auth.signInAnonymously(); if (error) throw error; }
      const { data, error } = await client.rpc('resolve_guest_code', { guest_code: String(form.get('code')).trim() });
      if (error) throw error;
      if (!data) throw new Error('Revisa el código de tu invitación y vuelve a intentarlo en unos segundos.');
      try { sessionStorage.setItem('santiago-album-code-' + String(data), String(form.get('code')).trim()); } catch { /* The code can be entered again if session storage is unavailable. */ }
      void onJoined; window.location.assign('/?invite=' + encodeURIComponent(String(data)) + '#recuerdos');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="gate card"><span className="round-icon"><KeyRound size={24} /></span><h3>¡Eres parte de la aventura!</h3><p>Escribe tu código personal para encontrar tu invitación y entrar al álbum. Si tienes el enlace, ábrelo para confirmar sin código.</p><form onSubmit={submit}>
    <label>Código de la invitación<input name="code" required maxLength={64} autoComplete="off" autoCapitalize="characters" placeholder="Santiago-Rex-…" /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!supabase && <p className="form-note">Estamos preparando la invitación. El acceso se habilitará pronto.</p>}
    <button className="button button-blue" disabled={busy || !supabase}>{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}Entrar a la fiesta</button>
  </form><small>Solo los invitados pueden ver las fotos y la dirección.</small></div>;
}

export function RsvpForm({ profile, invitation, token, preview = false, onJoined, onResponse }: { profile: Profile | null; invitation?: GuestInvitation | null; token?: string | null; preview?: boolean; onJoined?: () => Promise<void>; onResponse?: (attending: boolean) => void }) {
  const [value, setValue] = useState<Rsvp>({ user_id: profile?.user_id ?? '', family_name: invitation?.recipient_name ?? profile?.display_name ?? 'Invitado de ejemplo', attending: true, adults: 1, children: 1, note: '' });
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(Boolean(profile) && !preview); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const [previewNotice, setPreviewNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [answered, setAnswered] = useState<boolean | null>(null);
  useEffect(() => {
    if (!profile || preview) return;
    void db().rpc('get_my_rsvp').maybeSingle().then(({ data, error }) => {
      if (error) setError(errorMessage(error)); else if (data) { setValue(data as Rsvp); setSaved(true); setAnswered((data as Rsvp).attending); onResponse?.((data as Rsvp).attending); }
      setLoading(false);
    });
  }, [profile?.user_id, preview]);
  function change(patch: Partial<Rsvp>) { setValue(v => ({ ...v, ...patch })); setSaved(false); }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (preview) { setPreviewNotice('Así se confirma la asistencia. Esta vista previa no guarda respuestas.'); return; }
    const identity = invitation?.recipient_name ?? profile?.display_name ?? value.family_name;
    const invalid = validateRsvp({ ...value, family_name: identity }); if (invalid) { setError(invalid); return; }
    setBusy(true);
    try {
      if (!profile && token) await enterPersonalInvitation(token);
      const { error } = await db().rpc('save_my_rsvp', { family_name: identity.trim(), attending: value.attending, adults: value.adults, children: value.children, note: value.note });
      if (error) throw error; setSaved(true); setAnswered(value.attending); setEditing(false); onResponse?.(value.attending); await onJoined?.();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function editResponse() {
    setBusy(true); setError('');
    try {
      if (!preview && token) await enterPersonalInvitation(token);
      if (!preview) {
        const { data, error } = await db().rpc('get_my_rsvp').maybeSingle();
        if (error) throw error;
        if (data) setValue(data as Rsvp);
      }
      setEditing(true);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const confirmed = answered ?? invitation?.attending ?? false;
  if (confirmed && !editing) return <div className="card rsvp-form confirmed-card">
    <CheckCircle2 size={36} /><span className="eyebrow">¡YA ERES PARTE DEL EQUIPO!</span>
    <h3>Tu asistencia está confirmada</h3><p>¡{invitation?.recipient_name ?? profile?.display_name}, te esperamos el 26 de septiembre!</p>
    <a className="button button-blue" href="#mi-wallet">Guardar mi pase<ArrowRight size={18} /></a>
    <a className="button button-white" href="#recuerdos">Ver los recuerdos</a>
    <button type="button" className="text-link" disabled={busy} onClick={() => void editResponse()}>{busy ? 'Cargando respuesta…' : 'Modificar mi respuesta'}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
  return <form className="card rsvp-form" onSubmit={submit}><h3>{invitation ? `¡Te esperamos, ${invitation.recipient_name}!` : 'Un lugar para tu equipo'}</h3><p>Confirma por tu familia. {invitation ? 'Puedes volver a este enlace para cambiar tu respuesta.' : 'Puedes cambiar tu respuesta desde este teléfono.'}</p>
    <fieldset disabled={busy || loading}><div className="identity-label">Invitación personal para<strong>{invitation?.recipient_name ?? profile?.display_name ?? "Invitado de ejemplo"}</strong></div>
    <div className="choice-row"><button type="button" aria-pressed={value.attending} className={value.attending ? 'choice selected' : 'choice'} onClick={() => change({ attending: true, adults: Math.max(1, value.adults) })}>¡Sí, vamos! 🎉</button><button type="button" aria-pressed={!value.attending} className={!value.attending ? 'choice selected' : 'choice'} onClick={() => change({ attending: false })}>No podremos ir</button></div>
    {value.attending && <div className="form-grid"><label>Adultos<input type="number" min={1} max={20} required value={value.adults} onChange={e => change({ adults: Number(e.target.value) })} /></label><label>Niños<input type="number" min={0} max={20} required value={value.children} onChange={e => change({ children: Number(e.target.value) })} /></label></div>}
    <label>Un mensaje para nosotros <span>(opcional)</span><textarea maxLength={500} rows={3} value={value.note} onChange={e => change({ note: e.target.value })} placeholder="¿Algo que debamos saber?" /></label>
    <button className="button button-blue">{busy ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}Guardar mi respuesta</button></fieldset>
    {editing && confirmed && <button type="button" className="text-link" disabled={busy} onClick={() => setEditing(false)}>Volver a mi confirmación</button>}
    {saved && <p className="success" role="status">{value.attending ? '¡Listo! Tu familia está confirmada. Nos vemos en la aventura.' : 'Guardamos tu respuesta. ¡Gracias por avisarnos!'}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {previewNotice && <p className="form-note" role="status">{previewNotice}</p>}
  </form>;
}

export async function enterPersonalInvitation(token: string) {
  const client = db();
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) { const { error } = await client.auth.signInAnonymously(); if (error) throw error; }
  const { error } = await client.rpc('join_invitation', { invite_token: token });
  if (error) throw error;
}

export function PersonalAlbumGate({ token, name, onJoined }: { token: string; name: string; onJoined: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function unlock(code: string) {
    setBusy(true); setError('');
    try { await enterPersonalInvitation(token); const {data,error}=await db().rpc('unlock_personal_album',{guest_code:code}); if(error) throw error; if(!data) throw new Error('Ese código no corresponde a tu invitación. Revisa tu pase.'); await onJoined(); }
    catch(e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  useEffect(() => {
    try { const key='santiago-album-code-'+token; const code=sessionStorage.getItem(key); sessionStorage.removeItem(key); if(code) void unlock(code); } catch { /* Manual entry remains available. */ }
  }, [token]);
  return <form className="card gate" onSubmit={e => { e.preventDefault(); void unlock(String(new FormData(e.currentTarget).get('code'))); }}><h3>¡{name}, tus recuerdos te esperan!</h3><p>Escribe el código personal que aparece en tu pase. Tus fotos y comentarios quedarán a nombre de esta invitación.</p><label>Código personal<input name="code" required maxLength={64} autoCapitalize="characters" autoComplete="off" placeholder="Santiago-Creeper-…" /></label><button className="button button-blue" disabled={busy}>{busy ? 'Validando…' : 'Entrar al álbum'}<ArrowRight size={18} /></button><a className="text-link" href="#detalles">Ver mi pase y mi código</a>{error && <p className="form-error" role="alert">{error}</p>}</form>;
}
