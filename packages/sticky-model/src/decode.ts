import { CLASS, noteFromCore, type Rect } from './mask';

// From the model's per-pixel classes to one box per note (experiment E3).
//
// Each 4-connected blob of CORE is one note: the model is trained to leave a
// seam between any two notes, so cores of lapped or flush neighbours never
// touch. The box is then either the core grown back by the seam width the
// training masks used (`core`), or the pixels a core claims by flooding
// outward through seam, first come first served (`grow`) — a watershed with
// the cores as markers, which follows the paper where a note is not square.

export type DecodeMode = 'core' | 'grow';

export type DecodeOptions = {
  mode: DecodeMode;
  // Smaller core blobs are specks of noise, not notes.
  minCorePixels: number;
};

export type DecodedBox = Rect & { corePixels: number };

export function labelCores(
  classes: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; count: number } {
  const labels = new Int32Array(classes.length);
  const queue = new Int32Array(classes.length);
  let count = 0;
  for (let start = 0; start < classes.length; start += 1) {
    if (classes[start] !== CLASS.core || labels[start] !== 0) continue;
    count += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = count;
    while (head < tail) {
      const p = queue[head++]!;
      const x = p % width;
      const neighbours = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        p >= width ? p - width : -1,
        p + width < width * height ? p + width : -1,
      ];
      for (const q of neighbours) {
        if (q < 0 || labels[q] !== 0 || classes[q] !== CLASS.core) continue;
        labels[q] = count;
        queue[tail++] = q;
      }
    }
  }
  return { labels, count };
}

type Extent = { minX: number; minY: number; maxX: number; maxY: number; pixels: number };

function extentsOf(labels: Int32Array, count: number, width: number): Extent[] {
  const ext: Extent[] = Array.from({ length: count + 1 }, () => ({
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    pixels: 0,
  }));
  for (let p = 0; p < labels.length; p += 1) {
    const l = labels[p]!;
    if (l <= 0) continue;
    const e = ext[l]!;
    const x = p % width;
    const y = (p - x) / width;
    if (x < e.minX) e.minX = x;
    if (x > e.maxX) e.maxX = x;
    if (y < e.minY) e.minY = y;
    if (y > e.maxY) e.maxY = y;
    e.pixels += 1;
  }
  return ext;
}

const rectOf = (e: Extent): Rect => ({
  x: e.minX,
  y: e.minY,
  w: e.maxX - e.minX + 1,
  h: e.maxY - e.minY + 1,
});

// Multi-source breadth-first flood from every core into seam pixels, each
// core going no further than the seam width its own size implies.
function growIntoSeam(
  classes: Uint8Array,
  labels: Int32Array,
  reach: Int32Array,
  width: number,
  height: number,
): Int32Array {
  const grown = new Int32Array(labels);
  const steps = new Int32Array(labels.length);
  const queue = new Int32Array(labels.length);
  let tail = 0;
  for (let p = 0; p < grown.length; p += 1) if (grown[p]! > 0) queue[tail++] = p;
  let head = 0;
  while (head < tail) {
    const p = queue[head++]!;
    const l = grown[p]!;
    if (steps[p]! >= reach[l]!) continue;
    const x = p % width;
    const neighbours = [
      x > 0 ? p - 1 : -1,
      x < width - 1 ? p + 1 : -1,
      p >= width ? p - width : -1,
      p + width < width * height ? p + width : -1,
    ];
    for (const q of neighbours) {
      if (q < 0 || grown[q] !== 0 || classes[q] !== CLASS.seam) continue;
      grown[q] = l;
      steps[q] = steps[p]! + 1;
      queue[tail++] = q;
    }
  }
  return grown;
}

export function decodeBoxes(
  classes: Uint8Array,
  width: number,
  height: number,
  opts: DecodeOptions,
): DecodedBox[] {
  const { labels, count } = labelCores(classes, width, height);
  const cores = extentsOf(labels, count, width);
  const keep = (l: number) => cores[l]!.pixels >= opts.minCorePixels;

  if (opts.mode === 'core') {
    const out: DecodedBox[] = [];
    for (let l = 1; l <= count; l += 1) {
      if (!keep(l)) continue;
      out.push({ ...noteFromCore(rectOf(cores[l]!)), corePixels: cores[l]!.pixels });
    }
    return out;
  }

  // One step past the implied seam, so a seam predicted a pixel wider than
  // the training masks' is still claimed.
  const reach = new Int32Array(count + 1);
  for (let l = 1; l <= count; l += 1) {
    const core = rectOf(cores[l]!);
    reach[l] = core.x - noteFromCore(core).x + 1;
  }
  const grown = extentsOf(growIntoSeam(classes, labels, reach, width, height), count, width);
  const out: DecodedBox[] = [];
  for (let l = 1; l <= count; l += 1) {
    if (!keep(l)) continue;
    out.push({ ...rectOf(grown[l]!), corePixels: cores[l]!.pixels });
  }
  return out;
}
