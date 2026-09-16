import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { classifyRgb, wallFloorsOf } from '../src/classify';
import { rgbToHsv, type ImageBuffer } from '../src/colour';
import { classMaskOf, detectStickies } from '../src/detect';
import { labelComponents } from '../src/components';
import { fitBoxes, mergeFragments } from '../src/boxes';

// Calibrating the detector against REAL photographs of a real wall.
//
// A script, not a test: the photos are somebody's actual workshop and never
// enter the repo, so nothing here can run in CI. The unit tests stay synthetic,
// exact and fast; this is the loop you run by hand while moving a threshold.
//
//   npx tsx scripts/calibrate.ts [--photos <dir>]
//
// Reads `/tmp/eswall-wall-photos/preview-*.png` (1000px working copies of the
// originals), decodes each ONCE into a cached raw RGBA buffer, and prints what
// the detector makes of it: how many stickies, of which kinds, at what sizes,
// plus the wall floors it measured. It also writes an overlay PNG per photo
// with a box round every detection, coloured by kind — which is the only
// honest way to judge "did it find the notes".

const PHOTO_DIR = process.argv.includes('--photos')
  ? process.argv[process.argv.indexOf('--photos') + 1]!
  : '/tmp/eswall-wall-photos';
const CACHE_DIR = `${PHOTO_DIR}/cache`;

// ---------------------------------------------------------------------------
// PNG in, PNG out. No dependency: node's zlib is the only hard part of either.
// ---------------------------------------------------------------------------

function decodePng(path: string): ImageBuffer {
  const buf = readFileSync(path);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colourType = 2;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colourType = data[9]!;
    }
    if (type === 'IDAT') idat.push(Buffer.from(data));
    pos += 12 + len;
  }
  const bpp = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8ClampedArray(width * height * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p]!;
    p += 1;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[p + i]!;
      const a = i >= bpp ? cur[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      let v = x;
      if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    p += stride;
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * bpp]!;
      out[o + 1] = cur[x * bpp + 1]!;
      out[o + 2] = cur[x * bpp + 2]!;
      out[o + 3] = 255;
    }
    prev.set(cur);
  }
  return { width, height, data: out };
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

