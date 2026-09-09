#!/usr/bin/env node
/* ============================================================
   slice.mjs — нарезать видео на кадры для «кино-осмотра»
   Использование:
     node tools/slice.mjs <in.mp4> [кадров=120] [ширина=1600] [outdir=media/cinema]
   Создаёт frame-XXX.webp + переписывает manifest.js.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [, , inArg, nArg = '120', wArg = '1600', outArg = 'media/cinema', qArg = '72'] = process.argv;

if (!inArg) {
  console.error('用法: node tools/slice.mjs <in.mp4> [кадров=120] [ширина=1600] [outdir=media/cinema]');
  process.exit(1);
}
const src = resolve(root, inArg);
const outDir = resolve(root, outArg);
const frames = parseInt(nArg, 10);
const width = parseInt(wArg, 10);
const quality = parseInt(qArg, 10);

const dur = parseFloat(execFileSync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=duration', '-of', 'csv=p=0', src
]).toString().trim());

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) {
  if (f.startsWith('frame-') || f === 'manifest.js') unlinkSync(resolve(outDir, f));
}

console.log(`режу ${src} → ${frames} кадров, ${width}px, клип ${dur.toFixed(1)}с`);
execFileSync('ffmpeg', [
  '-y', '-v', 'error', '-i', src,
  '-vf', `fps=${frames / dur},scale=${width}:-2`,
  '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(quality), '-compression_level', '4',
  resolve(outDir, 'frame-%03d.webp')
], { stdio: 'inherit' });

const count = readdirSync(outDir).filter(f => f.endsWith('.webp')).length;
const key = outArg.split('/').filter(Boolean).pop();
const rel = outArg.replace(/\\/g, '/').replace(/\/$/, '') + '/';
const manifest =
  `/* манифест нарезки: обновляется tools/slice.mjs */\n` +
  `window.__SEQ = window.__SEQ || {};\n` +
  `window.__SEQ['${key}'] = { dir: '${rel}', count: ${count}, pad: 3, ext: '.webp' };\n` +
  (key === 'cinema'
    ? `window.__CINEMA = { dir: '${rel}', count: ${count}, pad: 3, ext: '.webp' };\n`
    : '');
writeFileSync(resolve(outDir, 'manifest.js'), manifest);

console.log(`✓ ${count} кадров в ${outArg}, manifest.js обновлён (ключ ${key})`);
