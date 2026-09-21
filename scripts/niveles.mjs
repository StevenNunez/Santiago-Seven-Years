// Prepares and uploads the "Niveles anteriores" slideshow from a local folder.
//   npm run niveles              → reads .local/niveles
//   npm run niveles ./mi-carpeta
// Files are ordered by their leading number: 1.jpg, 2.mp4, 3.jpeg… (photos and videos share one
// sequence) and songs the same way: 1.mp3, 2.m4a… Optional captions in leyendas.txt as "3: Nivel 2 · 2021".
// Everything is re-encoded small before upload; the script is idempotent (unchanged files are skipped,
// removed files are deleted from Supabase) and warns when videos exceed the agreed 2 minutes.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseEnv, promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
const env = parseEnv(readFileSync('.env', 'utf8'));
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const folder = resolve(process.argv[2] ?? '.local/niveles');
const work = resolve('.local/niveles-out'); mkdirSync(work, { recursive: true });
const MAX_VIDEO_MS = 120_000;
const kinds = { photo: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'], video: ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'], music: ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'] };

function orderKey(name) { const m = /^(\d+)/.exec(name); return [m ? Number(m[1]) : Number.MAX_SAFE_INTEGER, name.toLowerCase()]; }
function byOrder(a, b) { const [na, sa] = orderKey(a), [nb, sb] = orderKey(b); return na - nb || sa.localeCompare(sb); }
function kindOf(file) { const ext = extname(file).toLowerCase(); return Object.keys(kinds).find(k => kinds[k].includes(ext)); }
function hashOf(file) { return createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10); }
function mmss(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function mb(bytes) { return `${(bytes / 1048576).toFixed(1)} MB`; }
async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_type', '-of', 'json', file]);
  const info = JSON.parse(stdout); const video = info.streams?.find(s => s.codec_type === 'video');
  return { durationMs: Math.round(Number(info.format?.duration ?? 0) * 1000), width: video?.width ?? null, height: video?.height ?? null };
}

if (!existsSync(folder)) { console.error(`No existe la carpeta ${folder}. Crea .local/niveles y coloca ahí las fotos, videos y canciones numerados.`); process.exit(1); }
const captions = new Map();
if (existsSync(join(folder, 'leyendas.txt'))) for (const line of readFileSync(join(folder, 'leyendas.txt'), 'utf8').split(/\r?\n/)) { const m = /^\s*(\d+)\s*[:=]\s*(.+?)\s*$/.exec(line); if (m) captions.set(Number(m[1]), m[2].slice(0, 200)); }
const files = readdirSync(folder).filter(f => kindOf(f)).sort(byOrder);
const media = files.filter(f => kindOf(f) !== 'music'); const music = files.filter(f => kindOf(f) === 'music');
if (!files.length) { console.error('La carpeta no tiene fotos, videos ni canciones. Nómbralos 1.jpg, 2.mp4, 3.jpg… y las canciones 1.mp3, 2.mp3…'); process.exit(1); }

// Desired state, derived only from the folder. Output names carry a content hash so a replaced file gets a new path.
const desired = [];
media.forEach((file, i) => { const kind = kindOf(file); const hash = hashOf(join(folder, file)); const n = String(i + 1).padStart(3, '0');
  desired.push({ kind, position: i + 1, file, hash, caption: captions.get(orderKey(file)[0]) ?? '', storage_path: `niveles/${n}-${hash}.${kind === 'photo' ? 'webp' : 'mp4'}`, poster_path: kind === 'video' ? `niveles/${n}-${hash}.poster.webp` : null }); });
music.forEach((file, i) => { const hash = hashOf(join(folder, file)); const n = String(i + 1).padStart(3, '0');
  desired.push({ kind: 'music', position: i + 1, file, hash, caption: basename(file, extname(file)).replace(/^\d+[\s._-]*/, ''), storage_path: `musica/${n}-${hash}.m4a`, poster_path: null }); });

