import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import type { useRingSound } from './useRingSound';
export default function EntrySplash({ name, welcome, onDone, audio }: { name?: string; welcome: boolean; onDone: () => void; audio: ReturnType<typeof useRingSound> }) {
  const [opening, setOpening] = useState(false); const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const focus = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (ready) { if (document.activeElement === dialog.current) focus.current?.focus(); return; }
    const timer = setTimeout(() => setReady(true), 2400);
    return () => clearTimeout(timer);
  }, [ready]);
  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => { setEntered(true); onDone(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 3000);
    return () => clearTimeout(timer);
  }, [opening, onDone]);
  if (entered) return null;
  return <div ref={dialog} tabIndex={-1} className={`entry-splash ${welcome ? 'entry-welcome' : 'entry-invitation'} ${opening ? 'entry-opening' : ''}`} role="dialog" aria-modal="true" aria-labelledby="entry-title" onKeyDown={e => { if (e.key === 'Escape') onDone(); if (e.key === 'Tab') { const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); const index = controls.indexOf(document.activeElement as HTMLButtonElement); e.preventDefault(); controls[(index + (e.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus(); } }}>
    <div className="entry-stars" aria-hidden="true">✦ <span>◎</span> ✦ <span>◎</span> ✧</div>
    <div className="entry-brand">SANTIAGO <b>7</b><span>{welcome ? 'LA AVENTURA CONTINÚA' : 'CORREO ESPECIAL · SOLO PARA TI'}</span></div>
    <div className="entry-stage" aria-hidden="true"><div className="entry-speedlines" /><div className="entry-envelope"><div className="envelope-back" /><div className="envelope-letter"><span>{welcome ? '¡BIENVENIDO!' : 'ESTÁS INVITADO'}</span><strong>{name || 'Tú y tu familia'}</strong><b>Santiago cumple 7</b></div><div className="envelope-front" /><div className="envelope-flap" /><div className="envelope-seal">7</div></div><div className="entry-sonic"><img src="/characters/sonic-clear-480.webp" alt="" width="160" height="226" fetchPriority="high" /></div><span className="entry-motion-ring ring-one" /><span className="entry-motion-ring ring-two" /><span className="entry-motion-ring ring-three" /></div>
    <div className="entry-copy"><span>{name ? `¡${name}!` : '¡Hola, qué bueno verte!'}</span><h1 id="entry-title">{welcome ? <>Bienvenido a mi<br /><em>cumpleaños.</em></> : <>Tengo una invitación<br /><em>especial para ti.</em></>}</h1><p>{welcome ? 'La pandilla te espera. ¡Vamos a celebrar y crear recuerdos!' : 'Sonic trae un sobre con tu nombre. ¿Lo abrimos juntos?'}</p></div>
    <button ref={focus} className="entry-open" disabled={opening || !ready} onClick={() => { void audio.play(true); setOpening(true); }}>{opening ? '¡Vamos a toda velocidad!' : welcome ? '¡Entrar a la aventura!' : 'Abrir mi invitación'}<ArrowRight size={20} /></button>
    <div className="entry-tools"><button onClick={audio.toggle} aria-pressed={audio.sound} disabled={audio.unavailable}>{audio.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}{audio.sound ? 'Sonido activado' : 'Activar sonido'}</button><button onClick={onDone}>Omitir animación →</button></div>
  </div>;
}
