import { db } from './supabase';
import type { Photo } from './domain';

export async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) throw new Error('Elige una foto JPG, PNG, WebP o HEIC. No se permiten videos.');
  if (file.size > 25 * 1024 * 1024) throw new Error('La foto supera los 25 MB. Elige una más pequeña.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    try { await img.decode(); } catch { throw new Error('El teléfono no pudo leer esta foto. Si es HEIC, expórtala como JPG e inténtalo de nuevo.'); }
    const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No pudimos preparar la foto en este navegador.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('No pudimos reducir la foto. Prueba con otra imagen.');
    return blob;
  } finally { URL.revokeObjectURL(objectUrl); }
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
// Export every page, not just the photos currently visible in the feed. Split large
// albums into small archives so the browser does not hold the whole album in RAM.
export async function exportAlbum(progress: (text: string) => void) {
  const { zipSync } = await import('fflate');
  let offset = 0; let part = 1; let count = 0;
  for (;;) {
    const { data, error } = await db().from('photos').select('*').order('created_at').order('id').range(offset, offset + 19);
    if (error) throw error;
    if (!data?.length) break;
    const entries: Record<string, Uint8Array> = {};
    for (const photo of data as Photo[]) {
      progress(`Preparando foto ${++count}…`);
      const { data: blob, error: fetchError } = await db().storage.from('memories').download(photo.storage_path);
      if (fetchError || !blob) throw fetchError ?? new Error('No se pudo descargar una foto.');
      entries[`${photo.created_at.slice(0, 10)}-${photo.id}.jpg`] = new Uint8Array(await blob.arrayBuffer());
    }
    const zip = zipSync(entries, { level: 0 });
    download(new Blob([new Uint8Array(zip).buffer], { type: 'application/zip' }), `santiago-nivel-7-parte-${part++}.zip`);
    offset += data.length;
    if (data.length < 20) break;
  }
  return count;
}
