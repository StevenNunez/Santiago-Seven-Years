import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Heart, ImagePlus, LoaderCircle, MessageCircle, RefreshCw, Send, Trash2 } from 'lucide-react';
import { db, errorMessage } from './supabase';
import { forgetSignedUrls, preparePhoto, signedUrls, thumbPath } from './photos';
import { niceDate, uploadState } from './domain';
import PushPreferences from './PushPreferences';
import type { Comment, EventSettings, Like, Photo, Profile } from './domain';

export default function Feed({ profile, event }: { profile: Profile; event: EventSettings }) {
  const [photos, setPhotos] = useState<Photo[]>([]); const [comments, setComments] = useState<Comment[]>([]); const [likes, setLikes] = useState<Like[]>([]);
  const [composer, setComposer] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(12); const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState(''); const [caption, setCaption] = useState(''); const [status, setStatus] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Photo | null>(null);
  const camera = useRef<HTMLInputElement>(null); const gallery = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const open = uploadState(event) === 'open';
  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      let query = db().from('photos').select('*,profiles!photos_user_id_fkey(display_name)', { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
      if (filter === 'mine') query = query.eq('user_id', profile.user_id);
      const { data, error, count } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Photo[];
      const visible = rows.slice(0, limit);
      let fetchedComments: Comment[] = []; let fetchedLikes: Like[] = []; let signed: Photo[] = [];
      if (visible.length) {
        const [urls, commentRows, likeRows] = await Promise.all([
          signedUrls(visible.flatMap(p => [p.storage_path, thumbPath(p.storage_path)])),
          db().from('comments').select('*,profiles!comments_user_id_fkey(display_name)').in('photo_id', visible.map(p => p.id)).order('created_at').limit(1000),
          db().from('likes').select('*').in('photo_id', visible.map(p => p.id)).limit(1000),
        ]);
        if (commentRows.error) throw commentRows.error; if (likeRows.error) throw likeRows.error;
        if (visible.some(p => !urls.get(p.storage_path))) throw new Error('No se pudieron cargar algunas fotos. Intenta actualizar el álbum.');
        // Photos published before thumbnails existed fall back to their full image.
        signed = visible.map(p => ({ ...p, url: urls.get(p.storage_path), thumb: urls.get(thumbPath(p.storage_path)) ?? urls.get(p.storage_path) }));
        fetchedComments = commentRows.data as unknown as Comment[]; fetchedLikes = likeRows.data as Like[];
      }
      if (current !== request.current) return;
      setTotal(count ?? rows.length); setUpdatedAt(Date.now()); setPhotos(signed); setComments(fetchedComments); setLikes(fetchedLikes); setHasMore(rows.length > limit); setError('');
    } catch (e) { if (current === request.current) setError(errorMessage(e)); }
    finally { if (current === request.current) setLoading(false); }
  }, [limit, filter, profile.user_id]);
  useEffect(() => {
    void refresh();
    let pending: ReturnType<typeof setTimeout>;
    const changed = () => { clearTimeout(pending); pending=setTimeout(() => void refresh(),350); };
    const channel = db().channel('birthday-feed-' + profile.user_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, changed).subscribe(status => setConnected(status === 'SUBSCRIBED'));
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    const focus = () => void refresh(); window.addEventListener('focus', focus);
    return () => { ++request.current; clearTimeout(pending); clearInterval(timer); window.removeEventListener('focus', focus); void db().removeChannel(channel); };
  }, [refresh]);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);
  async function publish() {
    if (!file || busy) return; setBusy(true); setError(''); setStatus('Preparando tu foto…');
    try {
      const photo = await preparePhoto(file); const id = crypto.randomUUID(); const path = `${profile.user_id}/${id}.jpg`;
      setStatus('Subiendo tu recuerdo…');
      const [full, thumb] = await Promise.all([
        db().storage.from('memories').upload(path, photo.full, { contentType: 'image/jpeg', upsert: false }),
        db().storage.from('memories').upload(thumbPath(path), photo.thumb, { contentType: 'image/jpeg', upsert: false }),
      ]);
      if (full.error || thumb.error) { await db().storage.from('memories').remove([path, thumbPath(path)]); throw full.error ?? thumb.error; }
      const { error } = await db().from('photos').insert({ id, user_id: profile.user_id, storage_path: path, caption: caption.trim() });
      if (error) { await db().storage.from('memories').remove([path, thumbPath(path)]); throw error; }
      setFile(null); setCaption(''); setComposer(false); setStatus('¡Tu foto ya está publicada en el muro!'); await refresh();
    } catch (e) { setError(errorMessage(e)); setStatus(''); } finally { setBusy(false); }
  }
  async function deletePhoto() {
    if (!pendingDelete) return; setBusy(true); setError('');
    try {
      // Delete storage first so a failed storage operation cannot leave an inaccessible orphan.
      const paths = [pendingDelete.storage_path, thumbPath(pendingDelete.storage_path)];
      const { error: storageError } = await db().storage.from('memories').remove(paths);
      if (storageError) throw storageError; forgetSignedUrls(paths);
      const { error } = await db().from('photos').delete().eq('id', pendingDelete.id);
      if (error) throw error;
      setPendingDelete(null); await refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="feed-content wall-content">
    <div className="wall-heading"><div><span className="eyebrow">EL CUMPLEAÑOS LO CONTAMOS ENTRE TODOS</span><h2>El muro de Santiago <span>♡</span></h2><p>Fotos, risas y cariño de nuestra pandilla.</p></div><span className={connected ? 'wall-live online' : 'wall-live'}><i />{connected ? 'En vivo' : 'Actualización automática'}</span></div>
    <div className="wall-compose-bar"><span className="avatar">{profile.display_name.slice(0,1)}</span><div><strong>¡Hola, {profile.display_name}!</strong><span>{open ? '¿Qué momento quieres compartir?' : 'Revive los recuerdos de la pandilla.'}</span></div>{open && <button className="button button-blue" onClick={() => setComposer(v => !v)} aria-expanded={composer}><ImagePlus size={18} />{composer ? 'Cerrar' : 'Publicar foto'}</button>}</div>
    {open && composer && <div className="upload-card card"><div><span className="eyebrow">EL MEJOR RECUERDO ES EL TUYO</span><h3>¿Capturaste un momentazo?</h3><p>Compártelo con toda la pandilla. Solo fotos, mucho cariño.</p></div><div className="button-row"><button className="button button-blue" onClick={() => camera.current?.click()} disabled={busy}><Camera size={18} />Tomar foto</button><button className="button button-outline" onClick={() => gallery.current?.click()} disabled={busy}><ImagePlus size={18} />Elegir foto</button></div>
      <input ref={camera} hidden type="file" accept="image/*" capture="environment" onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <input ref={gallery} hidden type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      {file && <div className="photo-compose">{preview && <img src={preview} alt="Vista previa de la foto seleccionada" />}<label>Unas palabras para este recuerdo<textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={500} rows={2} placeholder="Un momento para recordar… (opcional)" /></label><div className="button-row"><button className="button button-blue" disabled={busy} onClick={() => void publish()}>{busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}Publicar foto</button><button className="button button-quiet" disabled={busy} onClick={() => setFile(null)}>Cancelar</button></div></div>}
    </div>}
    {status && <p className="success" role="status">{status}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="wall-tabs" role="group" aria-label="Filtrar publicaciones"><button aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setLimit(12); }}>Toda la pandilla</button><button aria-pressed={filter === 'mine'} onClick={() => { setFilter('mine'); setLimit(12); }}>Mis fotos</button><span>{total} {total === 1 ? 'publicación' : 'publicaciones'}</span></div><div className="feed-toolbar"><span>{updatedAt ? 'Actualizado a las ' + new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }).format(updatedAt) : 'Cargando nuestro muro…'}</span><button className="button button-quiet" onClick={() => void refresh()} aria-label="Actualizar álbum"><RefreshCw size={16} />Actualizar</button></div>
    {loading ? <div className="empty-state"><LoaderCircle className="spin" /><p>Cargando recuerdos…</p></div> : !photos.length ? <div className="empty-state"><span className="empty-ring"><Camera size={34} /></span><h3>Nuestro muro empieza contigo</h3><p>{filter === 'mine' ? 'Tus publicaciones aparecerán aquí. Puedes ver las de todos en «Toda la pandilla».' : open ? 'Aún no hay publicaciones. Sube la primera foto y todos los invitados podrán verla y comentarla.' : uploadState(event) === 'soon' ? `El álbum abre el ${niceDate(event.uploads_open_at)}. Prepara tu mejor sonrisa.` : 'La recepción de fotos está cerrada. Los recuerdos publicados aparecerán aquí.'}</p></div> : <div className="photo-grid wall-stream" role="feed" aria-label="Publicaciones de la pandilla">{photos.map(photo => <PhotoCard key={photo.id} photo={photo} profile={profile} comments={comments.filter(c => c.photo_id === photo.id)} likes={likes.filter(l => l.photo_id === photo.id)} open={open} refresh={refresh} onDelete={() => setPendingDelete(photo)} />)}</div>}
    {hasMore && <button className="button button-outline load-more" onClick={() => setLimit(v => v + 12)}>Ver más recuerdos</button>}
    <PushPreferences profile={profile} />
    {pendingDelete && <div className="confirm-delete" role="alertdialog" aria-label="Eliminar foto"><p>¿Eliminar esta foto y sus comentarios? Esta acción no se puede deshacer.</p><div className="button-row"><button className="button button-danger" disabled={busy} onClick={() => void deletePhoto()}>Eliminar foto</button><button className="button button-white" disabled={busy} onClick={() => setPendingDelete(null)}>Conservar foto</button></div></div>}
  </div>;
}

