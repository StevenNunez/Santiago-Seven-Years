import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, LoaderCircle, LockKeyhole, Save, Users } from 'lucide-react';
import { db, errorMessage, supabase } from './supabase';
import { EVENT_ID } from './domain';
import type { Details, EventSettings, Profile, Rsvp } from './domain';
import { exportAlbum } from './photos';
import ArrivalSummary from './ArrivalSummary';
import InvitationsPanel from './InvitationsPanel';

export default function Admin({ profile, event, details, refresh }: { profile: Profile | null; event: EventSettings; details: Details | null; refresh: () => Promise<void> }) {
  const [rows, setRows] = useState<Rsvp[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [settings, setSettings] = useState(event); const [venue, setVenue] = useState<Details>(details ?? { venue: '', address: '', map_url: '' });
  useEffect(() => { setSettings(event); }, [event]);
  useEffect(() => { if (details) setVenue(details); }, [details]);
  useEffect(() => {
    if (profile?.role !== 'admin') return;
    void db().from('rsvps').select('*').order('updated_at', { ascending: false }).then(({ data, error }) => { if (error) setError(errorMessage(error)); else setRows(data ?? []); });
  }, [profile]);
  async function action(fn: () => Promise<void>) {
    setBusy(true); setError(''); setStatus('');
    try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    await action(async () => { const { error } = await db().auth.signInWithPassword({ email: String(data.get('email')), password: String(data.get('password')) }); if (error) throw error; await refresh(); });
  }
  if (profile?.role !== 'admin') return <section className="section admin-section"><div className="section-heading"><span className="eyebrow">SOLO ORGANIZACIÓN</span><h2>Detrás de la aventura</h2><p>Acceso privado para organizar el cumpleaños.</p></div><form className="card gate" onSubmit={login}><LockKeyhole /><label>Correo<input type="email" name="email" autoComplete="username" required /></label><label>Contraseña<input type="password" name="password" autoComplete="current-password" required /></label><button className="button button-blue" disabled={busy || !supabase}>Entrar al panel</button>{profile && <p className="form-note">Esta sesión no tiene permisos de organización.</p>}{error && <p className="form-error" role="alert">{error}</p>}</form></section>;
  const yes = rows.filter(r => r.attending);
  return <section className="section admin-section"><div className="section-heading"><span className="eyebrow">CENTRO DE MANDO</span><h2>Todo listo para el nivel 7</h2></div>
    <ArrivalSummary />
    <InvitationsPanel event={event} details={details} onDeleted={refresh} />
    <div className="admin-stats"><div className="card"><Users /><strong>{yes.length}</strong><span>Familias confirmadas</span></div><div className="card"><strong>{yes.reduce((n, r) => n + r.adults, 0)}</strong><span>Adultos</span></div><div className="card"><strong>{yes.reduce((n, r) => n + r.children, 0)}</strong><span>Niños</span></div></div>
    {error && <p role="alert" className="form-error">{error}</p>}{status && <p role="status" className="success">{status}</p>}
    <div className="admin-grid"><form className="card" onSubmit={e => { e.preventDefault(); void action(async () => {
      const { error: scheduleError } = await db().from('event_settings').update(settings).eq('id', EVENT_ID); if (scheduleError) throw scheduleError;
      const { error } = await db().from('event_details').update(venue).eq('id', EVENT_ID); if (error) throw error;
      await refresh(); setStatus('Datos de la fiesta guardados.');
    }); }}><h3>La fiesta</h3><label>Lugar<input maxLength={160} value={venue.venue} onChange={e => setVenue({ ...venue, venue: e.target.value })} /></label><label>Dirección<input maxLength={300} value={venue.address} onChange={e => setVenue({ ...venue, address: e.target.value })} /></label><label>Enlace del mapa (https)<input type="url" value={venue.map_url} onChange={e => setVenue({ ...venue, map_url: e.target.value })} /></label><label>Inicio (fecha y zona horaria)<input placeholder="2026-09-26T15:00:00-03:00" value={settings.starts_at ?? ''} onChange={e => setSettings({ ...settings, starts_at: e.target.value || null })} /></label><label>Término (fecha y zona horaria)<input placeholder="2026-09-26T19:00:00-03:00" value={settings.ends_at ?? ''} onChange={e => setSettings({ ...settings, ends_at: e.target.value || null })} /></label><button className="button button-blue" disabled={busy}><Save size={18} />Guardar datos</button></form>
    <div className="admin-side"><div className="card"><h3>Acceso personal de invitados</h3><p>Cada invitación tiene su propio código, visible en la lista y en el pase del invitado. Confirmar no pide código; el álbum sí lo valida. La llegada se registra cuando el invitado pulsa «Ya llegué» el día de la fiesta.</p></div>
    <div className="card"><h3>Todos los recuerdos, juntos</h3><p>Descarga todas las fotos del álbum. Se guardan las versiones optimizadas, en ZIP de hasta 20 fotos. Permite las descargas múltiples si el navegador lo solicita.</p><button className="button button-blue" disabled={busy} onClick={() => void action(async () => { const count = await exportAlbum(setStatus); setStatus(count ? `Se prepararon ${count} fotos. Revisa las descargas de tu navegador.` : 'Todavía no hay fotos para descargar.'); })}>{busy ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}Descargar todas las fotos</button></div>
    <form className="card" onSubmit={e => { e.preventDefault(); void action(async () => { const { error } = await db().from('event_settings').update({ album_test_mode: Boolean(settings.album_test_mode), uploads_enabled: settings.uploads_enabled, uploads_open_at: settings.uploads_open_at, uploads_close_at: settings.uploads_close_at }).eq('id', EVENT_ID); if (error) throw error; await refresh(); setStatus('Disponibilidad del álbum guardada.'); }); }}><h3>Recepción de recuerdos</h3><label className="checkbox"><input type="checkbox" checked={Boolean(settings.album_test_mode)} onChange={e => setSettings({ ...settings, album_test_mode: e.target.checked })} />Abrir ahora para pruebas</label><p>Mientras esté activado, se permiten fotos, comentarios y corazones fuera de las fechas programadas. Al desactivarlo y guardar, vuelve a regir la apertura del 26 de septiembre. Las publicaciones de prueba no se borran automáticamente.</p><label className="checkbox"><input type="checkbox" checked={settings.uploads_enabled} onChange={e => setSettings({ ...settings, uploads_enabled: e.target.checked })} />Permitir publicaciones dentro del plazo</label><label>Apertura<input required value={settings.uploads_open_at} onChange={e => setSettings({ ...settings, uploads_open_at: e.target.value })} /></label><label>Cierre<input required value={settings.uploads_close_at} onChange={e => setSettings({ ...settings, uploads_close_at: e.target.value })} /></label><button className="button button-outline" disabled={busy}>Guardar plazo</button></form></div></div>
    <div className="card rsvp-table"><h3>Confirmaciones ({rows.length})</h3>{rows.length ? <div className="table-scroll"><table><thead><tr><th>Familia</th><th>Respuesta</th><th>Adultos</th><th>Niños</th><th>Mensaje</th></tr></thead><tbody>{rows.map(r => <tr key={r.user_id}><td>{r.family_name}</td><td>{r.attending ? '¡Asisten!' : 'No asisten'}</td><td>{r.adults}</td><td>{r.children}</td><td>{r.note || '—'}</td></tr>)}</tbody></table></div> : <p>Aquí aparecerán las respuestas de las familias.</p>}</div>
    <div className="card"><h3>Limpiar fotos y comentarios de prueba</h3><p>En Recuerdos puedes eliminar cualquier foto o comentario como organizador. Eliminar una foto también borra sus comentarios y me gusta.</p><a className="button button-outline" href="#recuerdos">Administrar recuerdos</a></div>
  </section>;
}
