// Draws the app icon (a plate with a basil leaf on a basil-green tile) into PNGs, no dependencies.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BASIL = [46, 112, 72], PLATE = [242, 244, 239], RIM = [214, 222, 210], LEAF = [46, 112, 72], PAPRIKA = [184, 67, 42];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const SS = 4; // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [r, g, b, a] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        acc[0] += r * a; acc[1] += g * a; acc[2] += b * a; acc[3] += a;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const a = acc[3] / (SS * SS);
      raw[o] = acc[3] ? acc[0] / acc[3] : 0; raw[o + 1] = acc[3] ? acc[1] / acc[3] : 0; raw[o + 2] = acc[3] ? acc[2] / acc[3] : 0; raw[o + 3] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// full-bleed square (iOS/Android apply their own mask); content kept inside the maskable safe zone
function icon(u, v) {
  const dx = u - 0.5, dy = v - 0.5, d = Math.hypot(dx, dy);
  if (d < 0.27) {
    // leaf: lens shape rotated 45°, plus a paprika dot
    const lx = (dx + dy) / Math.SQRT2, ly = (dy - dx) / Math.SQRT2;
    const inLeaf = Math.abs(ly) < 0.075 * Math.cos((lx / 0.17) * (Math.PI / 2)) && Math.abs(lx) < 0.17;
    if (inLeaf && Math.abs(ly) > 0.006) return [...LEAF, 1];
    if (Math.hypot(dx + 0.1, dy - 0.11) < 0.045) return [...PAPRIKA, 1];
    return [...PLATE, 1];
  }
  if (d < 0.31) return [...RIM, 1];
  return [...BASIL, 1];
}

mkdirSync("public/icons", { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180], ["favicon.png", 48]]) {
  writeFileSync(`public/icons/${name}`, png(size, icon));
  console.log("public/icons/" + name);
}