const { data: existing, error: readError } = await supabase.from('moments').select('*'); if (readError) throw readError;
const wanted = new Set(desired.map(d => d.storage_path));
// 1. Remove what is no longer in the folder (files first, then rows).
const stale = existing.filter(row => !wanted.has(row.storage_path));
if (stale.length) {
  const paths = stale.flatMap(row => [row.storage_path, row.poster_path].filter(Boolean));
  const { error } = await supabase.storage.from('moments').remove(paths); if (error) throw error;
  const { error: rowError } = await supabase.from('moments').delete().in('id', stale.map(r => r.id)); if (rowError) throw rowError;
  console.log(`Eliminados ${stale.length} elementos que ya no están en la carpeta.`);
}
// 2. Park surviving rows on negative positions so reordering never collides with unique(kind, position).
const kept = existing.filter(row => wanted.has(row.storage_path));
for (const [i, row] of kept.entries()) { const { error } = await supabase.from('moments').update({ position: -(i + 1) }).eq('id', row.id); if (error) throw error; }
// 3. Encode + upload new files, then set final positions and captions for everything.
let uploaded = 0, totalVideoMs = 0, totalBytes = 0;
for (const item of desired) {
  const source = join(folder, item.file); const known = kept.find(row => row.storage_path === item.storage_path);
  let meta = known ? { duration_ms: known.duration_ms, width: known.width, height: known.height, bytes: known.bytes } : null;
  if (!meta) {
    const out = join(work, basename(item.storage_path));
    process.stdout.write(`Preparando ${item.file}… `);
    if (item.kind === 'photo') {
      if (!existsSync(out)) {
        try { await sharp(source).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(out); }
        catch (e) { throw new Error(`No pude leer ${item.file} (${e.message}). Si es HEIC, expórtala como JPG.`); }
      }
      const image = readFileSync(out); const info = await sharp(image).metadata();
      const { error } = await supabase.storage.from('moments').upload(item.storage_path, image, { contentType: 'image/webp', upsert: true }); if (error) throw error;
      meta = { duration_ms: 0, width: info.width ?? null, height: info.height ?? null, bytes: image.length };
    } else if (item.kind === 'video') {
      if (!existsSync(out)) await run('ffmpeg', ['-y', '-v', 'error', '-i', source, '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', out]);
      const poster = out.replace(/\.mp4$/, '.poster.webp');
      if (!existsSync(poster)) await run('ffmpeg', ['-y', '-v', 'error', '-ss', '1', '-i', out, '-frames:v', '1', '-vf', 'scale=640:-2', '-c:v', 'libwebp', '-quality', '75', poster]);
      const info = await probe(out); const bytes = statSync(out).size;
      const up = await supabase.storage.from('moments').upload(item.storage_path, readFileSync(out), { contentType: 'video/mp4', upsert: true }); if (up.error) throw up.error;
      const pp = await supabase.storage.from('moments').upload(item.poster_path, readFileSync(poster), { contentType: 'image/webp', upsert: true }); if (pp.error) throw pp.error;
      meta = { duration_ms: info.durationMs, width: info.width, height: info.height, bytes };
    } else {
      if (!existsSync(out)) await run('ffmpeg', ['-y', '-v', 'error', '-i', source, '-vn', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', out]);
      const info = await probe(out); const bytes = statSync(out).size;
      const { error } = await supabase.storage.from('moments').upload(item.storage_path, readFileSync(out), { contentType: 'audio/mp4', upsert: true }); if (error) throw error;
      meta = { duration_ms: info.durationMs, width: null, height: null, bytes };
    }
    console.log(`${mb(meta.bytes)}${meta.duration_ms ? ` · ${mmss(meta.duration_ms)}` : ''}`);
    uploaded++;
  }
  const row = { kind: item.kind, position: item.position, storage_path: item.storage_path, poster_path: item.poster_path, caption: item.caption, source_hash: item.hash, ...meta };
  const { error } = known ? await supabase.from('moments').update(row).eq('id', known.id) : await supabase.from('moments').insert(row); if (error) throw error;
  if (item.kind === 'video') totalVideoMs += meta.duration_ms; totalBytes += meta.bytes;
}
const count = kind => desired.filter(d => d.kind === kind).length;
console.log(`\nListo: ${count('photo')} fotos · ${count('video')} videos (${mmss(totalVideoMs)}) · ${count('music')} canciones · ${mb(totalBytes)} en total · ${uploaded} archivos nuevos subidos.`);
if (totalVideoMs > MAX_VIDEO_MS) console.log(`⚠ Los videos suman ${mmss(totalVideoMs)} y acordamos máximo ${mmss(MAX_VIDEO_MS)}. Recorta o quita algún clip para que nadie se aburra.`);
console.log('Abre santiago.teolabs.app/#niveles con tu cuenta de organizador y pulsa «Preparar para la fiesta».');
