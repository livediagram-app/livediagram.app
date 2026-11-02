import { describe, expect, it } from 'vitest';
import { cuesOf } from './cues';
import { idsFromBoxes, seamRadiusFor, threeClassMask, CLASS } from './mask';

// Probabilities as a model that is sure of itself would give them: one-hot
// from a three-class mask, with the core probability set to `coreP`.
function probsOf(notes: { x: number; y: number; w: number; h: number }[], w: number, h: number) {
  const ids = idsFromBoxes(notes, w, h);
  const classes = threeClassMask(ids, w, h, (id) =>
    seamRadiusFor(notes[id - 1]!.w, notes[id - 1]!.h),
  );
  const probs = new Float32Array(w * h * 3);
  for (let p = 0; p < w * h; p += 1) {
    const c = classes[p]!;
    if (c === CLASS.core) {
      probs[p * 3 + 1] = 0.9;
      probs[p * 3 + 2] = 0.1;
    } else if (c === CLASS.seam) probs[p * 3 + 2] = 1;
    else probs[p * 3] = 1;
  }
  return probs;
}

describe('cuesOf', () => {
  const flush = [
    { x: 10, y: 10, w: 40, h: 40 },
    { x: 50, y: 10, w: 40, h: 40 },
  ];

  it('gives each core blob as a note with its core, box and confidence', () => {
    const cues = cuesOf(probsOf(flush, 100, 60), 100, 60, {
      coreThreshold: 0.5,
      minCorePixels: 10,
    });
    expect(cues.width).toBe(100);
    expect(cues.height).toBe(60);
    expect(cues.notes).toHaveLength(2);
    for (const note of cues.notes) {
      expect(note.confidence).toBeCloseTo(0.9, 5);
      expect(note.core.w).toBeLessThan(note.w);
      expect(note.corePixels).toBe(note.core.w * note.core.h);
    }
    const left = cues.notes.find((n) => n.x < 30)!;
    expect(Math.abs(left.x - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(left.w - 40)).toBeLessThanOrEqual(2);
  });

  it('drops core specks under the pixel floor', () => {
    const cues = cuesOf(probsOf([{ x: 10, y: 10, w: 8, h: 8 }], 40, 40), 40, 40, {
      coreThreshold: 0.5,
      minCorePixels: 50,
    });
    expect(cues.notes).toHaveLength(0);
  });

  it('carries the background probability per pixel as 0..255', () => {
    const cues = cuesOf(probsOf(flush, 100, 60), 100, 60, {
      coreThreshold: 0.5,
      minCorePixels: 10,
    });
    expect(cues.background[0]).toBe(255);
    expect(cues.background[30 * 100 + 30]).toBe(0);
  });
});
