import { db } from './supabase';
import type { Photo } from './domain';

// Two renditions per photo: the wall grid shows a small thumbnail and the full image only
// loads when a guest opens it. Keeps album egress inside the free Supabase quota on party day.
export const FULL_EDGE = 1600; export const THUMB_EDGE = 720;
export type PreparedPhoto = { full: Blob; thumb: Blob };
export function thumbPath(path: string) { return path.replace(/\.jpg$/, '.thumb.jpg'); }
function render(source: CanvasImageSource, width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No pudimos preparar la foto en este navegador.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function encode(canvas: HTMLCanvasElement, quality: number) {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('No pudimos reducir la foto. Prueba con otra imagen.');
  return blob;
}
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) throw new Error('Elige una foto JPG, PNG, WebP o HEIC. No se permiten videos.');
  if (file.size > 25 * 1024 * 1024) throw new Error('La foto supera los 25 MB. Elige una más pequeña.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    try { await img.decode(); } catch { throw new Error('El teléfono no pudo leer esta foto. Si es HEIC, expórtala como JPG e inténtalo de nuevo.'); }
    const full = render(img, img.naturalWidth, img.naturalHeight, FULL_EDGE);
    // Downscale the thumbnail from the full rendition (two steps keep it sharp).
    const thumb = render(full, full.width, full.height, THUMB_EDGE);
    return { full: await encode(full, 0.82), thumb: await encode(thumb, 0.75) };
  } finally { URL.revokeObjectURL(objectUrl); }
}
// Signed URLs change on every request and Supabase serves them with no-cache, so a fresh
// batch per refresh made every guest re-download the visible wall every 30 seconds.
// Reuse each URL until shortly before it expires so <img src> stays stable.
const SIGN_TTL = 3600; const signedCache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string | undefined>>();
export async function signedUrls(paths: string[]): Promise<Map<string, string | undefined>> {
  const now = Date.now(); const result = new Map<string, string | undefined>(); const waiting: [string, Promise<string | undefined>][] = [];
  const missing = [...new Set(paths)].filter(path => {
    const hit = signedCache.get(path); if (hit && hit.expires - now > 5 * 60_000) { result.set(path, hit.url); return false; }
    const pending = inflight.get(path); if (pending) { waiting.push([path, pending]); return false; }
    return true;
  });
  if (missing.length) {
    // Concurrent refreshes (focus + timer) share one signing request instead of racing.
    const batch = db().storage.from('memories').createSignedUrls(missing, SIGN_TTL).then(({ data, error }) => {
      if (error) throw error;
      const urls = new Map<string, string | undefined>();
      data.forEach((item, i) => { const path = item.path ?? missing[i]; if (item.signedUrl && !item.error) { signedCache.set(path, { url: item.signedUrl, expires: now + SIGN_TTL * 1000 }); urls.set(path, item.signedUrl); } });
      return urls;
    }).finally(() => { for (const path of missing) inflight.delete(path); });
    for (const path of missing) { const one = batch.then(urls => urls.get(path)); inflight.set(path, one); waiting.push([path, one]); }
  }
  for (const [path, promise] of waiting) result.set(path, await promise);
  return result;
}
export function forgetSignedUrls(paths: string[]) { for (const path of paths) signedCache.delete(path); }
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
