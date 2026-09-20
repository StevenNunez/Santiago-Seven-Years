import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { db, errorMessage } from './supabase';
import type { Profile } from './domain';
import PwaButton from './PwaButton';

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
function applicationKey(value: string) {
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}
export default function PushPreferences({ profile }: { profile: Profile }) {
  const [subscriptionId, setSubscriptionId] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void navigator.serviceWorker.ready.then(async registration => {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      const { data } = await db().from('push_subscriptions').select('id').eq('endpoint', subscription.endpoint).eq('user_id', profile.user_id).maybeSingle();
      if (alive) setSubscriptionId(data?.id ?? '');
    }).catch(() => {});
    return () => { alive = false; };
  }, [supported, profile.user_id]);
  async function enable() {
    setBusy(true); setError(''); setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permite las notificaciones en los ajustes del navegador o de esta app para activar los avisos.');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) });
      const keys = subscription.toJSON().keys!;
      const { data, error } = await db().from('push_subscriptions').upsert({ user_id: profile.user_id, endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' }).select('id').single();
      if (error) throw new Error('No pudimos vincular este teléfono. Si ya lo usa otra invitación, desactiva sus avisos primero.');
      setSubscriptionId(data.id); setMessage('¡Listo! Te avisaremos cuando falten 5, 3 y 1 días, el cumpleaños y el día de la fiesta.');
      registration.active?.postMessage({ type: 'SANTIAGO_OPEN', path: location.pathname + location.search });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setError('');
    try {
      const { error } = await db().from('push_subscriptions').delete().eq('id', subscriptionId).eq('user_id', profile.user_id);
      if (error) throw error;
      const registration = await navigator.serviceWorker.ready;
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      setSubscriptionId(''); setMessage('Recordatorios desactivados en este teléfono.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await db().auth.getSession();
      const response = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify({ subscriptionId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No pudimos enviar la prueba.');
      setMessage('Aviso enviado a este teléfono. Revisa tus notificaciones.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <aside className="push-card"><div className="push-card-heading">{subscriptionId ? <BellRing size={26} /> : <Bell size={26} />}<h3>¡Que no se te pase la fiesta!</h3></div><p>Santiago cumple 7 el 25 de septiembre y celebramos el sábado 26. Recibe los recordatorios en este teléfono.</p>
    {ios && !installed ? <><p>En iPhone, agrega primero la invitación a la pantalla de inicio. Ábrela desde su ícono y activa aquí los avisos.</p><PwaButton /></> : !supported ? <p>Este navegador no admite avisos push. Abre la invitación en un navegador actualizado o agrégala a tu pantalla de inicio.</p> : !publicKey ? <p>Los recordatorios estarán disponibles pronto.</p> : <div className="button-row">{subscriptionId ? <><button className="button button-blue" disabled={busy} onClick={() => void test()}>Probar en este teléfono</button><button className="button button-quiet" disabled={busy} onClick={() => void disable()}>Desactivar avisos</button></> : <button className="button button-blue" disabled={busy} onClick={() => void enable()}><Bell size={17} />{busy ? 'Activando…' : 'Activar recordatorios'}</button>}</div>}
    <small>Con tu permiso. El indicador en el ícono depende del teléfono y sus ajustes. Los avisos se envían por la mañana, hora de Chile.</small>{message && <p className="success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </aside>;
}
