import { describe, expect, it } from 'vitest';
import { assetPaths, buildShow, mediaOf, mmss, musicOf, musicVolume, showStats, slideDuration, PHOTO_MS, TITLE_MS, WISH_MS } from '../src/levels';
import type { Moment } from '../src/levels';

const moment = (over: Partial<Moment>): Moment => ({ id: over.storage_path ?? 'x', kind: 'photo', position: 1, storage_path: 'niveles/001.webp', poster_path: null, caption: '', duration_ms: 0, width: 1920, height: 1080, bytes: 200_000, ...over });
const moments = [
  moment({ kind: 'video', position: 2, storage_path: 'niveles/002.mp4', poster_path: 'niveles/002.poster.webp', duration_ms: 42_000, bytes: 5_000_000 }),
  moment({ kind: 'music', position: 1, storage_path: 'musica/001.m4a', duration_ms: 180_000, bytes: 1_400_000, caption: 'Jurassic World' }),
  moment({ kind: 'photo', position: 1, storage_path: 'niveles/001.webp', caption: 'Nivel 1 · 2020' }),
  moment({ kind: 'photo', position: 3, storage_path: 'niveles/003.webp' }),
];
describe('niveles anteriores', () => {
  it('orders photos and videos by position and keeps music apart', () => {
    expect(mediaOf(moments).map(m => m.storage_path)).toEqual(['niveles/001.webp', 'niveles/002.mp4', 'niveles/003.webp']);
    expect(musicOf(moments).map(m => m.caption)).toEqual(['Jurassic World']);
    expect(assetPaths(moments)).toContain('niveles/002.poster.webp');
  });
  it('builds the running order: title, moments, wishes chapter, call to upload', () => {
    const show = buildShow(moments, [{ family_name: 'Familia Rojas', note: '¡Felices 7, campeón!' }, { family_name: 'Sin mensaje', note: '   ' }]);
    expect(show.map(s => s.type)).toEqual(['title', 'photo', 'video', 'photo', 'wishes-title', 'wish', 'outro']);
    const wish = show[5]; expect(wish.type === 'wish' && wish.wish.family_name).toBe('Familia Rojas');
    const first = show[1]; expect(first.type === 'photo' && first.index === 0 && first.total === 3).toBe(true);
  });
  it('skips the wishes chapter when nobody left a note', () => {
    expect(buildShow(moments, []).map(s => s.type)).toEqual(['title', 'photo', 'video', 'photo', 'outro']);
  });
  it('times slides and lets videos run to their end', () => {
    const show = buildShow(moments, [{ family_name: 'A', note: 'x'.repeat(200) }]);
    expect(slideDuration(show[0])).toBe(TITLE_MS); expect(slideDuration(show[1])).toBe(PHOTO_MS); expect(slideDuration(show[2])).toBeNull();
    const long = show.find(s => s.type === 'wish')!; expect(slideDuration(long)).toBeGreaterThan(WISH_MS); expect(slideDuration(long)).toBeLessThanOrEqual(14000);
  });
  it('summarises the show for the organizer', () => {
    const stats = showStats(moments);
    expect(stats).toMatchObject({ photos: 2, videos: 1, music: 1, videoMs: 42_000, bytes: 6_800_000 });
    expect(stats.runtimeMs).toBe(TITLE_MS + 2 * PHOTO_MS + 42_000);
    expect(mmss(42_000)).toBe('0:42'); expect(mmss(125_400)).toBe('2:05');
  });
  it('fades music at track edges and ducks it under videos', () => {
    expect(musicVolume(0, 180, false)).toBe(0); expect(musicVolume(1, 180, false)).toBeCloseTo(0.45); expect(musicVolume(90, 180, false)).toBeCloseTo(0.9);
    expect(musicVolume(179, 180, false)).toBeCloseTo(0.45); expect(musicVolume(90, 180, true)).toBeCloseTo(0.108);
    expect(musicVolume(5, NaN, false)).toBeCloseTo(0.9);
  });
});
