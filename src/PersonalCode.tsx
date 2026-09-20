import { useState } from 'react';
import { formatGuestCode } from './invitations';
export default function PersonalCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="personal-code"><strong>Tu código personal para los recuerdos</strong><code>{formatGuestCode(code)}</code><p>Guárdalo. El día de la fiesta identifica a tu invitación y las fotos que compartas. No lo necesitas para confirmar.</p><button onClick={async () => { try { await navigator.clipboard.writeText(formatGuestCode(code)); setCopied(true); } catch { setCopied(false); } }} type="button">{copied ? '¡Código copiado!' : 'Copiar mi código'}</button></div>;
}
