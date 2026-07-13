// Generates Picobra PWA icons (gradient background + cobra motif) as real PNGs,
// using only Node's built-in zlib. No native deps. Output -> app/icons/.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "app", "icons");
fs.mkdirSync(OUT, { recursive: true });

// ---- tiny PNG encoder (8-bit RGBA) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- drawing helpers ----
function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255, na = 1 - ia;
    buf[i] = r * ia + buf[i] * na;
    buf[i + 1] = g * ia + buf[i + 1] * na;
    buf[i + 2] = b * ia + buf[i + 2] * na;
    buf[i + 3] = Math.max(buf[i + 3], a);
  };
  // diagonal brand gradient  #ff0f7b -> #f89b29
  const c1 = [0xff, 0x0f, 0x7b], c2 = [0xf8, 0x9b, 0x29];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      set(x, y, c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t);
    }
  // anti-aliased filled disc
  const disc = (cx, cy, rad, col) => {
    const r0 = Math.ceil(rad + 1);
    for (let y = -r0; y <= r0; y++)
      for (let x = -r0; x <= r0; x++) {
        const d = Math.hypot(x, y);
        const a = Math.max(0, Math.min(1, rad - d + 0.5));
        if (a > 0) set(cx + x, cy + y, col[0], col[1], col[2], a * (col[3] ?? 255));
      }
  };
  // cobra body: an S-curve stroked with overlapping discs, tapering to the tail
  const S = size;
  const white = [255, 255, 255];
  const N = 260;
  let head = null;
  for (let i = 0; i <= N; i++) {
    const u = i / N;                         // 0 = tail, 1 = neck
    const x = (0.5 + 0.245 * Math.sin(u * Math.PI * 1.65)) * S;
    const y = (0.86 - 0.60 * u) * S;
    const rad = (0.055 + 0.045 * u) * S;     // thicker toward the head
    disc(x, y, rad, white);
    if (i === N) head = { x, y, rad };
  }
  // head hood + skull
  disc(head.x, head.y - 0.02 * S, 0.135 * S, white);
  // eyes
  const eye = [0x2a, 0x0a, 0x1a];
  disc(head.x - 0.05 * S, head.y - 0.03 * S, 0.022 * S, eye);
  disc(head.x + 0.05 * S, head.y - 0.03 * S, 0.022 * S, eye);
  // forked tongue
  const tongue = [0xff, 0x0f, 0x4b];
  const stroke = (x0, y0, x1, y1, w, col) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= steps; s++) disc(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps, w, col);
  };
  const ty = head.y - 0.15 * S;
  stroke(head.x, head.y - 0.10 * S, head.x, ty, 0.012 * S, tongue);
  stroke(head.x, ty, head.x - 0.045 * S, ty - 0.05 * S, 0.011 * S, tongue);
  stroke(head.x, ty, head.x + 0.045 * S, ty - 0.05 * S, 0.011 * S, tongue);
  return buf;
}

for (const size of [192, 512, 180, 32]) {
  const name = size === 180 ? "apple-touch-icon.png" : size === 32 ? "favicon-32.png" : `icon-${size}.png`;
  fs.writeFileSync(path.join(OUT, name), encodePNG(size, render(size)));
  console.log("wrote", name);
}
console.log("done ->", OUT);
