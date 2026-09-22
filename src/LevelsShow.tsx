import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, HardDriveDownload, LoaderCircle, Maximize2, Minimize2, Pause, Play, RotateCcw, Tv } from 'lucide-react';
import { db, errorMessage } from './supabase';
import { assetPaths, buildShow, CACHE_NAME, cacheKey, megabytes, mmss, musicOf, musicVolume, showStats, slideDuration } from './levels';
import type { Moment, Wish } from './levels';
import './levels.css';

type Phase = 'idle' | 'playing' | 'paused' | 'ended';
const hasCache = () => typeof caches !== 'undefined';

export default function LevelsShow({ tv }: { tv: boolean }) {
  const [moments, setMoments] = useState<Moment[]>([]); const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [cached, setCached] = useState<Set<string>>(new Set()); const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle'); const [index, setIndex] = useState(0); const [loop, setLoop] = useState(tv);
  const [urls, setUrls] = useState<Record<string, string>>({}); const [track, setTrack] = useState(0);
  const [fullscreen, setFullscreen] = useState(false); const [controls, setControls] = useState(true); const [generation, setGeneration] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null); const shown = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null); const music = useRef<HTMLAudioElement>(null); const video = useRef<HTMLVideoElement>(null);
  const urlCache = useRef(new Map<string, string>()); const remaining = useRef<{ index: number; left: number } | null>(null); const controlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const slides = useMemo(() => buildShow(moments, wishes), [moments, wishes]);
  const playlist = useMemo(() => musicOf(moments), [moments]);
  const stats = useMemo(() => showStats(moments), [moments]);
  const paths = useMemo(() => assetPaths(moments), [moments]);
  const slide = slides[index] ?? slides[0];
  const ready = paths.length > 0 && paths.every(p => cached.has(p));

  const checkCache = useCallback(async (list: string[]) => {
    if (!hasCache()) return;
    const cache = await caches.open(CACHE_NAME); const found = new Set<string>();
    await Promise.all(list.map(async path => { if (await cache.match(cacheKey(path))) found.add(path); }));
    setCached(found);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, notes] = await Promise.all([
          db().from('moments').select('*').order('position'),
          db().from('rsvps').select('family_name,note').eq('attending', true).eq('wish_on_show', true).neq('note', '').order('updated_at'),
        ]);
        if (rows.error) throw rows.error; if (notes.error) throw notes.error;
        if (cancelled) return;
        setMoments(rows.data ?? []); setWishes(notes.data ?? []);
        await checkCache(assetPaths(rows.data ?? []));
      } catch (e) { if (!cancelled) setError(errorMessage(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [checkCache]);
  useEffect(() => () => { for (const url of urlCache.current.values()) if (url.startsWith('blob:')) URL.revokeObjectURL(url); }, []);

  // Local copy first (works without the venue's WiFi), signed URL otherwise.
  const resolve = useCallback(async (path: string) => {
    const known = urlCache.current.get(path); if (known) return known;
    let url: string | undefined;
    if (hasCache()) { const hit = await (await caches.open(CACHE_NAME)).match(cacheKey(path)); if (hit) url = URL.createObjectURL(await hit.blob()); }
    if (!url) { const { data, error } = await db().storage.from('moments').createSignedUrl(path, 3600); if (error) throw error; url = data.signedUrl; }
    urlCache.current.set(path, url); setUrls(all => ({ ...all, [path]: url! }));
    return url;
  }, []);
  // Forget resolved URLs when the local copy changes so playback switches to (or away from) it.
  const resetUrls = useCallback(() => { for (const url of urlCache.current.values()) if (url.startsWith('blob:')) URL.revokeObjectURL(url); urlCache.current.clear(); setUrls({}); setGeneration(g => g + 1); }, []);
  // Resolve the current slide, the next one (preload) and the current song. While idle, only a local copy is preloaded.
  useEffect(() => {
    if (!slides.length || (phase === 'idle' && !ready)) return;
    const wanted: string[] = [];
    for (const s of [slides[index], slides[index + 1]]) if (s && (s.type === 'photo' || s.type === 'video')) wanted.push(s.moment.storage_path, ...(s.moment.poster_path ? [s.moment.poster_path] : []));
    if (playlist[track]) wanted.push(playlist[track].storage_path);
    wanted.forEach(path => { void resolve(path).then(url => { if (/\.webp$/.test(path)) { const img = new Image(); img.src = url; } }).catch(e => setError(errorMessage(e))); });
  }, [slides, index, playlist, track, resolve, phase, ready, generation]);
  // Keep the previous slide underneath for a moment so photos cross-fade over each other.
  useEffect(() => {
    if (phase === 'idle') { shown.current = null; setOutgoing(null); return; }
    const previous = shown.current; shown.current = index;
    if (previous === null || previous === index) return;
    setOutgoing(previous); const timer = setTimeout(() => setOutgoing(null), 700);
    return () => clearTimeout(timer);
  }, [index, phase]);

  async function prepare() {
    if (!hasCache()) { setError('Este navegador no permite guardar una copia local. Usa Chrome o Edge en el notebook.'); return; }
    setError(''); setPreparing({ done: 0, total: paths.length });
    try {
      const cache = await caches.open(CACHE_NAME);
      for (const request of await cache.keys()) if (!paths.some(p => request.url.endsWith(cacheKey(p)))) await cache.delete(request);
      let done = 0;
      for (const path of paths) {
        if (!(await cache.match(cacheKey(path)))) {
          const { data, error } = await db().storage.from('moments').createSignedUrl(path, 600); if (error) throw error;
          const response = await fetch(data.signedUrl); if (!response.ok) throw new Error(`No se pudo descargar ${path}.`);
          const blob = await response.blob();
          await cache.put(cacheKey(path), new Response(blob, { headers: { 'Content-Type': blob.type || response.headers.get('content-type') || 'application/octet-stream', 'Content-Length': String(blob.size) } }));
        }
        setPreparing({ done: ++done, total: paths.length });
      }
      await checkCache(paths); resetUrls();
    } catch (e) { setError(errorMessage(e)); }
    finally { setPreparing(null); }
  }
  async function forget() { if (hasCache()) await caches.delete(CACHE_NAME); setCached(new Set()); resetUrls(); }

  const next = useCallback(() => { setIndex(i => { if (i + 1 < slides.length) return i + 1; if (loop) return 0; setPhase('ended'); return i; }); }, [slides.length, loop]);
  const prev = useCallback(() => { setIndex(i => Math.max(0, i - 1)); }, []);
  async function start() {
    setError('');
    try {
      const first = slides[1]; if (first && (first.type === 'photo' || first.type === 'video')) await resolve(first.moment.storage_path);
      if (playlist[0]) { await resolve(playlist[0].storage_path); }
      remaining.current = null; setIndex(0); setTrack(0); setPhase('playing');
      if (tv && stage.current && !document.fullscreenElement) await stage.current.requestFullscreen().catch(() => undefined);
    } catch (e) { setError(errorMessage(e)); }
  }
  // Timed slides: photos, titles, wishes. Videos advance when they end.
  useEffect(() => {
    if (phase !== 'playing') return;
    const duration = slideDuration(slide); if (duration === null) return;
    // A pause keeps the time left for this slide only; a new slide always starts fresh.
    const wait = remaining.current?.index === index ? remaining.current.left : duration; const startedAt = Date.now();
    const timer = setTimeout(next, wait);
    return () => { clearTimeout(timer); remaining.current = { index, left: Math.max(0, wait - (Date.now() - startedAt)) }; };
  }, [phase, slide, index, next]);
  useEffect(() => { if (slide.type !== 'video') return; const el = video.current; if (!el) return; if (phase === 'playing') void el.play().catch(() => undefined); else el.pause(); }, [phase, slide, index]);
  // Background music carries the whole show; videos play muted underneath it.
  const ducked = false;
  const trackUrl = playlist[track] ? urls[playlist[track].storage_path] : undefined;
  useEffect(() => {
    const el = music.current; if (!el || !trackUrl) return;
    if (el.src !== trackUrl) { el.src = trackUrl; el.load(); }
    if (phase === 'playing') void el.play().catch(() => undefined); else el.pause();
  }, [trackUrl, phase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'idle' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ') { e.preventDefault(); setPhase(p => p === 'playing' ? 'paused' : 'playing'); }
      else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); else if (e.key.toLowerCase() === 'f') void toggleFullscreen();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [phase, next, prev]);
  useEffect(() => { const sync = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync); }, []);
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen(); }
  function wake() { setControls(true); clearTimeout(controlsTimer.current); controlsTimer.current = setTimeout(() => setControls(false), 3000); }

  const progress = slides.length > 1 ? Math.round((index / (slides.length - 1)) * 100) : 0;
  // The same keyed node is reused when a slide becomes the outgoing layer, so a photo keeps its
  // motion and a video its last frame while the next slide fades in over it.
  const renderSlide = (i: number, current: boolean) => {
    const s = slides[i]; const url = s.type === 'photo' || s.type === 'video' ? urls[s.moment.storage_path] : undefined; const poster = s.type === 'video' && s.moment.poster_path ? urls[s.moment.poster_path] : undefined;
    return <div className={current ? 'levels-slide' : 'levels-slide is-outgoing'} key={i} data-type={s.type} data-outgoing={current ? undefined : 'true'} aria-hidden={!current}>
      {s.type === 'title' && <div className="levels-card levels-title"><span className="levels-ring" /><span className="levels-kicker">SANTIAGO</span><h1>Niveles<br />anteriores</h1><p>Del nivel 1 al 6 · rumbo al nivel 7</p></div>}
      {s.type === 'photo' && (url ? <><img className="levels-backdrop" src={url} alt="" aria-hidden="true" /><img className={`levels-photo kb-${i % 4}`} src={url} alt={s.moment.caption || `Momento ${s.index + 1}`} /></> : <div className="levels-loading"><LoaderCircle className="spin" /></div>)}
      {s.type === 'video' && poster && <img className="levels-backdrop" src={poster} alt="" aria-hidden="true" />}
      {s.type === 'video' && (url ? <video ref={current ? video : undefined} className="levels-video" src={url} poster={poster} playsInline autoPlay muted onEnded={current ? next : undefined} onError={() => setError('No se pudo reproducir un video. Revisa la copia local o la conexión.')} /> : <div className="levels-loading"><LoaderCircle className="spin" /></div>)}
      {(s.type === 'photo' || s.type === 'video') && <div className="levels-caption"><span>{s.index + 1} / {s.total}</span>{s.moment.caption && <strong>{s.moment.caption}</strong>}</div>}
      {s.type === 'wishes-title' && <div className="levels-card levels-title"><span className="levels-kicker">CAPÍTULO FINAL</span><h1>Lo que dijeron<br />los invitados</h1><p>{s.count} {s.count === 1 ? 'mensaje' : 'mensajes'} al confirmar</p></div>}
      {s.type === 'wish' && <div className="levels-card levels-wish"><blockquote>«{s.wish.note}»</blockquote><cite>— {s.wish.family_name}</cite><small>{s.index + 1} / {s.total}</small></div>}
      {s.type === 'outro' && <div className="levels-card levels-title levels-outro"><span className="levels-kicker">¡AHORA ES TU TURNO!</span><h1>Sube tu momento<br />de hoy</h1><p>Abre tu invitación → <strong>Recuerdos</strong> → <strong>Publicar foto</strong></p><span className="levels-url">santiago.teolabs.app</span></div>}
    </div>;
  };
  if (loading) return <section className="section levels-page"><p>Cargando niveles anteriores…</p></section>;
  return <section className="section levels-page">
    <div className="levels-heading"><div><span className="eyebrow">NIVELES ANTERIORES</span><h2>Del nivel 1 al 6</h2><p>La historia de Santiago hasta hoy, para proyectar en la fiesta y abrir el álbum de recuerdos.</p></div>
      {moments.length > 0 && <div className="levels-summary"><span><b>{stats.photos}</b> fotos</span><span><b>{stats.videos}</b> videos · {mmss(stats.videoMs)}</span><span><b>{stats.music}</b> canciones</span><span><b>{wishes.length}</b> mensajes</span><span>≈ <b>{mmss(stats.runtimeMs)}</b> de historia · {megabytes(stats.bytes)}</span></div>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {moments.length === 0 ? <div className="card levels-empty"><HardDriveDownload size={30} /><h3>Todavía no hay niveles cargados</h3><p>Coloca las fotos y videos numerados (1.jpg, 2.mp4, 3.jpg…) y las canciones (1.mp3, 2.mp3…) en la carpeta <code>.local/niveles</code> del proyecto y ejecuta <code>npm run niveles</code>. Aquí aparecerá la presentación lista para el televisor.</p></div> : <>
      <div className={`levels-readiness ${ready ? 'ready' : ''}`} role="status">
        {preparing ? <><LoaderCircle className="spin" size={18} /><span>Guardando copia local… {preparing.done} de {preparing.total}</span><progress value={preparing.done} max={preparing.total} /></>
          : ready ? <><Download size={18} /><span><strong>Listo para la fiesta.</strong> Copia local guardada en este equipo ({megabytes(stats.bytes)}); se reproduce aunque no haya internet en el local.</span><button className="button button-quiet" onClick={() => void forget()}>Quitar copia</button></>
          : <><Download size={18} /><span><strong>{cached.size ? `Faltan ${paths.length - cached.size} archivos por guardar.` : 'Aún no hay copia local.'}</strong> Descárgala en el equipo que conectarás al televisor para no depender del WiFi del local.</span><button className="button button-blue" onClick={() => void prepare()}>Preparar para la fiesta</button></>}
      </div>
      <div ref={stage} className={`levels-stage ${fullscreen ? 'is-fullscreen' : ''} ${controls || phase !== 'playing' ? 'show-controls' : 'hide-cursor'}`} onMouseMove={wake} onClick={() => { if (phase === 'playing' || phase === 'paused') { wake(); } }} aria-label="Presentación Niveles anteriores">
        <audio ref={music} preload="auto" onEnded={e => { const el = e.currentTarget; const following = playlist.length ? (track + 1) % playlist.length : 0; if (following === track) { el.currentTime = 0; void el.play().catch(() => undefined); } else setTrack(following); }} onTimeUpdate={e => { const el = e.currentTarget; el.volume = musicVolume(el.currentTime, el.duration, ducked); }} />
        {phase !== 'idle' && outgoing !== null && outgoing !== index && slides[outgoing] && renderSlide(outgoing, false)}
        {phase !== 'idle' && renderSlide(index, true)}
        {phase === 'idle' && <div className="levels-start"><span className="levels-ring" /><h3>Niveles anteriores</h3><p>{tv ? 'Modo TV: se reproduce en bucle a pantalla completa.' : 'Pulsa para comenzar con música.'}</p><button className="button button-yellow" onClick={() => void start()}><Play size={20} />Comenzar</button></div>}
        {phase === 'ended' && <div className="levels-start"><h3>Fin de los niveles anteriores</h3><p>¡Que empiece el nivel 7!</p><button className="button button-yellow" onClick={() => void start()}><RotateCcw size={20} />Volver a empezar</button></div>}
        {phase !== 'idle' && <div className="levels-controls" onClick={e => e.stopPropagation()}><div className="levels-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="levels-buttons"><button className="icon-button" aria-label="Anterior" onClick={prev} disabled={index === 0}><ChevronLeft /></button><button className="icon-button" aria-label={phase === 'playing' ? 'Pausar' : 'Reanudar'} onClick={() => setPhase(p => p === 'playing' ? 'paused' : 'playing')}>{phase === 'playing' ? <Pause /> : <Play />}</button><button className="icon-button" aria-label="Siguiente" onClick={next}><ChevronRight /></button><span>{index + 1} / {slides.length}</span>
            <label className="levels-loop"><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /><Tv size={15} />Bucle</label>
            <button className="icon-button" aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</button></div></div>}
      </div>
      <p className="form-note levels-help">Teclas: <b>espacio</b> pausa · <b>← →</b> cambia de momento · <b>F</b> pantalla completa. Para cambiar el contenido, actualiza la carpeta y vuelve a ejecutar <code>npm run niveles</code>; después pulsa «Preparar para la fiesta» otra vez.</p>
    </>}
  </section>;
}

