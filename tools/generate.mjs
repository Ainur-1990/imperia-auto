#!/usr/bin/env node
/* ============================================================
   generate.mjs — генерация фото/видео через API GPTunnel
   (https://gptunnel.ru — Creative Lab, /api/v2/media/tasks)

   Ключ берётся из env GPTUNNEL_API_KEY либо файла tools/api-key.txt.

   Команды:
     node tools/generate.mjs models
     node tools/generate.mjs image  --model flux-pro --prompt "..." --out media/src/x.png [--ar 16:9]
     node tools/generate.mjs video  --model kling-v3 --prompt "..." --first-frame photo.jpg \
                                   [--dur 5] [--res 1080p] [--ar 16:9] --out media/src/clip.mp4

   Пайплайн «настоящий Voyah под мышью и скроллом»:
     1. фото реального авто (от дилера) →
     2. `video --first-frame фото --prompt "камера медленно облетает автомобиль по кругу, showroom"`
     3. node tools/slice.mjs media/src/clip.mp4 120 1600 media/cinema
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://gptunnel.ru/api/v2';

async function key() {
  if (process.env.GPTUNNEL_API_KEY) return process.env.GPTUNNEL_API_KEY.trim();
  const f = resolve(root, 'tools/api-key.txt');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  console.error('Нет ключа: положите tools/api-key.txt или задайте GPTUNNEL_API_KEY');
  process.exit(1);
}

/* fetch с таймаутом и повторами: gptunnel бывает недоступен на секунды */
async function fetchR(url, opts, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController();
      const to = setTimeout(() => c.abort(), 30000);
      const r = await fetch(url, { ...opts, signal: c.signal });
      clearTimeout(to);
      return r;
    } catch (e) {
      last = e;
      const d = 4000 * (i + 1) * (i + 1);
      console.error(`\nсеть: ${e.code || e.message}; повтор ${i + 1}/${tries} через ${Math.round(d / 1000)}с`);
      await new Promise(z => setTimeout(z, d));
    }
  }
  throw last;
}

async function api(path, opts) {
  const r = await fetchR(API + path, {
    ...opts,
    headers: {
      'Authorization': await key(),
      'Content-Type': 'application/json',
      ...(opts && opts.headers || {})
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

function dataUrl(file) {
  const b = readFileSync(resolve(root, file));
  const ext = file.split('.').pop().toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${b.toString('base64')}`;
}

async function runTask(body) {
  const created = await api('/media/tasks', { method: 'POST', body: JSON.stringify(body) });
  const id = created.id || created.task_id;
  console.log('задача', id, 'создана; модель:', created.model || body.model);
  const t0 = Date.now();
  for (;;) {
    await new Promise(z => setTimeout(z, 5000));
    const t = await api(`/media/tasks/${id}`);
    process.stdout.write(`\r[${Math.round((Date.now() - t0) / 1000)}с] ${t.status}   `);
    if (t.status === 'done') {
      console.log(`\n✓ готово, цена ${t.price} ₽`);
      return t.result;
    }
    if (t.status === 'failed') throw new Error('провал: ' + JSON.stringify(t.error));
  }
}

async function download(urls, out) {
  const res = await fetchR(urls[0].url);
  if (!res.ok) throw new Error('скачивание ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(resolve(root, out), buf);
  console.log(`\n✓ сохранено ${out} (${(buf.length / 1048576).toFixed(1)} МБ) — файл уже локально`);
}

/* --- аргументы вида --key value --- */
const args = process.argv.slice(2);
const cmd = args[0];
const opt = k => {
  const i = args.indexOf('--' + k);
  return i > -1 ? args[i + 1] : undefined;
};

if (cmd === 'models') {
  const m = await api('/media/models', { method: 'GET' });
  const list = m.models || m.data || m;
  for (const x of list) console.log(`${x.id || x.model}\t${(x.description || x.title || '').slice(0, 70)}`);
} else if (cmd === 'image') {
  const body = {
    model: opt('model') || 'flux-pro',
    prompt: opt('prompt') || '',
    idempotency_key: 'imperia-' + Date.now()
  };
  const params = {};
  if (opt('ar')) params.aspect_ratio = opt('ar');
  if (Object.keys(params).length) body.params = params;
  const res = await runTask(body);
  await download(res.map(r => ({ url: r.url })), opt('out') || 'media/src/gen-image.png');
} else if (cmd === 'video') {
  const body = {
    model: opt('model') || 'kling-v3',
    prompt: opt('prompt') || '',
    idempotency_key: 'imperia-' + Date.now(),
    params: { resolution: opt('res') || '1080p' }
  };
  if (opt('dur')) body.params.duration = parseFloat(opt('dur'));
  if (opt('ar')) body.params.aspect_ratio = opt('ar');
  if (opt('first-frame')) {
    body.inputs = body.inputs || {};
    body.inputs.first_frame = [dataUrl(opt('first-frame'))];
  }
  const res = await runTask(body);
  const url = (res.find(r => /\.mp4|video/.test(r.url || '')) || res[0]).url;
  await download([{ url }], opt('out') || 'media/src/gen-video.mp4');
} else {
  console.log('команды: models | image --model --prompt --out | video --model --prompt --first-frame --dur --out');
}