function PhotoCard({ photo, profile, comments, likes, open, refresh, onDelete }: { photo: Photo; profile: Profile; comments: Comment[]; likes: Like[]; open: boolean; refresh: () => Promise<void>; onDelete: () => void }) {
  const [showComments, setShowComments] = useState(false); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const liked = likes.some(l => l.user_id === profile.user_id);
  async function act(action: () => PromiseLike<{ error: unknown }>) {
    if (busy) return; setBusy(true); setError('');
    try { const { error } = await action(); if (error) throw error; await refresh(); return true; }
    catch (e) { setError(errorMessage(e)); return false; } finally { setBusy(false); }
  }
  return <article className="photo-card card" aria-label={`Publicación de ${photo.profiles.display_name}`}><div className="photo-header"><span className="avatar">{photo.profiles.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{photo.profiles.display_name}</strong><small>{niceDate(photo.created_at)} · {new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }).format(new Date(photo.created_at))}</small></div>{(profile.role === 'admin' || photo.user_id === profile.user_id) && <button className="icon-button delete-photo" aria-label="Eliminar foto" onClick={onDelete}><Trash2 size={17} /></button>}</div>
    <a href={photo.url} target="_blank" rel="noreferrer" aria-label={`Abrir foto de ${photo.profiles.display_name}`}><img className="feed-photo" src={photo.thumb ?? photo.url} alt={photo.caption || `Recuerdo compartido por ${photo.profiles.display_name}`} loading="lazy" decoding="async" /></a>
    <div className="photo-body">{photo.caption && <p>{photo.caption}</p>}<div className="photo-actions"><button className={liked ? 'reaction liked' : 'reaction'} aria-label={liked ? 'Quitar me gusta' : 'Me gusta'} aria-pressed={liked} disabled={busy || (!open && !liked)} onClick={() => void act(() => liked ? db().from('likes').delete().eq('photo_id', photo.id).eq('user_id', profile.user_id) : db().from('likes').insert({ photo_id: photo.id, user_id: profile.user_id }))}><Heart size={20} fill={liked ? 'currentColor' : 'none'} />{likes.length} <span>Me gusta</span></button><button className="reaction" onClick={() => setShowComments(!showComments)} aria-expanded={showComments}><MessageCircle size={20} />{comments.length} <span>comentarios</span></button></div>
      {!showComments && comments.length > 0 && <div className="wall-comment-preview"><strong>{comments[comments.length - 1].profiles.display_name}</strong> {comments[comments.length - 1].body}</div>}
      {showComments && <div className="comments">{comments.map(comment => <div className="comment" key={comment.id}><div><strong>{comment.profiles.display_name}</strong><p>{comment.body}</p></div>{(comment.user_id === profile.user_id || profile.role === 'admin') && <button disabled={busy} className="icon-button" aria-label="Eliminar comentario" onClick={() => { if (window.confirm('¿Eliminar este comentario?')) void act(() => db().from('comments').delete().eq('id', comment.id)); }}><Trash2 size={14} /></button>}</div>)}{open && <form className="comment-form" onSubmit={async e => { e.preventDefault(); if (!body.trim()) return; const ok = await act(() => db().from('comments').insert({ photo_id: photo.id, user_id: profile.user_id, body: body.trim() })); if (ok) setBody(''); }}><input aria-label="Escribe un comentario" required maxLength={500} value={body} onChange={e => setBody(e.target.value)} placeholder="Deja un poquito de cariño…" /><button className="icon-button" aria-label="Publicar comentario" disabled={busy || !body.trim()}><Send size={18} /></button></form>}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div></article>;
}
