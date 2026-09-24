import type { ModelCues, ModelNote } from '@livediagram/sticky-vision';
import { decodeBoxes, labelCores } from './decode';
import { CLASS } from './mask';

// The model's per-pixel probabilities as the plain cues the classical
// detector's hybrid rules read (`sticky-vision/src/hybrid.ts`): one note per
// core blob, its box flooded back through the seam (the `grow` decode), and the
// background probability everywhere. No size prior here: which notes to
// believe is the hybrid's question, asked against the classical boxes.

export type CueOptions = {
  // A pixel is core when its core probability reaches this.
  coreThreshold: number;
  // Smaller core blobs are specks, not notes.
  minCorePixels: number;
};

// Group J's sweep: the hybrid scores the same (94.7-94.8) for core thresholds
// 0.45-0.6 and core floors 12-45 pixels; 0.5 is the middle, and roughly the
// argmax.
export const CUE_OPTIONS: CueOptions = { coreThreshold: 0.5, minCorePixels: 12 };

export function coreClassesOf(probs: Float32Array, coreThreshold: number): Uint8Array {
  const n = probs.length / 3;
  const classes = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) {
    const bg = probs[p * 3]!;
    const seam = probs[p * 3 + 2]!;
    classes[p] =
      probs[p * 3 + 1]! >= coreThreshold ? CLASS.core : seam > bg ? CLASS.seam : CLASS.background;
  }
  return classes;
}

export function cuesOf(
  probs: Float32Array,
  width: number,
  height: number,
  opts: CueOptions,
): ModelCues {
  const classes = coreClassesOf(probs, opts.coreThreshold);
  const { labels, count } = labelCores(classes, width, height);
  const stats = Array.from({ length: count + 1 }, () => ({
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    pixels: 0,
    sum: 0,
  }));
  for (let p = 0; p < labels.length; p += 1) {
    const l = labels[p]!;
    if (l === 0) continue;
    const s = stats[l]!;
    const x = p % width;
    const y = (p - x) / width;
    s.minX = Math.min(s.minX, x);
    s.maxX = Math.max(s.maxX, x);
    s.minY = Math.min(s.minY, y);
    s.maxY = Math.max(s.maxY, y);
    s.pixels += 1;
    s.sum += probs[p * 3 + 1]!;
  }
  // `decodeBoxes` keeps the cores it keeps in label order, so the kept
  // labels line up with its boxes one for one.
  const kept = stats.slice(1).filter((s) => s.pixels >= opts.minCorePixels);
  const boxes = decodeBoxes(classes, width, height, {
    mode: 'grow',
    minCorePixels: opts.minCorePixels,
  });
  const notes: ModelNote[] = boxes.map((b, i) => {
    const s = kept[i]!;
    return {
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      core: { x: s.minX, y: s.minY, w: s.maxX - s.minX + 1, h: s.maxY - s.minY + 1 },
      corePixels: s.pixels,
      confidence: s.sum / s.pixels,
    };
  });
  const background = new Uint8Array(width * height);
  for (let p = 0; p < background.length; p += 1) {
    background[p] = Math.round(probs[p * 3]! * 255);
  }
  return { width, height, notes, background };
}
