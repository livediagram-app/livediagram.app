import { describe, expect, it } from 'vitest';
import {
  freehandCanvasPoints,
  layOutIllustratePages,
  newLogoPage,
  packFreehandPoints,
  type Element,
  type FreehandElement,
} from '@livediagram/document';
import { logoGuideSnapper, logoTidyGuides, snapNewStrokes } from './logo-guide-snapping';

// docs/specs/007-editor/logo-pages.md "Construction guides": drawing snaps onto the shown guides.
const pages = layOutIllustratePages([newLogoPage('l')]);
const page = pages[0]!.rect;
const cx = page.x + page.width / 2;
const cy = page.y + page.height / 2;
const allParts = new Set(['centre', 'diagonals', 'safe', 'circles', 'square', 'grid'] as const);

const stroke = (pts: { x: number; y: number }[]): FreehandElement => ({
  id: 's',
  type: 'freehand',
  closed: false,
  ...packFreehandPoints(pts),
});

describe('logoGuideSnapper', () => {
  it('snaps near a shown guide, in screen px at the zoom', () => {
    const snap = logoGuideSnapper(pages, { on: true, parts: allParts })!;
    expect(snap({ x: cx + 5, y: cy - 3 }, 1)).toEqual({ x: cx, y: cy });
    // At half zoom, 8 screen px reach 16 canvas px: 12 px outside the inner circle.
    const circles = logoGuideSnapper(pages, { on: true, parts: new Set(['circles'] as const) })!;
    const r = (page.width * 0.5) / 2;
    const off = { x: cx + (r + 12) * Math.SQRT1_2, y: cy + (r + 12) * Math.SQRT1_2 };
    expect(circles(off, 1)).toBeNull();
    const on = circles(off, 0.5)!;
    expect(Math.hypot(on.x - cx, on.y - cy)).toBeCloseTo(r, 5);
  });

  it('is off while the guides are hidden, or off a logo page', () => {
    expect(logoGuideSnapper(pages, { on: false, parts: allParts })).toBeNull();
    expect(logoGuideSnapper(null, { on: true, parts: allParts })).toBeNull();
    const snap = logoGuideSnapper(pages, { on: true, parts: allParts })!;
    expect(snap({ x: page.x - 500, y: cy }, 1)).toBeNull();
  });
});

describe('snapNewStrokes', () => {
  const snap = logoGuideSnapper(pages, { on: true, parts: new Set(['centre'] as const) });

  it('moves a new stroke start and end onto the guides they began and finished near', () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ x: cx + 4 + i * 10, y: cy + 3 }));
    const [out] = snapNewStrokes([], [stroke(pts)], snap, 1) as FreehandElement[];
    const after = freehandCanvasPoints(out!);
    expect(after[0]!.x).toBeCloseTo(cx, 0);
    expect(after[0]!.y).toBeCloseTo(cy, 0);
    // The far middle is untouched.
    expect(after[12]!.x).toBeCloseTo(pts[12]!.x, 0);
  });

  it('leaves a highlighter stroke where it was drawn', () => {
    const hi = {
      ...stroke([
        { x: cx + 3, y: cy + 3 },
        { x: cx + 80, y: cy + 3 },
      ]),
      pen: 'highlighter' as const,
    };
    expect(snapNewStrokes([], [hi], snap, 1)[0]).toBe(hi);
  });

  it('leaves existing elements and strokes far from any guide alone', () => {
    const far = stroke([
      { x: cx + 100, y: cy + 100 },
      { x: cx + 150, y: cy + 140 },
    ]);
    const next: Element[] = [far];
    expect(snapNewStrokes([], next, snap, 1)).toBe(next);
    const near = stroke([
      { x: cx + 2, y: cy + 2 },
      { x: cx + 50, y: cy + 50 },
    ]);
    expect(snapNewStrokes([near], [near], snap, 1)[0]).toBe(near);
  });
});

describe('logoTidyGuides', () => {
  it('lines a straight run up with the nearest guide line along it, in screen px at the zoom', () => {
    const g = logoTidyGuides(pages, new Set(['grid', 'centre'] as const), 1)!;
    const gridStep = page.height / 8;
    // A level run 10 px under a grid line moves onto it; 30 px away it stays.
    expect(g.y(page.y + gridStep + 10, { x: cx + 40, y: page.y + gridStep })).toBe(
      page.y + gridStep,
    );
    expect(g.y(page.y + gridStep + 30, { x: cx + 40, y: page.y + gridStep })).toBeNull();
    expect(g.x(cx - 12, { x: cx, y: cy + 60 })).toBe(cx);
    expect(logoTidyGuides(null, allParts, 1)).toBeNull();
  });

  it('puts a corner on a crossing within its wider reach', () => {
    const g = logoTidyGuides(pages, allParts, 1)!;
    expect(g.point({ x: cx + 12, y: cy - 10 })).toEqual({ x: cx, y: cy });
  });
});
