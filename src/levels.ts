// "Niveles anteriores": the organizer's retrospective slideshow for the party TV.
export type Moment = { id: string; kind: 'photo' | 'video' | 'music'; position: number; storage_path: string; poster_path: string | null; caption: string; duration_ms: number; width: number | null; height: number | null; bytes: number };
export type Wish = { family_name: string; note: string };
export type Slide =
  | { type: 'title' }
  | { type: 'photo'; moment: Moment; index: number; total: number }
  | { type: 'video'; moment: Moment; index: number; total: number }
  | { type: 'wishes-title'; count: number }
  | { type: 'wish'; wish: Wish; index: number; total: number }
  | { type: 'outro' };
export const TITLE_MS = 4000; export const PHOTO_MS = 4000; export const WISHES_TITLE_MS = 3500; export const WISH_MS = 6500; export const OUTRO_MS = 12000;
export const CACHE_NAME = 'niveles-anteriores-v1';
export const cacheKey = (path: string) => `/niveles-cache/${path}`;

export function mediaOf(moments: Moment[]) { return moments.filter(m => m.kind !== 'music').sort((a, b) => a.position - b.position); }
export function musicOf(moments: Moment[]) { return moments.filter(m => m.kind === 'music').sort((a, b) => a.position - b.position); }
export function assetPaths(moments: Moment[]) { return moments.flatMap(m => [m.storage_path, ...(m.poster_path ? [m.poster_path] : [])]); }

/** The full running order: title → photos and videos → guests' wishes → call to upload. */
export function buildShow(moments: Moment[], wishes: Wish[]): Slide[] {
  const media = mediaOf(moments);
  const slides: Slide[] = [{ type: 'title' }];
  media.forEach((moment, index) => slides.push({ type: moment.kind === 'video' ? 'video' : 'photo', moment, index, total: media.length }));
  const notes = wishes.filter(w => w.note.trim()).map(w => ({ family_name: w.family_name, note: w.note.trim() }));
  if (notes.length) { slides.push({ type: 'wishes-title', count: notes.length }); notes.forEach((wish, index) => slides.push({ type: 'wish', wish, index, total: notes.length })); }
  slides.push({ type: 'outro' });
  return slides;
}
/** Milliseconds a slide stays on screen; null means "until the video ends". */
export function slideDuration(slide: Slide): number | null {
  switch (slide.type) {
    case 'title': return TITLE_MS;
    case 'photo': return PHOTO_MS;
    case 'video': return null;
    case 'wishes-title': return WISHES_TITLE_MS;
    case 'wish': return Math.min(WISH_MS + Math.ceil(slide.wish.note.length / 40) * 1000, 14000);
    case 'outro': return OUTRO_MS;
  }
}
export function showStats(moments: Moment[]) {
  const media = mediaOf(moments); const music = musicOf(moments);
  return {
    photos: media.filter(m => m.kind === 'photo').length,
    videos: media.filter(m => m.kind === 'video').length,
    videoMs: media.filter(m => m.kind === 'video').reduce((n, m) => n + m.duration_ms, 0),
    music: music.length,
    bytes: moments.reduce((n, m) => n + m.bytes, 0),
    runtimeMs: media.reduce((n, m) => n + (m.kind === 'video' ? m.duration_ms : PHOTO_MS), TITLE_MS),
  };
}
export function mmss(ms: number) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export function megabytes(bytes: number) { return `${(bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)} MB`; }
/** Music volume: fades at track edges; `ducked` lowers it under other audio when wanted. */
export function musicVolume(time: number, duration: number, ducked: boolean, base = 0.9) {
  const fade = Number.isFinite(duration) && duration > 0 ? Math.max(0, Math.min(1, time / 2, (duration - time) / 2)) : 1;
  return Math.max(0, Math.min(1, base * fade * (ducked ? 0.12 : 1)));
}
