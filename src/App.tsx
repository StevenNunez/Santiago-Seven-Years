import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, BookOpen, CalendarDays, Camera, Check, ChevronRight, Gamepad2, Heart, Image, ShieldCheck, Ticket, Users, Zap } from 'lucide-react';
import { useParty } from './useParty';
import { GuestGate, PersonalAlbumGate, RsvpForm } from './GuestForms';
import { useInvitation } from './useInvitation';
import PwaButton from './PwaButton';
import WalletPass from './WalletPass';
import PushPreferences from './PushPreferences';
import Countdown from './Countdown';
import Adventure from './Adventure';
import InvitationPass from './InvitationPass';
import CharacterMoment from './CharacterMoment';
import { useRingSound } from './useRingSound';
import EntrySplash from './EntrySplash';
import InteractiveLogo from './InteractiveLogo';
import ArrivalButton from './ArrivalButton';
import { niceDate, uploadState } from './domain';
import { download } from './photos';
import { errorMessage, supabase } from './supabase';
const Feed = lazy(() => import('./Feed'));
const Admin = lazy(() => import('./Admin'));
const LevelsShow = lazy(() => import('./LevelsShow'));
type Tab = 'invitation' | 'memories' | 'admin' | 'levels';
// Organizer-only routes never open from a guest link or preview.
function tabFromHash(hash: string, guestView: boolean): Tab { if (!guestView && hash === '#organizar') return 'admin'; if (!guestView && hash === '#niveles') return 'levels'; return hash === '#recuerdos' ? 'memories' : 'invitation'; }

