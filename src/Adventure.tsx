import { memo, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { jump, newRun, RUN_SECONDS, stepRun } from './runner';
import type { useRingSound } from './useRingSound';
export default memo(function Adventure({ audio }: { audio: ReturnType<typeof useRingSound> }) {
  const run = useRef(newRun()); const [view, setView] = useState(newRun());
  const [mode, setMode] = useState<'ready' | 'playing' | 'paused' | 'finished'>('ready');
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('santiago-run-best')) || 0; } catch { return 0; } });
  const game = useRef<HTMLDivElement>(null); const swipe = useRef<{ x: number; y: number } | null>(null);
  const sound = useRef(audio.play); sound.current = audio.play;
  function move(direction: number) { if (mode === 'playing') run.current.lane = Math.max(0, Math.min(2, run.current.lane + direction)); }
  function start() { run.current = newRun(); setView({ ...run.current }); setMode('playing'); game.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    if (mode !== 'playing') return;
    let frame = 0; let previous = 0; let draw = 0;
    const tick = (time: number) => {
      const dt = previous ? (time - previous) / 1000 : 0; previous = time;
      if (stepRun(run.current, dt)) void sound.current();
      if (run.current.done) {
        setView({ ...run.current }); setMode('finished');
        setBest(old => { const next = Math.max(old, run.current.score); try { localStorage.setItem('santiago-run-best', String(next)); } catch { /* optional device record */ } return next; });
        void sound.current(true); return;
      }
      if (time - draw > 32) { setView({ ...run.current, items: run.current.items.map(item => ({ ...item })) }); draw = time; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const visibility = () => { if (document.hidden) setMode('paused'); };
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) setMode('paused'); });
    if (game.current) observer.observe(game.current);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); observer.disconnect(); };
  }, [mode]);
  return <section className="speed-section" aria-labelledby="speed-title"><div className="speed-heading"><span className="red-ribbon">UNA CARRERA ANTES DE LA FIESTA</span><h2 id="speed-title">¡A toda <em>velocidad!</em></h2><p>30 segundos. Tres carriles. ¿Cuántos anillos puedes llevar al cumpleaños?</p></div><div className="speed-cabinet"><div className="speed-hud"><span>ANILLOS <b>◎ {view.rings}</b></span><span>PUNTOS <b>{String(view.score).padStart(4, '0')}</b></span><span>TIEMPO <b>{Math.max(0, Math.ceil(RUN_SECONDS - view.elapsed))} s</b></span><span aria-label={`${view.lives} vidas`}>VIDAS <b className="run-lives">{'♥'.repeat(Math.max(0, view.lives))}</b></span></div>
    <div ref={game} className={`speed-world ${mode === 'playing' ? 'is-racing' : ''} ${view.hit > 0 ? 'run-hit' : ''}`} tabIndex={0} role="group" aria-label="Pista de carrera. Flechas izquierda y derecha para moverte, espacio para saltar, Escape para pausar." onKeyDown={e => { if (mode !== 'playing') return; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'Escape'].includes(e.key)) e.preventDefault(); if (e.key === 'ArrowLeft') move(-1); if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowUp' || e.key === ' ') jump(run.current); if (e.key === 'Escape') setMode('paused'); }} onPointerDown={e => { if (mode === 'playing') swipe.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={e => { if (!swipe.current || mode !== 'playing') return; const dx = e.clientX - swipe.current.x; const dy = e.clientY - swipe.current.y; swipe.current = null; if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else jump(run.current); }} onPointerCancel={() => { swipe.current = null; }}>
      <div className="speed-sun" /><div className="speed-mountains" /><div className="speed-road"><i /><i /></div><div className="track-edge edge-left" /><div className="track-edge edge-right" /><div className="finish-sign" aria-hidden="true">SANTIAGO <b>7</b></div>
      {view.items.filter(item => !item.checked).map(item => { const d = item.depth; return <span key={item.id} aria-hidden="true" className={`track-item track-${item.kind}`} style={{ left: `${50 + (item.lane - 1) * (5 + d * 27)}%`, top: `${28 + d * 60}%`, transform: `translate(-50%,-50%) scale(${.25 + d * 1.05})` }}>{item.kind === 'obstacle' ? '!' : ''}</span>; })}
      <div className={`runner-player ${view.jump > 0 ? 'player-jump' : ''}`} style={{ left: `${50 + (view.lane - 1) * 29}%` }} aria-hidden="true"><div className="player-aura" /><img src="/characters/sonic-clear-240.webp" alt="" width="70" height="94" loading="lazy" /><span className="player-trail" /></div>
      {mode !== 'playing' && <div className="run-overlay"><div>{mode === 'ready' ? <><span className="run-label">SANTIAGO · BIRTHDAY RUN</span><h3>La meta es <em>la fiesta.</em></h3><p>Recoge anillos, esquiva las barreras rojas y salta para superarlas.</p><img className="run-eggman" src="/characters/eggman-clear-240.webp" width="50" height="67" alt="Eggman prepara los obstáculos" loading="lazy" /><p className="run-rules">Anillo +100 · Salto sobre barrera +50<br />Choque −50 y una vida</p><button className="button button-yellow" onClick={start}><Play size={19} fill="currentColor" />¡Correr con Sonic!</button></> : mode === 'paused' ? <><h3>Tomamos aire.</h3><p>Tu carrera está en pausa.</p><button className="button button-yellow" onClick={() => { setMode('playing'); game.current?.focus({ preventScroll: true }); }}><Play size={18} />Continuar</button></> : <><span className="run-label">{view.lives ? '¡LLEGASTE A LA FIESTA!' : '¡BUENA CARRERA!'}</span><img className="run-super" src="/characters/super-sonic-clear-240.webp" width="75" height="105" alt="Super Sonic celebra tu carrera" loading="lazy" /><h3>{view.score}<small> puntos</small></h3><p>{view.rings} anillos para Santiago.<br />Tu récord en este teléfono: <b>{best}</b></p><button className="button button-yellow" onClick={start}><RotateCcw size={18} />Otra carrera</button><a className="run-rsvp" href="#confirmar">Ahora sí, ¡voy a la fiesta! →</a></>}</div></div>}
    </div><div className="run-controls"><button aria-label="Mover a la izquierda" disabled={mode !== 'playing'} onClick={() => move(-1)}><ArrowLeft /></button><button disabled={mode !== 'playing'} onClick={() => jump(run.current)}><ArrowUp size={20} />Saltar</button><button aria-label="Mover a la derecha" disabled={mode !== 'playing'} onClick={() => move(1)}><ArrowRight /></button><button aria-label="Pausar carrera" disabled={mode !== 'playing'} onClick={() => setMode('paused')}><Pause size={19} /></button></div><div className="run-foot"><span>Desliza para cambiar de carril · Toca para saltar<br />También puedes usar los botones o las flechas del teclado.</span><button onClick={audio.toggle} aria-label={audio.sound ? 'Silenciar sonido' : 'Activar sonido'} aria-pressed={audio.sound} disabled={audio.unavailable}>{audio.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button></div></div><p className="run-note">Una carrera hecha para el cumpleaños de Santiago, inspirada en el universo Sonic.</p></section>;
});
