import { useEffect, useState } from 'react';
import { Check, Download, Share, X } from 'lucide-react';
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export default function PwaButton() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const ready = (e: Event) => { e.preventDefault(); setPrompt(e as InstallEvent); };
    const done = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done); };
  }, []);
  async function install() {
    if (!prompt) { setHelp(!help); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setHelp(false);
    setPrompt(null);
  }
  return <div className="install-wrap">
    <button className="button button-white" onClick={() => void install()} disabled={installed}>{installed ? <Check size={18} /> : <Download size={18} />}{installed ? 'Ya tienes tu acceso directo' : 'Agregar a mi inicio'}</button>
    {help && <div className="install-help" role="status"><button className="icon-button close-help" aria-label="Cerrar instrucciones" onClick={() => setHelp(false)}><X size={16} /></button><strong>Un acceso directo a la aventura</strong><p><b>iPhone:</b> abre esta página en Safari, toca Compartir <Share size={14} /> y «Agregar a inicio».</p><p><b>Android:</b> abre el menú de Chrome y elige «Instalar aplicación» o «Agregar a pantalla principal».</p></div>}
  </div>;
}
