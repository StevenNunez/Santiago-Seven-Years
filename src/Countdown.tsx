import { memo, useEffect, useState } from 'react';
import type { EventSettings } from './domain';
import { uploadState } from './domain';

export default memo(function Countdown({ event }: { event: EventSettings }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const resume = () => {
      clearInterval(timer);
      if (document.visibilityState !== 'hidden') {
        setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    resume(); document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, []);
  const seconds = Math.max(0, Math.floor((Date.parse(event.starts_at ?? event.uploads_open_at) - now) / 1000));
  const countdown = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  const state = uploadState(event, now);
  return <section className="countdown-section"><div><span className="eyebrow">{seconds ? 'CADA VEZ FALTA MENOS' : state === 'closed' ? 'UNA AVENTURA PARA RECORDAR' : '¡LLEGÓ NUESTRO GRAN DÍA!'}</span><h2>{seconds ? 'La aventura está por comenzar' : state === 'closed' ? 'Gracias por ser parte de mi nivel 7' : '¡Es hora de celebrar!'}</h2>{!event.starts_at && seconds > 0 && <small>Cuenta regresiva al día de la fiesta. Horario por confirmar.</small>}</div><div className="countdown" aria-label="Cuenta regresiva al cumpleaños">{countdown.map((value, i) => <div className="countdown-unit" key={i}><strong>{String(value).padStart(2, '0')}</strong><span>{['DÍAS', 'HORAS', 'MINUTOS', 'SEGUNDOS'][i]}</span></div>)}</div></section>;
});
