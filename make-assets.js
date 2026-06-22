/**
 * Creates minimal valid PNG assets for the SRY Field app
 * Blue (#1e3a8a) background with white "SRY" text concept
 * Uses only Node.js built-ins (zlib + Buffer)
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePNG(w, h, bg, drawFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Build raw rows
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0; // filter None
    for (let x = 0; x < w; x++) {
      const [r, g, b] = drawFn ? drawFn(x, y, w, h) : bg;
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Brand colors
const BLUE_DARK  = [30, 58, 138];   // #1e3a8a
const BLUE_MID   = [30, 64, 175];   // #1e40af
const WHITE      = [255, 255, 255];

// Draw a simple gradient + circle logo
function iconDraw(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.38;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

  // Background gradient
  const t = y / h;
  const bg = BLUE_DARK.map((c, i) => Math.round(c + (BLUE_MID[i] - c) * t));

  // White circle
  if (dist < r) {
    const alpha = Math.min(1, (r - dist) / 2);
    return bg.map((c, i) => Math.round(c * (1 - alpha) + WHITE[i] * alpha));
  }
  return bg;
}

// Splash: simple gradient
function splashDraw(x, y, w, h) {
  const t = y / h;
  return BLUE_DARK.map((c, i) => Math.round(c + (BLUE_MID[i] - c) * t));
}

const dir = path.join(__dirname, 'assets');

// 1024×1024 icon
const icon = makePNG(1024, 1024, BLUE_DARK, iconDraw);
fs.writeFileSync(path.join(dir, 'icon.png'), icon);
console.log('✓ icon.png', icon.length, 'bytes');

// 1024×1024 adaptive icon foreground
fs.writeFileSync(path.join(dir, 'adaptive-icon.png'), icon);
console.log('✓ adaptive-icon.png');

// 1284×2778 splash (standard iPhone 14 Pro Max size, works for Android too)
const splash = makePNG(1284, 2778, BLUE_DARK, splashDraw);
fs.writeFileSync(path.join(dir, 'splash.png'), splash);
console.log('✓ splash.png', splash.length, 'bytes');

// 96×96 notification icon (monochrome white on transparent — use solid white)
const notif = makePNG(96, 96, WHITE, () => WHITE);
fs.writeFileSync(path.join(dir, 'notification-icon.png'), notif);
console.log('✓ notification-icon.png');

console.log('All assets created.');
