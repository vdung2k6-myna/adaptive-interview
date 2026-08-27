/**
 * Generate PWA icon PNGs without external image dependencies.
 * Uses Node's built-in zlib to produce valid PNG files.
 *
 * Design: rounded square with a dark zinc background and a white
 * speech-bubble glyph (central safe zone for maskable version).
 */

import { createWriteStream } from "node:fs";
import { promisify } from "node:util";
import { deflate } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");

const deflateAsync = promisify(deflate);

// CRC32 table for PNG chunk checksums
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return Buffer.from([(c ^ 0xffffffff) >>> 24, ((c ^ 0xffffffff) >>> 16) & 0xff, ((c ^ 0xffffffff) >>> 8) & 0xff, (c ^ 0xffffffff) & 0xff]);
}

// Brand colors
const BG = { r: 24, g: 24, b: 27 }; // zinc-900 #18181b
const GLYPH = { r: 255, g: 255, b: 255 };

async function writePng(filePath, width, height, pixels) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    return Buffer.concat([lenBuf, typeBuf, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace

  // IDAT: each row has a filter byte (0 = none) followed by RGBA pixels
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * rowSize + 1 + x * 4;
      const p = pixels[y * width + x];
      raw[i] = p.r;
      raw[i + 1] = p.g;
      raw[i + 2] = p.b;
      raw[i + 3] = p.a;
    }
  }
  const compressed = await deflateAsync(raw);

  // IEND is empty
  const iend = chunk("IEND", Buffer.alloc(0));

  const output = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    iend,
  ]);

  await new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    stream.write(output);
    stream.end();
  });
}

function fillRect(pixels, width, x1, y1, w, h, color) {
  for (let y = y1; y < y1 + h; y++) {
    for (let x = x1; x < x1 + w; x++) {
      if (x >= 0 && x < width && y >= 0 && y < pixels.length / width) {
        pixels[y * width + x] = color;
      }
    }
  }
}

function fillRoundedRect(pixels, width, height, x, y, w, h, r, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));
  const cx1 = x + r;
  const cx2 = x + w - r;
  const cy1 = y + r;
  const cy2 = y + h - r;

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      let inside = false;
      if (px >= cx1 && px < cx2) {
        inside = true;
      } else if (py >= cy1 && py < cy2) {
        inside = true;
      } else {
        // corner distance
        let cx = px < cx1 ? x + r : x + w - r;
        let cy = py < cy1 ? y + r : y + h - r;
        const dx = px + 0.5 - cx;
        const dy = py + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) {
          inside = true;
        }
      }
      if (inside) {
        pixels[py * width + px] = color;
      }
    }
  }
}

function drawCircle(pixels, width, height, cx, cy, r, color) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width, Math.ceil(cx + r));
  const y1 = Math.min(height, Math.ceil(cy + r));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) {
        pixels[y * width + x] = color;
      }
    }
  }
}

function createIcon(size, paddingFraction = 0.1) {
  const pixels = Array.from({ length: size * size }, () => ({ r: 0, g: 0, b: 0, a: 0 }));
  const padding = Math.round(size * paddingFraction);
  const bgColor = { ...BG, a: 255 };
  const glyphColor = { ...GLYPH, a: 255 };

  // Background rounded square
  const r = Math.round(size * 0.22);
  fillRoundedRect(pixels, size, size, padding, padding, size - 2 * padding, size - 2 * padding, r, bgColor);

  // Speech bubble glyph
  const bubbleMargin = Math.round(size * 0.28);
  const bubbleW = size - 2 * bubbleMargin;
  const bubbleH = Math.round(bubbleW * 0.72);
  const bubbleX = bubbleMargin;
  const bubbleY = Math.round((size - bubbleH) / 2 - size * 0.02);
  const bubbleR = Math.round(bubbleW * 0.18);
  fillRoundedRect(pixels, size, size, bubbleX, bubbleY, bubbleW, bubbleH, bubbleR, glyphColor);

  // Bubble tail (small triangle-ish shape at bottom-left)
  const tailW = Math.round(size * 0.14);
  const tailH = Math.round(size * 0.12);
  const tailX = bubbleX + bubbleR;
  const tailY = bubbleY + bubbleH - Math.round(size * 0.03);
  for (let y = 0; y < tailH; y++) {
    const rowWidth = Math.round((tailW * (tailH - y)) / tailH);
    fillRect(pixels, size, tailX, tailY + y, rowWidth, 1, glyphColor);
  }

  // Two small dark dots inside the bubble as "eyes"
  const dotR = Math.round(size * 0.025);
  const dotY = bubbleY + bubbleH / 2;
  const dotOffset = Math.round(bubbleW * 0.22);
  drawCircle(pixels, size, size, bubbleX + bubbleW / 2 - dotOffset, dotY, dotR, bgColor);
  drawCircle(pixels, size, size, bubbleX + bubbleW / 2 + dotOffset, dotY, dotR, bgColor);

  return pixels;
}

