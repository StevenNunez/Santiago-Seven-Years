import sharp from 'sharp';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const source = process.argv[2] || 'C:/Users/xistv/Desktop/Santiago';
const characters = ['sonic','tails','knuckles','amy','silver','super-sonic','eggman'].map(id => [id, id + '-480.png']);
await mkdir('public/characters', { recursive: true });
const report = [];
for (const [id, file] of characters) {
  const path = join(source, file);
  const meta = await sharp(path).metadata();
  if (!meta.hasAlpha || (await sharp(path).stats()).isOpaque) throw new Error('Expected real transparency: ' + file);
  const sizes = [];
  for (const width of (['silver','super-sonic','eggman'].includes(id) ? [240] : [240, 480])) {
    const output = `public/characters/${id}-clear-${width}.webp`;
    await sharp(path).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 100, effort: 5 }).toFile(output);
    sizes.push({ width, bytes: (await stat(output)).size });
  }
  report.push({ id, originalBytes: (await stat(path)).size, width: meta.width, height: meta.height, alpha: meta.hasAlpha, sizes });
}
await writeFile('docs/character-assets.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
