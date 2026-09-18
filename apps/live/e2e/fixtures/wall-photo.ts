import { deflateSync } from 'node:zlib';

// A photograph of a sticky wall, drawn rather than photographed.
//
// The detector is REAL in the photo-import e2e — it is the half of the feature
// that does not involve the model, so mocking it would leave the most
// interesting code untested in a browser. That means the test needs an actual
// image file, and a committed binary is a thing nobody can review or adjust.
// So the wall is drawn here, as pixels, and encoded as a PNG with node's own
// zlib: no dependency, no fixture to keep in step with the catalogue.

type Rgb = [number, number, number];

const WALL: Rgb = [241, 245, 249];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export type WallNote = {
  // The catalogue fill of the kind this note is.
  fill: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Draw the notes on a wall and encode the result as a PNG.
export function wallPhotoPng(width: number, height: number, notes: WallNote[]): Buffer {
  // One RGB triple per pixel, wall everywhere to begin with.
  const pixels = new Uint8Array(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = WALL[0];
    pixels[i + 1] = WALL[1];
    pixels[i + 2] = WALL[2];
  }
  for (const note of notes) {
    const [r, g, b] = hexToRgb(note.fill);
    for (let y = note.y; y < note.y + note.h; y += 1) {
      for (let x = note.x; x < note.x + note.w; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const i = (y * width + x) * 3;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
      }
    }
    // A couple of marker strokes, so the note is not a solid rectangle — the
    // real case, and the one that exercises the fragment merge.
    for (const stroke of [0.35, 0.55]) {
      const yy = Math.round(note.y + note.h * stroke);
      for (let x = note.x + 8; x < note.x + note.w - 8; x += 1) {
        for (let dy = 0; dy < 4; dy += 1) {
          const i = ((yy + dy) * width + x) * 3;
          if (i < 0 || i + 2 >= pixels.length) continue;
          pixels[i] = 17;
          pixels[i + 1] = 24;
          pixels[i + 2] = 39;
        }
      }
    }
  }
  return encodePng(width, height, pixels);
}

// Minimal PNG: one IHDR, one IDAT of zlib-deflated scanlines (filter 0), one
// IEND. Enough to be decoded by any browser, and small enough to read.
function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgb.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
