/**
 * PWA 用 PNG アイコンを生成（Node 標準のみ）
 * 実行: node scripts/generate-pwa-icons.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ ~0) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createSolidPng(size, rgb, alpha = 255) {
  const [r, g, b] = rgb;
  const row = Buffer.alloc(1 + size * 4);
  const raw = Buffer.alloc((1 + size * 4) * size);
  for (let y = 0; y < size; y++) {
    const off = y * (1 + size * 4);
    raw[off] = 0;
    for (let x = 0; x < size; x++) {
      const px = off + 1 + x * 4;
      const t = x / size;
      const u = y / size;
      const vignette = 1 - 0.35 * Math.hypot(t - 0.5, u - 0.5);
      raw[px] = Math.min(255, Math.round(r * vignette));
      raw[px + 1] = Math.min(255, Math.round(g * vignette));
      raw[px + 2] = Math.min(255, Math.round(b * vignette));
      raw[px + 3] = alpha;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });

const bg = [3, 7, 18];
const accent = [124, 58, 237];

writeFileSync(join(outDir, "icon-192.png"), createSolidPng(192, bg));
writeFileSync(join(outDir, "icon-512.png"), createSolidPng(512, bg));
writeFileSync(join(outDir, "icon-maskable-512.png"), createSolidPng(512, accent));

console.log("Wrote icon-192.png, icon-512.png, icon-maskable-512.png");