function createMaskableIcon(size) {
  // Maskable icons must keep critical content within the central ~40% safe zone.
  // We use padding so the glyph fits well within the safe zone on any mask shape.
  return createIcon(size, 0.22);
}

function createSplashScreen(width, height) {
  // iOS launch screen: dark background with the brand glyph centered.
  // The glyph is sized to stay well within the safe central area on both
  // notched phones and iPads.
  const pixels = Array.from({ length: width * height }, () => ({ r: 0, g: 0, b: 0, a: 0 }));
  const bgColor = { ...BG, a: 255 };
  const glyphColor = { ...GLYPH, a: 255 };

  // Solid dark background
  fillRect(pixels, width, 0, 0, width, height, bgColor);

  // Centered speech bubble glyph, ~35-45% of the smaller dimension
  const minDim = Math.min(width, height);
  const bubbleW = Math.round(minDim * 0.4);
  const bubbleH = Math.round(bubbleW * 0.72);
  const bubbleX = Math.round((width - bubbleW) / 2);
  const bubbleY = Math.round((height - bubbleH) / 2);
  const bubbleR = Math.round(bubbleW * 0.18);
  fillRoundedRect(pixels, width, height, bubbleX, bubbleY, bubbleW, bubbleH, bubbleR, glyphColor);

  // Bubble tail at bottom-left
  const tailW = Math.round(minDim * 0.09);
  const tailH = Math.round(minDim * 0.075);
  const tailX = bubbleX + bubbleR;
  const tailY = bubbleY + bubbleH - Math.round(minDim * 0.02);
  for (let y = 0; y < tailH; y++) {
    const rowWidth = Math.round((tailW * (tailH - y)) / tailH);
    fillRect(pixels, width, tailX, tailY + y, rowWidth, 1, glyphColor);
  }

  // Two small dark dots inside the bubble as "eyes"
  const dotR = Math.round(minDim * 0.022);
  const dotY = bubbleY + bubbleH / 2;
  const dotOffset = Math.round(bubbleW * 0.22);
  drawCircle(pixels, width, height, bubbleX + bubbleW / 2 - dotOffset, dotY, dotR, bgColor);
  drawCircle(pixels, width, height, bubbleX + bubbleW / 2 + dotOffset, dotY, dotR, bgColor);

  return pixels;
}

async function main() {
  console.log("Generating PWA icons...");

  await writePng(path.join(PUBLIC_DIR, "icon-192.png"), 192, 192, createIcon(192));
  await writePng(path.join(PUBLIC_DIR, "icon-512.png"), 512, 512, createIcon(512));
  await writePng(path.join(PUBLIC_DIR, "icon-maskable.png"), 512, 512, createMaskableIcon(512));
  await writePng(path.join(PUBLIC_DIR, "apple-touch-icon.png"), 180, 180, createIcon(180));

  console.log("Generating iOS splash screens...");

  await writePng(
    path.join(PUBLIC_DIR, "apple-touch-startup-image-1170x2532.png"),
    1170,
    2532,
    createSplashScreen(1170, 2532)
  );
  await writePng(
    path.join(PUBLIC_DIR, "apple-touch-startup-image-1290x2796.png"),
    1290,
    2796,
    createSplashScreen(1290, 2796)
  );
  await writePng(
    path.join(PUBLIC_DIR, "apple-touch-startup-image-1668x2388.png"),
    1668,
    2388,
    createSplashScreen(1668, 2388)
  );
  await writePng(
    path.join(PUBLIC_DIR, "apple-touch-startup-image-2048x2732.png"),
    2048,
    2732,
    createSplashScreen(2048, 2732)
  );

  console.log("PWA assets generated in public/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
