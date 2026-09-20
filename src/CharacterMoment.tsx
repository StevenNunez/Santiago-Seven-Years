import { useState } from 'react';
export default function CharacterMoment({ character, name, messages }: { character: string; name: string; messages: string[] }) {
  const [message, setMessage] = useState(-1);
  const [reaction, setReaction] = useState(0);
  const asset = `${character}-clear`;
  return <div className={`character-moment moment-${character}`}>
    <button className="character-touch" aria-label={`Toca a ${name} para descubrir su mensaje`} onClick={() => { setMessage(v => (v + 1) % messages.length); setReaction(v => v + 1); }}>
      <div key={reaction} className={`character-stage ${reaction ? 'character-reacting' : ''}`}>
        <img src={`/characters/${asset}-480.webp`} srcSet={`/characters/${asset}-240.webp 240w, /characters/${asset}-480.webp 480w`} sizes="(max-width:700px) 150px, 220px" width="240" height="300" loading="lazy" decoding="async" alt={name} />
        {reaction > 0 && <div className="character-burst" aria-hidden="true">{[0,1,2,3,4].map(i => <i key={i}>{character === 'amy' ? '♥' : character === 'knuckles' ? '✦' : '◎'}</i>)}</div>}
      </div>
      <span>{message < 0 ? '¡Tócame!' : '¡Otra vez! ✦'}</span>
    </button>
    <p key={message} className="character-speech" role="status" aria-live="polite">{message < 0 ? `${name} también viene a la aventura.` : messages[message]}</p>
  </div>;
}
