'use strict';
// Writes icons/icon-192.png and icons/icon-512.png: felt-green square with a gold ring and a dark centre.
// Only Node's zlib is used. Usage: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FELT = [0x1f, 0x5c, 0x3f];
const GOLD = [0xe0, 0xa5, 0x26];
const DARK = [0x11, 0x2b, 0x1e];

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / size;
      const px = d < 0.2 ? DARK : d < 0.3 ? GOLD : FELT;
      raw.set(px, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) fs.writeFileSync(path.join(dir, `icon-${size}.png`), png(size));
