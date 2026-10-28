'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));

function pngSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} is a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('manifest has name, start_url ./, standalone display, and existing 192 and 512 png icons', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.ok(m.name && m.short_name);
  assert.equal(m.start_url, './');
  assert.equal(m.display, 'standalone');
  for (const size of ['192x192', '512x512']) {
    const icon = m.icons.find((i) => i.sizes === size);
    assert.ok(icon, `icon ${size}`);
    assert.equal(icon.type, 'image/png');
    assert.ok(exists(icon.src.replace('./', '')), `${icon.src} exists`);
  }
});

test('PNG icons have the correct dimensions', () => {
  assert.deepEqual(pngSize('icons/icon-192.png'), { w: 192, h: 192 });
  assert.deepEqual(pngSize('icons/icon-512.png'), { w: 512, h: 512 });
});

function swFiles() {
  const match = read('sw.js').match(/const FILES = (\[[^\]]*\]);/);
  assert.ok(match, 'sw.js declares const FILES = [...]');
  return new Function(`return ${match[1]}`)();
}

test('every file in sw.js FILES exists', () => {
  for (const f of swFiles()) {
    if (f === './') continue;
    assert.ok(exists(f.replace('./', '')), `${f} exists`);
  }
});

test('every script, stylesheet and manifest linked from index.html is precached', () => {
  const html = read('index.html');
  const files = swFiles();
  const refs = [
    ...[...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]*\shref="([^"]+)"/g)].map((m) => m[1]),
  ].filter((r) => r.startsWith('./'));
  assert.ok(refs.length >= 8, 'found the page references');
  for (const r of refs) assert.ok(files.includes(r), `${r} is in sw.js FILES`);
  assert.ok(files.includes('./') && files.includes('./index.html'));
});

test('index.html links the manifest and registers the service worker with a relative path', () => {
  const html = read('index.html');
  assert.match(html, /rel="manifest"\s+href="\.\/manifest\.webmanifest"/);
  assert.match(html, /serviceWorker\.register\('\.\/sw\.js'\)/);
});

test('sw.js uses a named cache and cleans old caches on activate', () => {
  const sw = read('sw.js');
  assert.match(sw, /const CACHE = 'blackqueen-v\d+'/);
  assert.match(sw, /caches\.delete/);
});
