import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';

export type ToastMessage = { id: number; tone: 'success' | 'warning' | 'error'; title: string; detail?: string };
const icons = { success: CheckCircle2, warning: AlertTriangle, error: XCircle };
export default function Toast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!message || message.tone === 'error') return;
    const timer = setTimeout(onClose, 6500);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  const Icon = icons[message.tone];
  return <div className={`toast toast-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'} key={message.id}><Icon size={20} /><div><strong>{message.title}</strong>{message.detail && <span>{message.detail}</span>}</div><button className="icon-button" aria-label="Cerrar aviso" onClick={onClose}><X size={16} /></button></div>;
}
