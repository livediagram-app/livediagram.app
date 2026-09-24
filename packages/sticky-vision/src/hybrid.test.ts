import { describe, expect, it } from 'vitest';
import type { Box } from './boxes';
import type { ComponentMask } from './components';
import { combineWithModel, type HybridRules } from './hybrid';
import type { ModelCues, ModelNote } from './model-cues';

// The classical boxes and a boundary model's cues combined (spec/139 Phase 9,
// experiment group J). Everything here is drawn by hand: a class mask, the
// classical boxes on it, and the notes a model "saw".

const W = 200;
const H = 100;

function maskWith(...rects: { x: number; y: number; w: number; h: number; id: number }[]) {
  const classes = new Uint8Array(W * H);
  for (const r of rects)
    for (let y = r.y; y < r.y + r.h; y += 1)
      for (let x = r.x; x < r.x + r.w; x += 1) classes[y * W + x] = r.id;
  return { width: W, height: H, classes } satisfies ComponentMask;
}

function note(x: number, y: number, w: number, h: number, confidence = 0.9): ModelNote {
  const r = Math.round(Math.min(w, h) * 0.1);
  const core = { x: x + r, y: y + r, w: w - 2 * r, h: h - 2 * r };
  return { x, y, w, h, core, corePixels: core.w * core.h, confidence };
}

function cues(notes: ModelNote[], background = 0): ModelCues {
  return { width: W, height: H, notes, background: new Uint8Array(W * H).fill(background) };
}

const box = (x: number, y: number, w: number, h: number, classId = 1): Box => ({
  classId,
  x,
  y,
  w,
  h,
  pixels: w * h,
});

const SPLIT: HybridRules = { split: { minConfidence: 0.8, minAreaOfMedian: 0.3 } };
const ADD: HybridRules = {
  add: { minConfidence: 0.8, minAreaOfMedian: 0.3, minPaper: 0.5 },
};
const DROP: HybridRules = { drop: { minBackground: 0.9 } };