export default function App() {
  const account = useParty();
  const audio = useRingSound();
  const [entryDone, setEntryDone] = useState(false);
  const dismissEntry = useCallback(() => setEntryDone(true), []);
  const personal = useInvitation();
  const [response, setResponse] = useState<boolean | null>(null);
  const confirmed = response ?? personal.invitation?.attending === true;
  const guestView = Boolean(personal.token) || personal.preview;
  const party = { ...account,
    profile: personal.preview ? null : account.profile,
    details: personal.token ? personal.invitation : account.details,
    loading: account.loading || personal.loading,
  };
  const [tab, setTab] = useState<Tab>(tabFromHash(location.hash, guestView));
  const [now, setNow] = useState(Date.now()); const [online, setOnline] = useState(navigator.onLine); const [notice, setNotice] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const connectivity = () => setOnline(navigator.onLine);
    const hash = () => { setTab(tabFromHash(location.hash, guestView)); };
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity); window.addEventListener('hashchange', hash);
    return () => { clearInterval(timer); window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); window.removeEventListener('hashchange', hash); };
  }, [guestView]);
  function navigate(next: Tab) { setTab(next); location.hash = next === 'admin' ? 'organizar' : next === 'levels' ? 'niveles' : next === 'memories' ? 'recuerdos' : 'invitacion'; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const state = uploadState(party.event, now);
  function calendar() {
    const escape = (s: string) => s.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
    const stamp = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const start = party.event.starts_at;
    const dates = start ? [`DTSTART:${stamp(start)}`, ...(party.event.ends_at ? [`DTEND:${stamp(party.event.ends_at)}`] : [])] : ['DTSTART;VALUE=DATE:20260926', 'DTEND;VALUE=DATE:20260927'];
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TeoLabs//Santiago7//ES', 'BEGIN:VEVENT', 'UID:santiago7-20260926@teolabs.app', `DTSTAMP:${stamp(new Date().toISOString())}`, ...dates, 'SUMMARY:¡Santiago cumple 7! Fiesta de cumpleaños', `LOCATION:${escape(party.details?.address || 'Lugar por confirmar')}`, 'DESCRIPTION:Te esperamos en santiago.teolabs.app', 'URL:https://santiago.teolabs.app', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'santiago-nivel-7.ics');
  }
  const arrivalOpen = Boolean(party.event.starts_at && party.event.ends_at && now >= Date.parse(party.event.starts_at) && now < Date.parse(party.event.ends_at));
  const hasAlbum = party.profile?.role === 'admin' || party.profile?.album_verified === true;
  const previewEntrance = personal.preview ? new URLSearchParams(location.search).get('entrance') : null;
  const welcome = previewEntrance ? previewEntrance === 'welcome' : personal.invitation?.attending === true || now >= Date.parse(party.event.uploads_open_at);
  return <>{!entryDone && tab !== 'admin' && tab !== 'levels' && party.loading && <div className="entry-loading" role="status"><span className="seal-ring">7</span><p>Preparando tu invitación…</p></div>}{!entryDone && tab !== 'admin' && tab !== 'levels' && !party.loading && !personal.error && <EntrySplash name={personal.invitation?.recipient_name ?? party.profile?.display_name} welcome={welcome} audio={audio} onDone={dismissEntry} />}<a className="skip-link" href="#main">Ir al contenido</a>
    <header className="site-header"><div className="nav-inner"><a className="brand" href="#invitacion" onClick={() => navigate('invitation')} aria-label="Santiago nivel 7, inicio"><span className="brand-mark">S<span>7</span></span><span>SANTIAGO<small>UNA AVENTURA NIVEL 7</small></span></a><nav aria-label="Navegación principal"><button aria-current={tab === 'invitation' ? 'page' : undefined} className={tab === 'invitation' ? 'nav-link nav-dup active' : 'nav-link nav-dup'} onClick={() => navigate('invitation')}><Ticket size={17} />La invitación</button><button aria-current={tab === 'memories' ? 'page' : undefined} className={tab === 'memories' ? 'nav-link nav-dup active' : 'nav-link nav-dup'} onClick={() => navigate('memories')}><BookOpen size={17} />Recuerdos</button>{!guestView && party.profile?.role === 'admin' && <button className="nav-link" onClick={() => navigate('admin')}>Organizar</button>}</nav><a className="nav-rsvp" href={confirmed ? '#mi-wallet' : '#confirmar'} onClick={() => setTab('invitation')}>{confirmed ? 'Mi pase' : '¡Voy a la fiesta!'}<ArrowRight size={16} /></a></div></header>
    {!online && <div className="offline" role="status">Estás sin conexión. Puedes ver la invitación guardada; vuelve a conectarte para confirmar o compartir fotos.</div>}
    {!personal.preview && personal.error && <div className="guest-preview-banner link-error-banner" role="alert"><div><strong>Este enlace de invitación no funciona</strong><span>{personal.error}</span></div></div>}
    {personal.preview && <div className="guest-preview-banner" role="status"><div><strong>Vista como invitado{personal.invitation ? ' · ' + personal.invitation.recipient_name : ''}</strong><span>Puedes recorrer la invitación y probar el formulario. No se guardarán respuestas.</span></div><a href="/#organizar" className="button button-white">Volver al panel</a></div>}
    <main id="main">
      {tab !== 'admin' && !personal.preview && !personal.error && arrivalOpen && party.profile?.role !== 'admin' && (personal.invitation || party.profile) && <ArrivalButton token={personal.token} />}
      {tab === 'invitation' && <>
        <section className="hero"><div className="hero-grain" /><div className="hero-inner"><div className="hero-copy">{personal.invitation && <div className="personal-greeting">{confirmed ? `¡${personal.invitation.recipient_name}, nos vemos en la fiesta!` : `¡${personal.invitation.recipient_name}, estás invitado a mi cumpleaños!`}</div>}<div className="hero-kicker"><span className="live-dot" />UNA FIESTA A TODA VELOCIDAD</div><h1>¡Santiago<br /><span className="hero-level-line">llega al <span><i className="hero-level-word">nivel 7!<span className="title-star">✦</span></i></span></span></h1><p className="hero-description">Anillos, amigos y una aventura increíble.<br />{confirmed ? '¡Qué alegría celebrar contigo!' : '¡Solo faltas tú para hacerla inolvidable!'}</p><div className="hero-date"><CalendarDays size={19} /><span>Sábado <b>26 de septiembre</b><span className="date-year"> · 2026</span></span></div><a href="#confirmar" className="button button-yellow">{confirmed ? 'Ver mi confirmación' : '¡Me sumo a la aventura!'}<ArrowRight size={19} /></a><div className="hero-footnote"><span className="tiny-ring" />Santiago Nuñez cumple 7. ¡Y lo celebramos contigo!</div></div><div className="hero-art"><img src="/sonic-hero.webp" alt="Sonic corre entre anillos dorados y las colinas de Green Hill" width={1100} height={1100} fetchPriority="high" /><div className="level-badge"><span>LEVEL UP!</span><strong>7</strong><small>AÑOS DE AVENTURAS</small></div><div className="art-caption"><Zap size={16} fill="currentColor" /> ¡PREPÁRATE PARA LA DIVERSIÓN!</div></div></div><a className="hero-scroll" href="#detalles" aria-label="Ver detalles de la fiesta"><ArrowDown size={18} /></a></section>
        <div className="ticker" aria-hidden="true"><div>★ AMIGOS <span>◎</span> AVENTURAS <span>◎</span> TORTA <span>◎</span> DIVERSIÓN <span>◎</span> NIVEL 7 <span>◎</span> AMIGOS <span>◎</span> AVENTURAS <span>◎</span> TORTA <span>◎</span> DIVERSIÓN ★</div></div>
        <InvitationPass confirmed={confirmed} name={personal.invitation?.recipient_name} event={party.event} details={party.details} calendar={calendar} audio={audio} code={personal.invitation?.access_code} />
        <Countdown event={party.event} />
        <section className="rsvp-section" id="confirmar"><div className="rsvp-inner"><div className="rsvp-copy"><span className="eyebrow">{confirmed ? 'TU EQUIPO YA ESTÁ CONFIRMADO' : 'PLAYER 2, ¿TE SUMAS?'}</span><h2>Esta aventura<br />es mejor <span>contigo.</span></h2><p>{confirmed ? 'Tu lugar está reservado. Guarda tu pase y prepárate para celebrar los 7 años de Santiago.' : 'Nos encantaría contar con tu equipo para celebrar los 7 años de Santiago.'}</p><div className="rsvp-perks"><span><Check size={18} />{confirmed ? 'Asistencia confirmada' : 'Confirma por toda tu familia'}</span><span><Check size={18} />Guarda tu invitación en el teléfono</span><span><Check size={18} />Comparte recuerdos con la pandilla</span></div><CharacterMoment character="knuckles" name="Knuckles" messages={confirmed ? ["¡Equipo confirmado! Nos vemos en la fiesta.", "¡Tu pase está listo para acompañarte!"] : ["¡Este equipo tiene fuerza! Nos falta tu confirmación.", "Tú trae las ganas de jugar. ¡Santiago pone la fiesta!"]} /></div>{party.loading ? <div className="card gate"><p>Cargando tu invitación…</p></div> : personal.error ? <div className="card gate"><p className="form-error" role="alert">{personal.error}</p></div> : personal.invitation || personal.preview ? <RsvpForm onResponse={setResponse} key={personal.invitation?.id ?? 'preview'} profile={party.profile} invitation={personal.invitation} token={personal.token} preview={personal.preview} onJoined={async () => { await party.refresh(); personal.refresh(); }} /> : party.profile ? <RsvpForm profile={party.profile} onResponse={setResponse} /> : <GuestGate onJoined={party.refresh} />}</div></section>
        {party.profile && !personal.preview && <PushPreferences profile={party.profile} />}
        <section className="pocket-section" id="mi-wallet"><div className="pocket-inner"><div className="pocket-silver"><img src="/characters/silver-clear-240.webp" width="90" height="150" alt="Silver acompaña tu pase" loading="lazy" decoding="async" /></div><div className="pocket-copy"><span className="eyebrow">LA FIESTA VA CONTIGO</span><h2>Un lugar en tu bolsillo.</h2><p>Agrega la invitación a tu inicio para volver en un toque.</p></div><PwaButton /></div><WalletPass token={personal.token} preview={personal.preview} /></section>
        <Adventure audio={audio} />
        <section className="section memories-teaser"><div className="memory-character"><CharacterMoment character="amy" name="Amy" messages={["¡Una foto juntos será el mejor recuerdo!", "El álbum abre el día de la fiesta. ¡Guarda tus sonrisas!"]} /></div><div className="memory-copy"><span className="eyebrow">LOS ANILLOS SE COLECCIONAN. LOS RECUERDOS TAMBIÉN.</span><h2>Un día épico.<br /><span className="blue-text">Mil momentos nuestros.</span></h2><p>El día de la fiesta, toma fotos, compártelas y deja un poquito de cariño en nuestro álbum. Cada mirada cuenta una parte de la aventura.</p><div className="memory-features"><span><Camera size={18} />Solo fotos</span><span><Heart size={18} />Comentarios y cariño</span><span><ShieldCheck size={18} />Solo invitados</span></div><button className="button button-blue" onClick={() => navigate('memories')}>Ir al álbum de recuerdos<ArrowRight size={18} /></button><small>Podrás subir fotos hasta el {niceDate(new Date(Date.parse(party.event.uploads_close_at) - 1).toISOString())}.</small></div></section>
      </>}
      {tab === 'memories' && <><section className="album-hero"><span className="eyebrow">NUESTRA COLECCIÓN FAVORITA</span><h1>Recuerdos <span>nivel 7.</span></h1><p>Las mejores aventuras se viven juntos. Y se recuerdan aquí.</p><span className="album-status"><span className="live-dot" />{state === 'open' ? party.event.album_test_mode ? 'Muro abierto para pruebas' : '¡El álbum está abierto!' : state === 'soon' ? `Abrimos el ${niceDate(party.event.uploads_open_at)}` : 'La aventura queda guardada'}</span></section><section className="section album-section">{party.event.album_test_mode && <div className="personal-code" role="status"><strong>Estamos probando el muro</strong><p>Ya puedes subir fotos, comentar y dejar corazones con tu invitación personal. Las publicaciones son reales y quedan visibles para los invitados hasta que su autor o la organización las eliminen.</p></div>}<div className="album-info"><Image size={19} /><p>Fotos y comentarios de nuestra pandilla. Puedes publicar hasta el <b>{niceDate(new Date(Date.parse(party.event.uploads_close_at) - 1).toISOString())}</b>.</p></div>{party.loading ? <p>Cargando…</p> : personal.preview ? <div className="empty-state"><Camera size={36} /><h3>Los recuerdos de nuestra pandilla</h3><p>El invitado encontrará aquí las fotos y comentarios de la fiesta. La vista previa no publica ni modifica recuerdos.</p></div> : personal.error ? <p className="form-error" role="alert">{personal.error}</p> : state === 'soon' && party.profile?.role !== 'admin' ? <div className="empty-state"><Camera size={36} /><h3>¡Los recuerdos abren el 26 de septiembre!</h3><p>El día de la fiesta podrás compartir tus fotos, comentar y dejar corazones.</p></div> : party.profile && hasAlbum ? <><Suspense fallback={<p>Cargando álbum…</p>}><Feed profile={party.profile} event={party.event} /></Suspense></> : personal.invitation && personal.token ? <PersonalAlbumGate token={personal.token} name={personal.invitation.recipient_name} onJoined={party.refresh} /> : <GuestGate onJoined={party.refresh} />}</section></>}
      {tab === 'admin' && !guestView && <Suspense fallback={<p className="section">Cargando organización…</p>}><Admin profile={party.profile} event={party.event} details={party.details} refresh={party.refresh} /></Suspense>}
      {tab === 'levels' && !guestView && (party.profile?.role === 'admin' ? <Suspense fallback={<p className="section">Cargando niveles anteriores…</p>}><LevelsShow tv={new URLSearchParams(location.search).get('tv') === '1'} /></Suspense> : party.loading ? <p className="section">Cargando…</p> : <section className="section"><div className="card gate"><p>«Niveles anteriores» es solo para la organización.</p><a className="button button-blue" href="#organizar">Entrar al panel</a></div></section>)}
      {party.error && <div className="connection-notice" role="alert">No pudimos actualizar la invitación. <button onClick={() => void party.refresh()}>Reintentar</button><small>{party.error}</small></div>}
      {notice && <p className="connection-notice" role="status">{notice}</p>}
    </main>
    <footer className="site-footer"><div className="footer-top"><span className="footer-title">SANTIAGO <span>7</span></span><span>Hecho con mucho cariño y un poquito de velocidad <Zap size={14} /></span><span>26.09.2026</span></div><div className="footer-bottom"><span className="teo-credit">Desarrollado por <a href="https://www.teolabs.app" target="_blank" rel="noopener noreferrer"><InteractiveLogo variant="footer-small" className="text-[14px]" /></a> ®</span><div>{party.profile && <><span>Hola, {party.profile.display_name}</span><button onClick={async () => { if (party.profile?.role !== 'admin' && !window.confirm('Al salir perderás el acceso a tu confirmación desde esta sesión. ¿Quieres continuar?')) return; try { const { error } = await supabase!.auth.signOut(); if (error) throw error; await party.refresh(); } catch (e) { setNotice(errorMessage(e)); } }}>Salir</button></>}{!guestView && <button onClick={() => navigate('admin')}>Organización<ChevronRight size={12} /></button>}</div></div></footer>
    <div className="mobile-nav"><button className={tab === 'invitation' ? 'selected' : ''} onClick={() => navigate('invitation')}><Gamepad2 size={21} />Invitación</button><a href="#confirmar" onClick={() => setTab('invitation')}><Users size={21} />{confirmed ? 'Mi asistencia' : 'Confirmar'}</a><button className={tab === 'memories' ? 'selected' : ''} onClick={() => navigate('memories')}><BookOpen size={21} />Recuerdos</button></div>
  </>;
}
