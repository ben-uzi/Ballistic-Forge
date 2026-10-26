/**
 * Generate the PWA icon PNGs from the placeholder Ballistic Forge mark.
 *
 * Hand-rolled rasteriser + PNG encoder so the repo needs no image toolchain
 * (`node scripts/gen-icons.mjs`). These are placeholders: when the real brand
 * assets land (NEEDS_CHAD 5), either re-point this script at them or replace the
 * PNGs directly.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  'icons',
);

const GUNMETAL = [0x1c, 0x1c, 0x2e];
const FORGE = [0xc8, 0x86, 0x0a];

/** Supersampling factor per axis; 4 gives clean edges at 192 px. */
const SS = 4;

/** Signed-distance-ish coverage helpers, all in 0–1 unit space. */
const inRoundedRect = (x, y, radius) => {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
};

const inAnnulus = (x, y, outer, thickness) => {
  const d = Math.hypot(x - 0.5, y - 0.5);
  return d <= outer && d >= outer - thickness;
};

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** Filled diamond (rotated square) centred on the mark. */
const inDiamond = (x, y, half) => Math.abs(x - 0.5) + Math.abs(y - 0.5) <= half;

/**
 * The mark: a scope reticle — ring, four ticks, centre diamond.
 * `inset` shrinks the glyph for maskable icons, whose outer 10% can be cropped.
 */
function glyphAt(x, y, inset) {
  const gx = 0.5 + (x - 0.5) / inset;
  const gy = 0.5 + (y - 0.5) / inset;
  if (gx < 0 || gx > 1 || gy < 0 || gy > 1) return false;

  if (inAnnulus(gx, gy, 0.36, 0.055)) return true;

  // Four ticks, from just outside the diamond out to the ring.
  const w = 0.028;
  if (inRect(gx, gy, 0.5 - w, 0.17, 0.5 + w, 0.36)) return true;
  if (inRect(gx, gy, 0.5 - w, 0.64, 0.5 + w, 0.83)) return true;
  if (inRect(gx, gy, 0.17, 0.5 - w, 0.36, 0.5 + w)) return true;
  if (inRect(gx, gy, 0.64, 0.5 - w, 0.83, 0.5 + w)) return true;

  if (inDiamond(gx, gy, 0.1)) return true;
  return false;
}

function render(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const cornerRadius = maskable ? 0.5 : 0.21;
  const inset = maskable ? 0.78 : 0.96;
  const samples = SS * SS;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          // Maskable icons must bleed to the edge; standalone ones get rounded corners.
          const inside = maskable ? true : inRoundedRect(x, y, cornerRadius);
          if (!inside) continue;
          bg += 1;
          if (glyphAt(x, y, inset)) fg += 1;
        }
      }
      const alpha = bg / samples;
      const glyph = fg / samples;
      const offset = (py * size + px) * 4;
      // Composite forge-on-gunmetal, then apply the shape's alpha.
      for (let c = 0; c < 3; c += 1) {
        const base = GUNMETAL[c];
        const mark = FORGE[c];
        rgba[offset + c] = Math.round(base + (mark - base) * (alpha > 0 ? glyph / alpha : 0));
      }
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

// ── Minimal PNG encoder (RGBA, 8-bit, filter 0) ──────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, maskable } of TARGETS) {
  const png = encodePng(render(size, { maskable }), size);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KiB`);
}