function encodePng(image: ImageBuffer): Buffer {
  const { width, height, data } = image;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const o = y * (stride + 1) + 1 + x * 3;
      raw[o] = data[i]!;
      raw[o + 1] = data[i + 1]!;
      raw[o + 2] = data[i + 2]!;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const byte of b) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, payload: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc(body), 0);
    return Buffer.concat([len, body, check]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Decode once, iterate a hundred times. A raw RGBA dump beside the photo is
// the difference between a six-minute loop and a two-second one.
// ---------------------------------------------------------------------------

function load(name: string): ImageBuffer {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const cache = `${CACHE_DIR}/${name}.rgba`;
  const meta = `${CACHE_DIR}/${name}.json`;
  if (existsSync(cache) && existsSync(meta)) {
    const { width, height } = JSON.parse(readFileSync(meta, 'utf8')) as {
      width: number;
      height: number;
    };
    return { width, height, data: new Uint8ClampedArray(readFileSync(cache)) };
  }
  const image = decodePng(`${PHOTO_DIR}/${name}`);
  writeFileSync(cache, Buffer.from(image.data.buffer));
  writeFileSync(meta, JSON.stringify({ width: image.width, height: image.height }));
  return image;
}

const KIND_INK: Record<string, [number, number, number]> = {
  'domain-event': [255, 0, 0],
  command: [0, 0, 255],
  policy: [160, 0, 255],
  actor: [255, 230, 0],
  'read-model': [0, 200, 0],
  'external-system': [255, 0, 255],
  aggregate: [150, 120, 0],
  hotspot: [0, 255, 255],
};

function overlay(
  image: ImageBuffer,
  boxes: { x: number; y: number; w: number; h: number; kind: string }[],
): ImageBuffer {
  const data = new Uint8ClampedArray(image.data);
  const put = (x: number, y: number, ink: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const i = (y * image.width + x) * 4;
    data[i] = ink[0];
    data[i + 1] = ink[1];
    data[i + 2] = ink[2];
  };
  for (const box of boxes) {
    const ink = KIND_INK[box.kind] ?? [0, 0, 0];
    for (let t = 0; t < 2; t += 1) {
      for (let x = box.x; x < box.x + box.w; x += 1) {
        put(x, box.y + t, ink);
        put(x, box.y + box.h - 1 - t, ink);
      }
      for (let y = box.y; y < box.y + box.h; y += 1) {
        put(box.x + t, y, ink);
        put(box.x + box.w - 1 - t, y, ink);
      }
    }
  }
  return { width: image.width, height: image.height, data };
}

// The SWEEP: the same photograph at several working resolutions.
//
// This is the measurement that matters most, because it is the one that
// catches a threshold hiding in absolute pixels. A detector whose constants
// are all relative finds the same notes in the same photo whether it is given
// 1000px or 2048px of it; one that swings four-fold between them has a number
// somewhere that means "pixels" when it should mean "a fraction of a note".
//
//   npx tsx scripts/calibrate.ts --sweep
//
// Reads `r<width>-<photo>.png` for each width, which are plain resizes of the
// originals (`convert photo.jpg -resize 2048x2048 r2048-photo.png`).
function sweep() {
  const files = readdirSync(PHOTO_DIR).filter((f) => /^r\d+-.+\.png$/.test(f));
  const widths = [...new Set(files.map((f) => Number(f.match(/^r(\d+)-/)![1])))].sort(
    (a, b) => a - b,
  );
  const photos = [...new Set(files.map((f) => f.replace(/^r\d+-/, '')))].sort();
  if (photos.length === 0) {
    console.error(`no r<width>-*.png in ${PHOTO_DIR}`);
    process.exit(1);
  }

  console.log(`\nCOUNTS BY WORKING RESOLUTION (they should agree)\n`);
  console.log(`  ${'photo'.padEnd(26)}${widths.map((w) => `${w}px`.padStart(9)).join('')}`);
  for (const photo of photos) {
    const cells: string[] = [];
    for (const w of widths) {
      const name = `r${w}-${photo}`;
      if (!existsSync(`${PHOTO_DIR}/${name}`)) {
        cells.push('-'.padStart(9));
        continue;
      }
      const image = load(name);
      const found = detectStickies(image);
      cells.push(String(found.length).padStart(9));
      writeFileSync(`/tmp/calib-${name}`, encodePng(overlay(image, found)));
    }
    console.log(`  ${photo.replace('.png', '').padEnd(26)}${cells.join('')}`);
  }
  console.log(`\n  overlays: /tmp/calib-r<width>-<photo>.png\n`);
}

function main() {
  if (process.argv.includes('--sweep')) return sweep();
  const names = readdirSync(PHOTO_DIR)
    .filter((f) => /^(preview-|r\d+-)/.test(f) && f.endsWith('.png'))
    .sort();
  if (names.length === 0) {
    console.error(`no working copies in ${PHOTO_DIR}`);
    process.exit(1);
  }

  for (const name of names) {
    const image = load(name);
    const floors = wallFloorsOf(image);
    const started = performance.now();
    const found = detectStickies(image);
    const took = performance.now() - started;

    const kinds: Record<string, number> = {};
    for (const s of found) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;

    // What the mask thinks the whole frame is, sampled: a wall that reads as
    // paper is the failure that hides every other one.
    const mask: Record<string, number> = {};
    for (let i = 0; i < image.data.length; i += 4 * 11) {
      const c = classifyRgb(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, floors);
      mask[c] = (mask[c] ?? 0) + 1;
    }
    const total = Object.values(mask).reduce((a, b) => a + b, 0);
    const maskPct = Object.entries(mask)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${((v / total) * 100).toFixed(1)}%`)
      .join(', ');

    console.log(`\n${name}  ${image.width}x${image.height}  ${took.toFixed(0)}ms`);
    console.log(
      `  wall floors: s>=${floors.saturation.toFixed(2)} v>=${floors.value.toFixed(2)} hue=${floors.wallHue.toFixed(0)}`,
    );
    // Where boxes are lost: raw blobs -> kept -> merged -> split.
    const mask0 = classMaskOf(image, floors);
    const components = labelComponents(mask0);
    const boxes = fitBoxes(components);
    const largest = components.reduce(
      (m, c) => Math.max(m, Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1)),
      0,
    );
    console.log(
      `  blobs ${components.length} -> boxes ${boxes.length} -> found ${found.length} (largest blob side ${largest}px)`,
    );
    // The shape of the size distribution, which is what every threshold below
    // the mask is derived from.
    const merged = mergeFragments(
      components.map((c) => ({
        classId: c.classId,
        x: c.minX,
        y: c.minY,
        w: c.maxX - c.minX + 1,
        h: c.maxY - c.minY + 1,
        pixels: c.pixels,
      })),
      Math.max(2, Math.round(Math.max(image.width, image.height) * 0.006)) / 0.12,
    );
    const mins = merged.map((b) => Math.min(b.w, b.h)).sort((a, b) => a - b);
    const at = (q: number) => mins[Math.floor((mins.length - 1) * q)] ?? 0;
    console.log(
      `  merged ${merged.length} min-side p10=${at(0.1)} p25=${at(0.25)} p50=${at(0.5)} p75=${at(0.75)} p90=${at(0.9)} max=${at(1)}`,
    );
    console.log(`  found ${found.length}: ${JSON.stringify(kinds)}`);
    console.log(`  mask: ${maskPct}`);
    // The boxes themselves, so a wrong one can be looked up in the overlay.
    for (const s of found.slice(0, 60)) {
      const i = ((s.y + Math.floor(s.h / 2)) * image.width + s.x + Math.floor(s.w / 2)) * 4;
      const hsv = rgbToHsv({ r: image.data[i]!, g: image.data[i + 1]!, b: image.data[i + 2]! });
      console.log(
        `    #${String(s.id).padStart(2)} ${s.kind.padEnd(15)} ${String(s.w).padStart(3)}x${String(s.h).padStart(3)} @${String(s.x).padStart(4)},${String(s.y).padStart(4)} row${s.row} h=${hsv.h.toFixed(0).padStart(3)} s=${hsv.s.toFixed(2)} v=${hsv.v.toFixed(2)} conf=${s.confidence.toFixed(2)}`,
      );
    }
    // `--probe x,y[,x,y…]` — what the pixels at named spots actually are, for
    // when a note is missing and the question is why.
    const probeArg = process.argv.indexOf('--probe');
    if (probeArg !== -1 && name.includes(process.argv[probeArg + 2] ?? '')) {
      const nums = (process.argv[probeArg + 1] ?? '').split(',').map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = nums[i]!;
        const y = nums[i + 1]!;
        const o = (y * image.width + x) * 4;
        const hsv = rgbToHsv({ r: image.data[o]!, g: image.data[o + 1]!, b: image.data[o + 2]! });
        console.log(
          `    probe (${x},${y}) h=${hsv.h.toFixed(0)} s=${hsv.s.toFixed(2)} v=${hsv.v.toFixed(2)} -> ${classifyRgb(image.data[o]!, image.data[o + 1]!, image.data[o + 2]!, floors)}`,
        );
      }
    }
    const out = `/tmp/calib-${name}`;
    writeFileSync(out, encodePng(overlay(image, found)));
    console.log(`  overlay: ${out}`);
  }
}

main();