describe('combineWithModel', () => {
  const mask = maskWith(
    { x: 10, y: 10, w: 80, h: 40, id: 1 },
    { x: 120, y: 10, w: 40, h: 40, id: 2 },
  );
  const merged = box(10, 10, 80, 40);
  const single = box(120, 10, 40, 40, 2);

  it('changes nothing without rules', () => {
    const out = combineWithModel([merged, single], cues([note(10, 10, 40, 40)]), mask, {});
    expect(out).toEqual([merged, single]);
  });

  describe('split (J1)', () => {
    it('splits a box where the model sees two confident notes inside it', () => {
      const out = combineWithModel(
        [merged, single],
        cues([note(10, 10, 40, 40), note(50, 10, 40, 40), note(120, 10, 40, 40)]),
        mask,
        SPLIT,
      );
      expect(out).toHaveLength(3);
      expect(out).toContainEqual(
        expect.objectContaining({ x: 10, y: 10, w: 40, h: 40, classId: 1 }),
      );
      expect(out).toContainEqual(
        expect.objectContaining({ x: 50, y: 10, w: 40, h: 40, classId: 1 }),
      );
      expect(out).toContainEqual(single);
    });

    it('keeps each piece inside the box it came from', () => {
      const out = combineWithModel(
        [merged, single],
        cues([note(4, 6, 46, 48), note(50, 10, 40, 40)]),
        mask,
        SPLIT,
      );
      const left = out.find((b) => b.x < 30)!;
      expect(left).toMatchObject({ x: 10, y: 10, w: 40, h: 40 });
    });

    it('leaves the box whole when one of the notes is unsure', () => {
      const out = combineWithModel(
        [merged, single],
        cues([note(10, 10, 40, 40), note(50, 10, 40, 40, 0.6)]),
        mask,
        SPLIT,
      );
      expect(out).toEqual([merged, single]);
    });

    it('splits among the sure notes only, never into a speck', () => {
      const out = combineWithModel(
        [merged, single],
        cues([note(10, 10, 40, 40), note(50, 10, 40, 40), note(45, 42, 8, 8)]),
        mask,
        SPLIT,
      );
      expect(out.map((b) => b.x)).toEqual([10, 50, 120]);
    });

    it('leaves the box whole when one of the notes is a speck', () => {
      const out = combineWithModel(
        [merged, single],
        cues([note(10, 10, 40, 40), note(60, 20, 10, 10)]),
        mask,
        SPLIT,
      );
      expect(out).toEqual([merged, single]);
    });
  });

  describe('add (J2)', () => {
    const lone = maskWith(
      { x: 10, y: 10, w: 40, h: 40, id: 1 },
      { x: 120, y: 10, w: 40, h: 40, id: 3 },
    );
    const kept = box(10, 10, 40, 40);

    it('adds a confident model note on paper the classical boxes miss, in its paper colour', () => {
      const out = combineWithModel(
        [kept],
        cues([note(10, 10, 40, 40), note(120, 10, 40, 40)]),
        lone,
        ADD,
      );
      expect(out).toHaveLength(2);
      expect(out[1]).toMatchObject({ x: 120, y: 10, w: 40, h: 40, classId: 3, pixels: 1600 });
    });

    it('adds nothing where there is no paper', () => {
      const out = combineWithModel(
        [kept],
        cues([note(10, 10, 40, 40), note(60, 50, 40, 40)]),
        lone,
        ADD,
      );
      expect(out).toEqual([kept]);
    });

    it("adds a note a neighbouring box overlaps, when neither holds the other's centre", () => {
      const out = combineWithModel(
        [kept, box(100, 10, 38, 40, 3)],
        cues([note(10, 10, 40, 40), note(120, 10, 40, 40)]),
        lone,
        ADD,
      );
      expect(out).toHaveLength(3);
      expect(out[2]).toMatchObject({ x: 120, y: 10, w: 40, h: 40 });
    });

    it("adds nothing where a box holds the note's centre, or the note a box's", () => {
      const shifted = combineWithModel(
        [kept, box(125, 10, 40, 40, 3)],
        cues([note(10, 10, 40, 40), note(120, 10, 40, 40)]),
        lone,
        ADD,
      );
      expect(shifted).toHaveLength(2);
      const small = combineWithModel(
        [kept, box(130, 20, 20, 20, 3)],
        cues([note(10, 10, 40, 40), note(120, 10, 40, 40)]),
        lone,
        ADD,
      );
      expect(small).toHaveLength(2);
    });

    it('adds nothing where a classical box already covers the note', () => {
      const out = combineWithModel(
        [kept, box(115, 10, 40, 40, 3)],
        cues([note(10, 10, 40, 40), note(120, 10, 40, 40)]),
        lone,
        ADD,
      );
      expect(out).toHaveLength(2);
    });

    it('adds nothing the model is unsure of, or that is far smaller than the notes', () => {
      const out = combineWithModel(
        [kept],
        cues([note(10, 10, 40, 40), note(120, 10, 40, 40, 0.6), note(130, 60, 12, 12)]),
        maskWith({ x: 10, y: 10, w: 40, h: 40, id: 1 }, { x: 120, y: 10, w: 40, h: 70, id: 3 }),
        ADD,
      );
      expect(out).toEqual([kept]);
    });
  });

  describe('drop (J3)', () => {
    it('drops a box the model sees as background with no core in it, and says so', () => {
      const dropped: Box[] = [];
      const out = combineWithModel(
        [merged, single],
        cues([note(120, 10, 40, 40)], 250),
        mask,
        DROP,
        (b) => dropped.push(b),
      );
      expect(out).toEqual([single]);
      expect(dropped).toEqual([merged]);
    });

    it('keeps a box the model is unsure is background', () => {
      const out = combineWithModel([merged, single], cues([], 200), mask, DROP);
      expect(out).toEqual([merged, single]);
    });
  });

  it('refuses cues read from another image size', () => {
    const wrong = { ...cues([]), width: W + 1 };
    expect(() => combineWithModel([merged], wrong, mask, DROP)).toThrow(/cues/);
  });
});
