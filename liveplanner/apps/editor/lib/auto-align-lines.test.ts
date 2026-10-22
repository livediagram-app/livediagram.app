import { describe, expect, it } from 'vitest';
import {
  createPinnedArrow,
  createShape,
  type BoxedElement,
  type Element,
  type ShapeElement,
  type ShapeKind,
} from '@liveplanner/project';
import { autoAlignElements } from './auto-align';
import { LINK_TOLERANCE } from './auto-align-lines';

// docs/specs/008-canvas/layout-cleanup.md "Auto-align (grid snap)": boxes snap by the lines they share.

function box(id: string, x: number, y: number, w: number, h: number, kind: ShapeKind = 'square') {
  return { ...createShape(kind, x, y), id, width: w, height: h } as ShapeElement;
}
const find = (out: Element[], id: string) => out.find((e) => e.id === id) as BoxedElement;
const cx = (b: BoxedElement) => b.x + b.width / 2;

describe('alignBoxes via autoAlignElements', () => {
  it('keeps boxes of different widths centred on one column', () => {
    // The checkout's input step (250 wide) between two 220-wide steps, all centred at x = 251.5.
    const els = [
      box('a', 141.5, 100, 220, 64),
      box('b', 126.5, 210, 250, 72),
      box('c', 141.5, 330, 220, 72),
      { ...createPinnedArrow('a', 's', 'b', 'n'), id: 'ab' },
      { ...createPinnedArrow('b', 's', 'c', 'n'), id: 'bc' },
    ];
    const out = autoAlignElements(els);
    const centres = ['a', 'b', 'c'].map((id) => cx(find(out, id)));
    expect(new Set(centres).size).toBe(1);
    expect(centres[0]! % 5).toBe(0);
  });

  it('keeps left-aligned boxes left-aligned when their widths snap', () => {
    const els = [box('icon', 23, 100, 56, 24), box('icon2', 23, 150, 56, 34)];
    const out = autoAlignElements(els);
    expect(find(out, 'icon').x).toBe(find(out, 'icon2').x);
  });

  it('pulls two boxes joined by a straight arrow into line from further apart', () => {
    const els = [
      box('a', 100, 0, 200, 60),
      box('b', 100 + LINK_TOLERANCE - 2, 200, 200, 60),
      { ...createPinnedArrow('a', 's', 'b', 'n'), id: 'ab' },
    ];
    const out = autoAlignElements(els);
    expect(cx(find(out, 'a'))).toBe(cx(find(out, 'b')));
  });

  it('never makes two boxes overlap that did not', () => {
    // Two boxes 3 px apart whose grid lines would land them on top of each other.
    const els = [box('a', 0, 0, 104, 50), box('b', 107, 0, 100, 50)];
    const out = autoAlignElements(els);
    const a = find(out, 'a');
    const b = find(out, 'b');
    expect(a.x + a.width).toBeLessThanOrEqual(b.x);
  });

  it('never nudges a box out of the lane that holds it', () => {
    const els = [box('lane', 0, 0, 600, 100), box('step', 3, 30, 100, 40)];
    const out = autoAlignElements(els);
    expect(find(out, 'step').x).toBeGreaterThanOrEqual(find(out, 'lane').x);
  });

  it('leaves a locked box exactly where it is and lines others up to it', () => {
    const els = [box('fixed', 103, 0, 200, 60), box('free', 106, 200, 200, 60)];
    const out = autoAlignElements(els, new Set(['fixed']));
    expect(find(out, 'fixed')).toBe(els[0]);
    expect(find(out, 'free').x).toBe(103);
  });

  it('is idempotent', () => {
    const els = [
      box('a', 141.5, 100, 223, 64),
      box('b', 126.5, 213, 250, 72),
      box('c', 480, 205, 220, 70),
    ];
    const once = autoAlignElements(els);
    expect(autoAlignElements(once)).toEqual(once);
  });
});

describe('even spacing', () => {
  it('keeps a key’s rows evenly spaced, on the grid when that moves nothing far', () => {
    // Icons of mixed heights centred on rows 52 apart, at a top that is off the grid.
    const heights = [24, 30, 34, 28, 32];
    const els = heights.map((h, i) => box(`icon${i}`, 23, 313 + i * 52 + (36 - h) / 2, 56, h));
    const out = autoAlignElements(els);
    const centres = heights.map((_, i) => {
      const b = find(out, `icon${i}`);
      return b.y + b.height / 2;
    });
    const steps = centres.slice(1).map((c, i) => c - centres[i]!);
    expect(new Set(steps).size).toBe(1);
  });
});
