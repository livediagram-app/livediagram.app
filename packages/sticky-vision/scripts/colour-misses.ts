import { classMaskOf, detectStickies } from '../src/detect';
import { labImageOf, type LabImage } from '../src/lab';
import { EVENT_STORMING_NOTES } from '@livediagram/diagram';
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng } from './png';
import { listPhotos, loadPhoto } from './photos';
import { photoDir, score, truthFor } from './truth';

// Why a labelled note is missed, told apart by COLOUR: is its paper classified
// as paper at all (then the loss is in the boxes), or is it read as wall (then
// it is the classifier's)? Prints, per wall, how many misses are which, and
// for the colour misses the note's CIELAB beside its ring's (the wall there).
//
//   npx tsx scripts/colour-misses.ts [photo-substring]
//
// Numbers only: nothing derived from the photographs is written anywhere.

const KIND_ID = new Map(EVENT_STORMING_NOTES.map((n, i) => [n.kind, i + 1]));
const PAPER_FRACTION_FOR_COLOUR_OK = 0.5;

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function labOf(lab: LabImage, xs: number[]): { l: number; a: number; b: number } {
  return {
    l: median(xs.map((p) => lab.l[p]!)),
    a: median(xs.map((p) => lab.a[p]!)),
    b: median(xs.map((p) => lab.b[p]!)),
  };
}

function main() {
  const only = process.argv[2];
  const dir = photoDir();
  for (const name of listPhotos(dir)) {
    if (only && !name.includes(only)) continue;
    const truth = truthFor(name);
    if (!truth) continue;
    const image = loadPhoto(dir, name);
    const { width, height } = image;
    const mask = classMaskOf(image);
    const lab = labImageOf(image);
    const found = detectStickies(image);
    const scored = score(truth, found, width, height);
    const missed = new Set(scored.missed);
    let colourMiss = 0;
    let shapeMiss = 0;
    const rows: string[] = [];
    for (const note of truth.notes) {
      if (!missed.has(note)) continue;
      const x0 = Math.round(note.x * width);
      const y0 = Math.round(note.y * height);
      const w = Math.round(note.w * width);
      const h = Math.round(note.h * height);
      const inset = Math.round(Math.min(w, h) * 0.2);
      const inside: number[] = [];
      let paper = 0;
      let own = 0;
      for (let y = y0 + inset; y < y0 + h - inset; y += 1) {
        for (let x = x0 + inset; x < x0 + w - inset; x += 1) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const p = y * width + x;
          inside.push(p);
          if (mask.classes[p]! > 0) paper += 1;
          if (mask.classes[p] === KIND_ID.get(note.kind)) own += 1;
        }
      }
      const ring: number[] = [];
      const reach = Math.round(Math.min(w, h) * 0.3);
      for (let y = y0 - reach; y < y0 + h + reach; y += 2) {
        for (let x = x0 - reach; x < x0 + w + reach; x += 2) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) continue;
          ring.push(y * width + x);
        }
      }
      // The wall is the least chromatic quarter of the ring.
      const chroma = (p: number) => Math.hypot(lab.a[p]!, lab.b[p]!);
      const wall = ring.sort((a, b) => chroma(a) - chroma(b)).slice(0, Math.ceil(ring.length / 4));
      // The paper is the brighter half of the inside (handwriting is dark).
      const bright = inside
        .sort((a, b) => lab.l[b]! - lab.l[a]!)
        .slice(0, Math.ceil(inside.length / 2));
      const n = labOf(lab, bright);
      const r = labOf(lab, wall);
      const frac = inside.length ? paper / inside.length : 0;
      const colourOk = frac >= PAPER_FRACTION_FOR_COLOUR_OK;
      if (colourOk) shapeMiss += 1;
      else colourMiss += 1;
      rows.push(
        `    ${colourOk ? 'shape ' : 'COLOUR'} ${note.kind.padEnd(15)} @${Math.round(x0 + w / 2)},${Math.round(y0 + h / 2)}` +
          ` paper ${(frac * 100).toFixed(0).padStart(3)}% own ${inside.length ? ((own / inside.length) * 100).toFixed(0).padStart(3) : '  -'}%` +
          `  note L${n.l.toFixed(0)} a${n.a.toFixed(0)} b${n.b.toFixed(0)}` +
          `  wall L${r.l.toFixed(0)} a${r.a.toFixed(0)} b${r.b.toFixed(0)}` +
          `  dE ${Math.hypot(n.l - r.l, n.a - r.a, n.b - r.b).toFixed(0)} dC ${(Math.hypot(n.a, n.b) - Math.hypot(r.a, r.b)).toFixed(0)}`,
      );
    }
    if (process.argv.includes('--mask')) drawMask(name, mask);
    if (process.argv.includes('--overlay'))
      drawOverlay(name, image, found, truth.notes, scored.spurious);
    console.log(
      `\n${name}: missed ${scored.missed.length} (colour ${colourMiss}, shape ${shapeMiss})`,
    );
    if (process.argv.includes('--list')) for (const row of rows) console.log(row);
  }
}

