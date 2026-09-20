import { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, Mail, MessageCircle, Plus, Save, X } from 'lucide-react';
import { db, errorMessage } from './supabase';
import { formatGuestCode, invitationMessage, invitationUrl, normalizePhone, whatsappUrl } from './invitations';
import type { Invitation } from './invitations';
import type { Details, EventSettings } from './domain';
import { createInvitationEmail } from '../server/email-template.mjs';

import {DeleteInvitation, InvitationCleanup} from './InvitationDelete';

const empty = { recipient_name: '', email: '', phone: '' };
export default function InvitationsPanel({ event, details, onDeleted }: { event: EventSettings; details: Details | null; onDeleted: () => Promise<void> }) {
  const [rows, setRows] = useState<Invitation[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [mail, setMail] = useState<Invitation | null>(null); const [manualCopy, setManualCopy] = useState('');
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const publicOrigin = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://santiago.teolabs.app';
  const shareLink = (row: Invitation) => invitationUrl(row.token, publicOrigin);
  const emailPreview = mail ? createInvitationEmail(mail, event, details ?? {}, publicOrigin) : null;
  const refresh = useCallback(async () => {
    const { data, error } = await db().from('invitations').select('*').order('created_at', { ascending: false });
    if (error) throw error; setRows(data ?? []);
  }, []);
  useEffect(() => { const update = () => { void refresh().catch(e => setError(errorMessage(e))); }; update(); const timer=setInterval(update,30000); return () => clearInterval(timer); }, [refresh]);
  async function act(fn: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <section className="invitations-panel card"><div className="invitation-panel-heading"><div><span className="eyebrow">INVITACIONES CON NOMBRE PROPIO</span><h3>Tu lista de aventuras compartidas</h3><p>Agrega una persona o familia. Su enlace será el mismo para confirmar desde cualquier teléfono.</p></div><a className="button button-outline" href="/?preview=1" target="_blank" rel="noreferrer"><Eye size={17} />Ver como invitado</a><a className="button button-outline" href="/?preview=1&entrance=welcome" target="_blank" rel="noreferrer"><Eye size={17} />Ver bienvenida</a></div>
    <form className="invitation-create" onSubmit={e => { e.preventDefault(); void act(async () => {
      const values = { recipient_name: form.recipient_name.trim(), email: form.email.trim(), phone: normalizePhone(form.phone) };
      if (values.recipient_name.length < 2) throw new Error('Escribe el nombre de la persona o familia.');
      if (values.phone && !/^[1-9]\d{7,14}$/.test(values.phone)) throw new Error('Incluye el código de país en el teléfono; por ejemplo +56912345678.');
      const { error } = editing ? await db().from('invitations').update(values).eq('id', editing) : await db().from('invitations').insert(values);
      if (error) throw error; setForm(empty); setEditing(null); await refresh(); setNotice(editing ? 'Invitación actualizada. El enlace sigue siendo el mismo.' : 'Invitación creada. Ya puedes revisar cómo la verá tu invitado.');
    }); }}><label>Nombre del invitado o familia<input required minLength={2} maxLength={80} placeholder="Ej. Mateo y familia" value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} /></label><label>Correo <span>(opcional)</span><input type="email" maxLength={254} placeholder="familia@correo.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>WhatsApp <span>(opcional)</span><input type="tel" maxLength={25} placeholder="+56 9 1234 5678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><div className="button-row"><button className="button button-blue" disabled={busy}>{editing ? <Save size={17} /> : <Plus size={17} />}{editing ? 'Guardar cambios' : 'Crear invitación'}</button>{editing && <button className="button button-quiet" type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}</div></form>
    {local && <p className="form-note">Estás trabajando en la versión local. «Ver como invitado» funciona aquí; los enlaces para compartir apuntan a {new URL(publicOrigin).hostname} y funcionarán cuando publiquemos la web.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}
    {manualCopy && <label>Selecciona y copia este enlace<input readOnly value={manualCopy} onFocus={e => e.target.select()} /></label>}
    <InvitationCleanup /><div className="invitation-list">{rows.length === 0 ? <p>Todavía no agregaste invitados. Crea la primera invitación arriba.</p> : rows.map(row => <article className="invitation-row" key={row.id}><div className="invitation-recipient"><span className="avatar">{row.recipient_name.slice(0, 1)}</span><div><strong>{row.recipient_name}</strong><small>{row.access_code ? `Código personal: ${formatGuestCode(row.access_code)}` : ""}</small><small>{row.checked_in_at ? `Llegada indicada: ${new Date(row.checked_in_at).toLocaleString("es-CL")}` : "Sin registro de llegada"}</small><small>{row.email || 'Sin correo'}{row.phone ? ` · +${row.phone}` : ''}</small><small>{!row.active ? 'Enlace desactivado' : row.email_sent_at ? `Correo aceptado para envío: ${new Date(row.email_sent_at).toLocaleString('es-CL')}` : 'Enlace listo para compartir'}</small></div></div><div className="invitation-actions">{row.active && <>{local && event.album_test_mode && <a className="button button-blue" href={invitationUrl(row.token, location.origin)} target="_blank" rel="noreferrer"><Eye size={16} />Probar invitación real</a>}<a className="button button-outline" href={invitationUrl(row.token, location.origin, true)} target="_blank" rel="noreferrer"><Eye size={16} />Ver como invitado</a><button className="button button-outline" onClick={() => void act(async () => { const link = shareLink(row); try { await navigator.clipboard.writeText(link); setNotice(`Enlace de ${row.recipient_name} copiado.`); } catch { setManualCopy(link); setNotice('Copia el enlace del campo que aparece arriba.'); } })}><Copy size={16} />Enlace</button><a className="button button-whatsapp" href={whatsappUrl(row.phone, invitationMessage(row.recipient_name, shareLink(row)))} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a><button className="button button-outline" disabled={!row.email || busy} onClick={() => setMail(row)}><Mail size={16} />Correo</button></>}<button className="button button-quiet" disabled={busy} onClick={() => { setEditing(row.id); setForm({ recipient_name: row.recipient_name, email: row.email, phone: row.phone }); }}>Editar</button><button className="button button-quiet" disabled={busy} onClick={() => void act(async () => { const { error } = await db().from('invitations').update({ active: !row.active }).eq('id', row.id); if (error) throw error; await refresh(); })}>{row.active ? 'Desactivar' : 'Reactivar'}</button><DeleteInvitation id={row.id} name={row.recipient_name} onDeleted={async () => { if (editing === row.id) { setEditing(null); setForm(empty); } if (mail?.id === row.id) setMail(null); setManualCopy(''); await refresh(); await onDeleted(); setNotice('Invitación eliminada. Puedes crear una nueva con un enlace y código nuevos.'); }} /></div></article>)}</div>
    {mail && <div className="email-review" role="dialog" aria-modal="true" aria-label="Revisar invitación por correo"><div className="email-review-card card"><button className="icon-button email-close" aria-label="Cerrar correo" disabled={busy} onClick={() => setMail(null)}><X /></button><span className="eyebrow">REVISA TU INVITACIÓN</span><h3>Para: {mail.recipient_name}</h3><p>{mail.email}</p><p><strong>{emailPreview?.subject}</strong></p><iframe className="email-html-preview" title="Así se verá el correo de invitación" sandbox="" srcDoc={emailPreview?.html.replace("cid:santiago-level7", new URL("/share.jpg", location.origin).href)} /><p className="form-note">Se enviará a este correo cuando pulses «Enviar invitación».</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button className="button button-blue" disabled={busy} onClick={() => void act(async () => {
      const { data: { session } } = await db().auth.getSession();
      if (!session) throw new Error('Vuelve a iniciar sesión en el panel.');
      const response = await fetch('/api/invitations/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ invitationId: mail.id }) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('El servicio de correo no está disponible en este alojamiento.');
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo enviar la invitación.');
      setMail(null); await refresh(); setNotice('El servidor de correo aceptó la invitación para envío.');
    })}><Mail size={17} />{busy ? 'Enviando…' : 'Enviar invitación'}</button><a className="button button-outline" href={`mailto:${encodeURIComponent(mail.email)}?subject=${encodeURIComponent(`¡${mail.recipient_name}, Santiago te invita a su nivel 7!`)}&body=${encodeURIComponent(invitationMessage(mail.recipient_name, shareLink(mail)))}`}>Abrir en mi correo</a></div></div></div>}
  </section>;
}
