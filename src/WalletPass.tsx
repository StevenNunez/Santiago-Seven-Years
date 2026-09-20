import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';

export default function WalletPass({ token, preview }: { token: string | null; preview: boolean }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/wallet', { cache: 'no-store', signal: controller.signal }).then(r => r.json()).then(data => setAvailable(data.available === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  async function prepare() {
    if (!token || preview || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(45000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos preparar el pase.');
      setUrl(data.shareUrl);
    } catch (e) { setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'La preparación está tardando. Vuelve a abrir tu pase en unos minutos.'); }
    finally { setBusy(false); }
  }
  return <div className="wallet-row"><Wallet size={20} /><span>Tu invitación en Apple Wallet o Google Wallet</span>
    {preview ? <span className="wallet-pending">El invitado podrá guardar su pase personal. Esta vista no genera pases.</span>
      : !available ? <span className="wallet-pending">Tu pase estará disponible pronto</span>
        : !token ? <span className="wallet-pending">Abre tu enlace personal para guardar el pase</span>
          : url ? <a className="wallet-button" href={url} target="_blank" rel="noopener noreferrer">Guardar en mi Wallet</a>
            : <button className="wallet-button" disabled={busy} onClick={() => void prepare()}>{busy ? 'Preparando tu pase…' : 'Preparar mi pase personal'}</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {url && <small role="status">¡Listo! Elige guardar tu pase. Conserva su QR y código para ti.</small>}
  </div>;
}