// The detections (red: spurious, green: matched) over the labels (white), in a
// folder of this tool's own so concurrent sweeps cannot overwrite it.
function drawOverlay(
  name: string,
  image: { width: number; height: number; data: Uint8ClampedArray },
  found: { x: number; y: number; w: number; h: number }[],
  notes: { x: number; y: number; w: number; h: number }[],
  spurious: { x: number; y: number; w: number; h: number }[],
) {
  const data = new Uint8ClampedArray(image.data);
  const put = (x: number, y: number, ink: number[]) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const i = (y * image.width + x) * 4;
    data[i] = ink[0]!;
    data[i + 1] = ink[1]!;
    data[i + 2] = ink[2]!;
  };
  const frame = (
    b: { x: number; y: number; w: number; h: number },
    ink: number[],
    step: number,
  ) => {
    for (let x = b.x; x < b.x + b.w; x += step) {
      put(Math.round(x), Math.round(b.y), ink);
      put(Math.round(x), Math.round(b.y + b.h - 1), ink);
    }
    for (let y = b.y; y < b.y + b.h; y += step) {
      put(Math.round(b.x), Math.round(y), ink);
      put(Math.round(b.x + b.w - 1), Math.round(y), ink);
    }
  };
  for (const n of notes) {
    frame(
      { x: n.x * image.width, y: n.y * image.height, w: n.w * image.width, h: n.h * image.height },
      [255, 255, 255],
      3,
    );
  }
  const bad = new Set(spurious);
  for (const b of found) frame(b, bad.has(b) ? [255, 0, 0] : [0, 255, 0], 1);
  mkdirSync('/tmp/es95a', { recursive: true });
  writeFileSync(
    `/tmp/es95a/overlay-${name.replace(/\.[^.]+$/, '')}.png`,
    encodePng({ width: image.width, height: image.height, data }),
  );
}

const MASK_INK: number[][] = [
  [0, 0, 0],
  [255, 120, 0],
  [0, 90, 255],
  [170, 0, 255],
  [255, 230, 0],
  [0, 200, 0],
  [255, 0, 200],
  [200, 200, 120],
  [255, 0, 80],
];
// The class mask, one colour per kind (black: wall, ink or unknown).
function drawMask(name: string, mask: { width: number; height: number; classes: Uint8Array }) {
  const data = new Uint8ClampedArray(mask.width * mask.height * 4);
  for (let p = 0; p < mask.classes.length; p += 1) {
    const ink = MASK_INK[mask.classes[p]!] ?? [128, 128, 128];
    data[p * 4] = ink[0]!;
    data[p * 4 + 1] = ink[1]!;
    data[p * 4 + 2] = ink[2]!;
    data[p * 4 + 3] = 255;
  }
  mkdirSync('/tmp/es95a', { recursive: true });
  writeFileSync(
    `/tmp/es95a/mask-${name.replace(/\.[^.]+$/, '')}.png`,
    encodePng({ width: mask.width, height: mask.height, data }),
  );
}

main();
