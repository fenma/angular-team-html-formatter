"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const width = 256;
const height = 256;
const pixels = Buffer.alloc(width * height * 4, 0);

drawScene();
writePng(path.join(__dirname, "..", "assets", "icon.png"), width, height, pixels);

function drawScene() {
  const slateA = hex("#0F172A");
  const slateB = hex("#1E293B");
  const amber = hex("#F59E0B");
  const orange = hex("#F97316");
  const white = hex("#F8FAFC");
  const silver = hex("#CBD5E1");

  fillRoundedRect(16, 16, 224, 224, 52, (x, y) => lerpColor(slateA, slateB, (x + y) / 448));
  fillRoundedRect(40, 40, 176, 176, 36, (x, y) =>
    withAlpha(lerpColor(amber, orange, (x + y) / 352), 0.16)
  );

  strokePolyline(
    [
      [100, 85],
      [66, 128],
      [100, 171]
    ],
    18,
    (x, y) => lerpColor(white, silver, (x + y) / 320)
  );

  strokePolyline(
    [
      [156, 85],
      [190, 128],
      [156, 171]
    ],
    18,
    (x, y) => lerpColor(white, silver, (x + y) / 320)
  );

  strokeSegment(122, 70, 108, 186, 14, () => amber);
  strokeSegment(146, 70, 132, 186, 14, () => withAlpha(orange, 0.9));

  fillRoundedRect(62, 188, 132, 12, 6, () => withAlpha(white, 0.92));
  fillRoundedRect(84, 208, 88, 10, 5, () => withAlpha(silver, 0.72));
}

function fillRoundedRect(x, y, w, h, r, colorFn) {
  const xStart = Math.max(0, Math.floor(x));
  const xEnd = Math.min(width - 1, Math.ceil(x + w));
  const yStart = Math.max(0, Math.floor(y));
  const yEnd = Math.min(height - 1, Math.ceil(y + h));

  for (let py = yStart; py <= yEnd; py += 1) {
    for (let px = xStart; px <= xEnd; px += 1) {
      const dx = Math.max(Math.abs(px + 0.5 - (x + w / 2)) - (w / 2 - r), 0);
      const dy = Math.max(Math.abs(py + 0.5 - (y + h / 2)) - (h / 2 - r), 0);
      if (dx * dx + dy * dy <= r * r) {
        setPixel(px, py, colorFn(px - x, py - y));
      }
    }
  }
}

function strokePolyline(points, thickness, colorFn) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    strokeSegment(x1, y1, x2, y2, thickness, colorFn);
  }
}

function strokeSegment(x1, y1, x2, y2, thickness, colorFn) {
  const padding = Math.ceil(thickness / 2) + 2;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - padding));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x1, x2) + padding));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - padding));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y1, y2) + padding));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const distance = pointToSegmentDistance(px + 0.5, py + 0.5, x1, y1, x2, y2);
      if (distance <= thickness / 2) {
        setPixel(px, py, colorFn(px, py));
      }
    }
  }
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const projectionX = x1 + t * dx;
  const projectionY = y1 + t * dy;
  return Math.hypot(px - projectionX, py - projectionY);
}

function setPixel(x, y, color) {
  const index = (y * width + x) * 4;
  const srcA = color.a / 255;
  const dstA = pixels[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);

  if (outA === 0) {
    return;
  }

  pixels[index] = Math.round((color.r * srcA + pixels[index] * dstA * (1 - srcA)) / outA);
  pixels[index + 1] = Math.round((color.g * srcA + pixels[index + 1] * dstA * (1 - srcA)) / outA);
  pixels[index + 2] = Math.round((color.b * srcA + pixels[index + 2] * dstA * (1 - srcA)) / outA);
  pixels[index + 3] = Math.round(outA * 255);
}

function writePng(outputPath, pngWidth, pngHeight, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(pngWidth, 0);
  ihdr.writeUInt32BE(pngHeight, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = pngWidth * 4;
  const raw = Buffer.alloc((stride + 1) * pngHeight);
  for (let y = 0; y < pngHeight; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgbaBuffer.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const chunks = [
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    makeChunk("IEND", Buffer.alloc(0))
  ];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat([signature, ...chunks]));
  console.log(`Generated ${outputPath}`);
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function lerpColor(a, b, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * clamped),
    g: Math.round(a.g + (b.g - a.g) * clamped),
    b: Math.round(a.b + (b.b - a.b) * clamped),
    a: Math.round(a.a + (b.a - a.a) * clamped)
  };
}

function withAlpha(color, alpha) {
  return {
    ...color,
    a: Math.round(255 * alpha)
  };
}

function hex(value) {
  const normalized = value.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
    a: 255
  };
}
