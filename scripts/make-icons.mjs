/**
 * Velora — génère les icônes PWA (192, 512, maskable 512) en PNG prune/rose.
 * Usage : node scripts/make-icons.mjs   (nécessite un environnement avec canvas, ou
 * génère un PNG minimal via zlib — ici : PNG simple dessiné pixel par pixel, sans dépendance).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(root, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size, { maskable = false } = {}) {
  // Dégradé prune (#432938 → #634050) avec un "V" rose poudré stylisé.
  const rows = [];
  const pad = maskable ? Math.floor(size * 0.1) : 0;
  const inner = size - pad * 2;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const t = y / size;
      let r = Math.round(0x43 + (0x63 - 0x43) * t);
      let g = Math.round(0x29 + (0x40 - 0x29) * t);
      let b = Math.round(0x38 + (0x50 - 0x38) * t);
      // V stylisé rose poudré (#E7C4D3)
      const nx = (x - pad) / inner;
      const ny = (y - pad) / inner;
      const inV =
        nx >= 0.28 && nx <= 0.72 && ny >= 0.28 && ny <= 0.72
          ? Math.abs(nx - 0.5) * 2 <= (ny - 0.28) / 0.44 + 0.12 && ny <= 0.72
          : false;
      if (inV) {
        r = 0xe7;
        g = 0xc4;
        b = 0xd3;
      }
      const o = 1 + x * 4;
      row[o] = r;
      row[o + 1] = g;
      row[o + 2] = b;
      row[o + 3] = 0xff;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

writeFileSync(join(root, "icon-192.png"), makePng(192));
writeFileSync(join(root, "icon-512.png"), makePng(512));
writeFileSync(join(root, "icon-512-maskable.png"), makePng(512, { maskable: true }));
console.log("Icônes Velora générées dans public/icons/");
