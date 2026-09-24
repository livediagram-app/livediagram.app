import { erodePaperMask } from './components';
import type { Box, PaperMask } from './boxes';

// Taking a blob apart at its NECKS (spec/139 Phase 9).
//
// Notes of one colour stuck in a grid with other colours between them — a
// column of actors beside a column of hotspots, a checkerboard — touch only
// at a corner, or along a sliver where one is stuck a little crooked. The
// close welds them into one sprawling blob, and a grid laid over that blob
// by the wall's note size cuts through the notes rather than between them.
// The paper itself says where they part: the joins are far thinner than any
// note, so an erosion a fraction of a note deep leaves one CORE per note,
// and every pixel of the blob goes back to the core it is nearest along the
// paper. Two notes flush along a whole side have no neck, and are left to
// the splitter.

// How deep the erosion bites, as a fraction of the note: a join thinner than
// twice this parts, while a note (at least half a note thick, even a small
// pad's) keeps a core.
const NECK_ERODE_FRACTION = 0.15;
// A core smaller than this square (in notes) is a tab, a corner or a curl,
// not a note: its pixels go to the note it hangs off.
const NECK_MIN_CORE = 0.25;

// The blob's own paper, padded by `pad` so the erosion bites at the box's
// edges too.
function regionOf(box: Box, mask: PaperMask, pad: number): PaperMask {
  const width = box.w + 2 * pad;
  const height = box.h + 2 * pad;
  const classes = new Uint8Array(width * height);
  for (let y = 0; y < box.h; y += 1) {
    const sy = y + box.y;
    if (sy < 0 || sy >= mask.height) continue;
    for (let x = 0; x < box.w; x += 1) {
      const sx = x + box.x;
      if (sx < 0 || sx >= mask.width) continue;
      if (mask.classes[sy * mask.width + sx] === box.classId)
        classes[(y + pad) * width + x + pad] = 1;
    }
  }
  return { width, height, classes };
}

// 4-connected labels of the set pixels, 1-based; 0 is unset.
function labelsOf(bin: Uint8Array, width: number, height: number): Int32Array {
  const labels = new Int32Array(bin.length);
  const stack: number[] = [];
  let next = 0;
  for (let start = 0; start < bin.length; start += 1) {
    if (bin[start] === 0 || labels[start] !== 0) continue;
    next += 1;
    labels[start] = next;
    stack.push(start);
    while (stack.length > 0) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      for (const q of [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ]) {
        if (q < 0 || bin[q] === 0 || labels[q] !== 0) continue;
        labels[q] = next;
        stack.push(q);
      }
    }
  }
  return labels;
}

// Split `box` at the necks of its paper into one box per note, or return it
// as it was when it has fewer than two cores.
export function splitAtNecks(box: Box, mask: PaperMask, noteSize: number): Box[] {
  if (noteSize <= 0 || box.w <= 0 || box.h <= 0) return [box];
  const radius = Math.max(1, Math.round(noteSize * NECK_ERODE_FRACTION));
  const region = regionOf(box, mask, radius);
  const { width, height } = region;
  const eroded = erodePaperMask(region, radius).classes;
  const labels = labelsOf(eroded, width, height);
  const counts = new Map<number, number>();
  for (const l of labels) if (l !== 0) counts.set(l, (counts.get(l) ?? 0) + 1);
  const minCore = (noteSize * NECK_MIN_CORE) ** 2;
  const cores = [...counts].filter(([, n]) => n >= minCore).map(([l]) => l);
  if (cores.length < 2) return [box];

  // Grow the cores back over the blob's paper, breadth first, so each pixel
  // goes to the core nearest it ALONG the paper: a pixel of one note never
  // goes to the note across a gap from it.
  const owner = new Int32Array(labels.length);
  const keep = new Set(cores);
  let frontier: number[] = [];
  for (let p = 0; p < labels.length; p += 1) {
    if (keep.has(labels[p]!)) {
      owner[p] = labels[p]!;
      frontier.push(p);
    }
  }
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q < 0 || q >= owner.length || region.classes[q] === 0 || owner[q] !== 0) continue;
        owner[q] = owner[p]!;
        next.push(q);
      }
    }
    frontier = next;
  }

  const pieces = new Map<number, Box>();
  for (let p = 0; p < owner.length; p += 1) {
    const o = owner[p]!;
    if (o === 0) continue;
    const x = (p % width) - radius + box.x;
    const y = Math.floor(p / width) - radius + box.y;
    const piece = pieces.get(o);
    if (!piece) {
      pieces.set(o, { classId: box.classId, x, y, w: 1, h: 1, pixels: 1 });
      continue;
    }
    const x1 = Math.max(piece.x + piece.w, x + 1);
    const y1 = Math.max(piece.y + piece.h, y + 1);
    piece.x = Math.min(piece.x, x);
    piece.y = Math.min(piece.y, y);
    piece.w = x1 - piece.x;
    piece.h = y1 - piece.y;
    piece.pixels += 1;
  }
  return [...pieces.values()];
}

export const NECK_CALIBRATION = { NECK_ERODE_FRACTION, NECK_MIN_CORE } as const;
