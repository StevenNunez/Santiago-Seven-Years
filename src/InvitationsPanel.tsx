import { useCallback, useEffect, useState } from 'react';
import { Baby, Copy, Eye, Mail, MessageCircle, Plus, Save, User, Users, X } from 'lucide-react';
import { db, errorMessage } from './supabase';
import { formatGuestCode, groupInvitations, invitationMessage, invitationUrl, normalizePhone, peopleSummary, whatsappUrl } from './invitations';
import type { Invitation, InvitationRsvp, InvitationStatus, InvitationWithRsvp } from './invitations';
import type { Details, EventSettings } from './domain';
import { createInvitationEmail } from '../server/email-template.mjs';
import Toast from './Toast';
import type { ToastMessage } from './Toast';
import { DeleteInvitation, InvitationCleanup } from './InvitationDelete';

const empty = { recipient_name: '', email: '', phone: '' };
const tabs: { key: InvitationStatus; label: string; empty: string }[] = [
  { key: 'pending', label: 'Por confirmar', empty: 'Todas las invitaciones ya respondieron. ¡Gran trabajo!' },
  { key: 'confirmed', label: 'Confirmados', empty: 'Todavía nadie confirma. Comparte los enlaces y las respuestas aparecerán aquí con sus cantidades.' },
  { key: 'declined', label: 'No asisten', empty: 'Nadie ha dicho que no. ¡Buena señal!' },
];
const statusLabel: Record<InvitationStatus, string> = { pending: 'Sin respuesta', confirmed: '¡Asisten!', declined: 'No asisten' };
export default function InvitationsPanel({ event, details, onDeleted }: { event: EventSettings; details: Details | null; onDeleted: () => Promise<void> }) {
  const [rows, setRows] = useState<Invitation[]>([]); const [rsvps, setRsvps] = useState<InvitationRsvp[]>([]); const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<InvitationStatus>('pending');
  const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [mail, setMail] = useState<Invitation | null>(null); const [manualCopy, setManualCopy] = useState('');
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const publicOrigin = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://santiago.teolabs.app';
  const shareLink = (row: Invitation) => invitationUrl(row.token, publicOrigin);
  const emailPreview = mail ? createInvitationEmail(mail, event, details ?? {}, publicOrigin) : null;
  const showToast = useCallback((tone: ToastMessage['tone'], title: string, detail?: string) => setToast({ id: Date.now(), tone, title, detail }), []);
  const closeToast = useCallback(() => setToast(null), []);
  // Invitations and their confirmations load together so deleting one removes it from every list at once.
  const refresh = useCallback(async () => {
    const [invitations, responses] = await Promise.all([
      db().from('invitations').select('*').order('created_at', { ascending: false }),
      db().from('rsvps').select('invitation_id,family_name,attending,adults,children,note,wish_on_show').order('updated_at', { ascending: false }),
    ]);
    if (invitations.error) throw invitations.error; if (responses.error) throw responses.error;
    setRows(invitations.data ?? []); setRsvps(responses.data ?? []); setLoaded(true);
  }, []);
  useEffect(() => { const update = () => { void refresh().catch(e => setError(errorMessage(e))); }; update(); const timer = setInterval(update, 30000); return () => clearInterval(timer); }, [refresh]);
  async function act(fn: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const groups = groupInvitations(rows, rsvps);
  const visible = groups[tab];
  const current = tabs.find(t => t.key === tab)!;
  return <section className="invitations-panel card"><div className="invitation-panel-heading"><div><span className="eyebrow">INVITACIONES CON NOMBRE PROPIO</span><h3>Tu lista de aventuras compartidas</h3><p>Agrega una persona o familia. Su enlace será el mismo para confirmar desde cualquier teléfono.</p></div><a className="button button-outline" href="/?preview=1" target="_blank" rel="noreferrer"><Eye size={17} />Ver como invitado</a><a className="button button-outline" href="/?preview=1&entrance=welcome" target="_blank" rel="noreferrer"><Eye size={17} />Ver bienvenida</a></div>
    <form className="invitation-create" onSubmit={e => { e.preventDefault(); void act(async () => {
      const values = { recipient_name: form.recipient_name.trim(), email: form.email.trim(), phone: normalizePhone(form.phone) };
      if (values.recipient_name.length < 2) throw new Error('Escribe el nombre de la persona o familia.');
      if (values.phone && !/^[1-9]\d{7,14}$/.test(values.phone)) throw new Error('Incluye el código de país en el teléfono; por ejemplo +56912345678.');
      const { error } = editing ? await db().from('invitations').update(values).eq('id', editing) : await db().from('invitations').insert(values);
      if (error) throw error; setForm(empty); setEditing(null); await refresh(); if (!editing) setTab('pending'); setNotice(editing ? 'Invitación actualizada. El enlace sigue siendo el mismo.' : 'Invitación creada. Ya puedes revisar cómo la verá tu invitado.');
    }); }}><label>Nombre del invitado o familia<input required minLength={2} maxLength={80} placeholder="Ej. Mateo y familia" value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} /></label><label>Correo <span>(opcional)</span><input type="email" maxLength={254} placeholder="familia@correo.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>WhatsApp <span>(opcional)</span><input type="tel" maxLength={25} placeholder="+56 9 1234 5678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><div className="button-row"><button className="button button-blue" disabled={busy}>{editing ? <Save size={17} /> : <Plus size={17} />}{editing ? 'Guardar cambios' : 'Crear invitación'}</button>{editing && <button className="button button-quiet" type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}</div></form>
    {local && <p className="form-note">Estás trabajando en la versión local. «Ver como invitado» funciona aquí; los enlaces para compartir apuntan a {new URL(publicOrigin).hostname} y funcionarán cuando publiquemos la web.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}
    {manualCopy && <label>Selecciona y copia este enlace<input readOnly value={manualCopy} onFocus={e => e.target.select()} /></label>}
    <InvitationCleanup />
    <div className="admin-stats invitation-stats"><div className="card"><Users /><strong>{groups.totals.families}</strong><span>Familias confirmadas</span></div><div className="card"><User /><strong>{groups.totals.adults}</strong><span>Adultos</span></div><div className="card"><Baby /><strong>{groups.totals.children}</strong><span>Niños</span></div></div>
    <div className="invitation-tabs" role="tablist" aria-label="Estado de las invitaciones">{tabs.map(t => <button key={t.key} role="tab" type="button" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls="invitation-list" className={tab === t.key ? `invitation-tab active tab-${t.key}` : `invitation-tab tab-${t.key}`} onClick={() => setTab(t.key)}>{t.label}<b>{groups[t.key].length}</b></button>)}</div>
    <div className="invitation-list" id="invitation-list" role="tabpanel" aria-labelledby={`tab-${tab}`}>{!loaded ? <p>Cargando invitaciones…</p> : rows.length === 0 ? <p>Todavía no agregaste invitados. Crea la primera invitación arriba.</p> : visible.length === 0 ? <p className="invitation-empty">{current.empty}</p> : visible.map(row => <InvitationRow key={row.id} row={row} busy={busy} local={local} testMode={Boolean(event.album_test_mode)} onEdit={() => { setEditing(row.id); setForm({ recipient_name: row.recipient_name, email: row.email, phone: row.phone }); }}
      onToggle={() => void act(async () => { const { error } = await db().from('invitations').update({ active: !row.active }).eq('id', row.id); if (error) throw error; await refresh(); })}
      onCopy={() => void act(async () => { const link = shareLink(row); try { await navigator.clipboard.writeText(link); setNotice(`Enlace de ${row.recipient_name} copiado.`); } catch { setManualCopy(link); setNotice('Copia el enlace del campo que aparece arriba.'); } })}
      onMail={() => setMail(row)} shareLink={shareLink(row)}
      onWishToggle={show => { setRsvps(list => list.map(r => r.invitation_id === row.id ? { ...r, wish_on_show: show } : r)); void act(async () => { const { error } = await db().from('rsvps').update({ wish_on_show: show }).eq('invitation_id', row.id); if (error) { await refresh(); throw error; } }); }}
      onDeleted={async outcome => { if (editing === row.id) { setEditing(null); setForm(empty); } if (mail?.id === row.id) setMail(null); setManualCopy(''); setError(''); setNotice(''); await refresh(); await onDeleted(); window.dispatchEvent(new Event('invitations-changed'));
        if (outcome.cleanupPending) showToast('warning', `La invitación de ${outcome.name} ya no da acceso`, 'Quedó pendiente borrar sus archivos o invalidar su pase Wallet. Usa «Completar eliminación» más arriba.');
        else showToast('success', `Invitación de ${outcome.name} eliminada`, row.status === 'confirmed' ? 'Su confirmación y sus cantidades ya no cuentan en los totales.' : 'Su enlace y código dejaron de funcionar.'); }}
      onDeleteError={message => showToast('error', `No se pudo eliminar la invitación de ${row.recipient_name}`, message)} />)}</div>
    {groups.orphans.length > 0 && <div className="invitation-orphans"><h4>Respuestas sin invitación personal</h4><p className="form-note">Llegaron con el acceso antiguo por código general. Cuentan en los totales de arriba.</p><div className="table-scroll"><table><thead><tr><th>Familia</th><th>Respuesta</th><th>Adultos</th><th>Niños</th><th>Mensaje</th></tr></thead><tbody>{groups.orphans.map((r, i) => <tr key={i}><td>{r.family_name}</td><td>{r.attending ? '¡Asisten!' : 'No asisten'}</td><td>{r.adults}</td><td>{r.children}</td><td>{r.note || '—'}</td></tr>)}</tbody></table></div></div>}
    {mail && <div className="email-review" role="dialog" aria-modal="true" aria-label="Revisar invitación por correo"><div className="email-review-card card"><button className="icon-button email-close" aria-label="Cerrar correo" disabled={busy} onClick={() => setMail(null)}><X /></button><span className="eyebrow">REVISA TU INVITACIÓN</span><h3>Para: {mail.recipient_name}</h3><p>{mail.email}</p><p><strong>{emailPreview?.subject}</strong></p><iframe className="email-html-preview" title="Así se verá el correo de invitación" sandbox="" srcDoc={emailPreview?.html.replace("cid:santiago-level7", new URL("/share.jpg", location.origin).href)} /><p className="form-note">Se enviará a este correo cuando pulses «Enviar invitación».</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button className="button button-blue" disabled={busy} onClick={() => void act(async () => {
      const { data: { session } } = await db().auth.getSession();
      if (!session) throw new Error('Vuelve a iniciar sesión en el panel.');
      const response = await fetch('/api/invitations/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ invitationId: mail.id }) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('El servicio de correo no está disponible en este alojamiento.');
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo enviar la invitación.');
      setMail(null); await refresh(); setNotice('El servidor de correo aceptó la invitación para envío.');
    })}><Mail size={17} />{busy ? 'Enviando…' : 'Enviar invitación'}</button><a className="button button-outline" href={`mailto:${encodeURIComponent(mail.email)}?subject=${encodeURIComponent(`¡${mail.recipient_name}, Santiago te invita a su nivel 7!`)}&body=${encodeURIComponent(invitationMessage(mail.recipient_name, shareLink(mail)))}`}>Abrir en mi correo</a></div></div></div>}
    <Toast message={toast} onClose={closeToast} />
  </section>;
}

type RowProps = { row: InvitationWithRsvp<Invitation>; busy: boolean; local: boolean; testMode: boolean; shareLink: string; onEdit: () => void; onToggle: () => void; onCopy: () => void; onMail: () => void; onDeleted: (outcome: { name: string; cleanupPending: boolean }) => Promise<void>; onDeleteError: (message: string) => void; onWishToggle: (show: boolean) => void };
function InvitationRow({ row, busy, local, testMode, shareLink, onEdit, onToggle, onCopy, onMail, onDeleted, onDeleteError, onWishToggle }: RowProps) {
  return <article className={`invitation-row status-${row.status}`}><div className="invitation-recipient"><span className="avatar">{row.recipient_name.slice(0, 1)}</span><div><strong>{row.recipient_name}<span className={`status-pill status-${row.status}`}>{statusLabel[row.status]}</span></strong>
    {row.rsvp && row.status === 'confirmed' && <small className="invitation-people"><Users size={13} />{peopleSummary(row.rsvp)}</small>}
    {row.rsvp?.note && <small className="invitation-note">«{row.rsvp.note}»</small>}
    {row.rsvp?.note && row.status === 'confirmed' && <label className="checkbox invitation-wish"><input type="checkbox" checked={row.rsvp.wish_on_show !== false} onChange={e => onWishToggle(e.target.checked)} />Mostrar en «Niveles anteriores»</label>}
    <small>{row.access_code ? `Código personal: ${formatGuestCode(row.access_code)}` : ''}</small>
    <small>{row.checked_in_at ? `Llegada indicada: ${new Date(row.checked_in_at).toLocaleString('es-CL')}` : 'Sin registro de llegada'}</small>
    <small>{row.email || 'Sin correo'}{row.phone ? ` · +${row.phone}` : ''}</small>
    <small>{!row.active ? 'Enlace desactivado' : row.email_sent_at ? `Correo aceptado para envío: ${new Date(row.email_sent_at).toLocaleString('es-CL')}` : 'Enlace listo para compartir'}</small></div></div>
    <div className="invitation-actions">{row.active && <>{local && testMode && <a className="button button-blue" href={invitationUrl(row.token, location.origin)} target="_blank" rel="noreferrer"><Eye size={16} />Probar invitación real</a>}<a className="button button-outline" href={invitationUrl(row.token, location.origin, true)} target="_blank" rel="noreferrer"><Eye size={16} />Ver como invitado</a><button className="button button-outline" onClick={onCopy}><Copy size={16} />Enlace</button><a className="button button-whatsapp" href={whatsappUrl(row.phone, invitationMessage(row.recipient_name, shareLink))} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a><button className="button button-outline" disabled={!row.email || busy} onClick={onMail}><Mail size={16} />Correo</button></>}<button className="button button-quiet" disabled={busy} onClick={onEdit}>Editar</button><button className="button button-quiet" disabled={busy} onClick={onToggle}>{row.active ? 'Desactivar' : 'Reactivar'}</button><DeleteInvitation id={row.id} name={row.recipient_name} confirmed={row.status === 'confirmed'} onDeleted={onDeleted} onError={onDeleteError} /></div></article>;
}
