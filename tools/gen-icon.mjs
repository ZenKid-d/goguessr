#!/usr/bin/env node
// Generates a 1024×1024 source PNG for the app icon (no image deps), then
// `tauri icon` turns it into every platform size. A simple green disc on a dark
// field — placeholder art, easy to replace later.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 1024;

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const cx = SIZE / 2;
const cy = SIZE / 2;
const radius = SIZE * 0.4;

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // PNG filter type 0 (none)
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    let r;
    let g;
    let b;
    if (d < radius) {
      const band = Math.abs(Math.sin((dy / SIZE) * Math.PI * 6)) < 0.05;
      if (band) {
        r = 0x22;
        g = 0x8b;
        b = 0x5e;
      } else {
        r = 0x4a;
        g = 0xde;
        b = 0x80;
      }
    } else {
      r = 0x0f;
      g = 0x14;
      b = 0x20;
    }
    raw[p++] = r;
    raw[p++] = g;
    raw[p++] = b;
    raw[p++] = 255;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
// compression/filter/interlace already 0

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'client',
  'src-tauri',
  'app-icon.png',
);
writeFileSync(out, png);
console.log(`wrote ${png.length} bytes → ${out}`);
