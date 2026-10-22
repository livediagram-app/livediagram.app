import { describe, expect, it } from 'vitest';
import { TALL_LAYOUT, WIDE_LAYOUT, type Box, type MindMapLayout } from './hero-mindmap-layout';

// The viewBoxes the scene is drawn in (hero-editor-window.tsx LANDSCAPE_VIEWBOX, hero-scenes.tsx PORTRAIT).
const WIDE_VIEW = { x: 0, y: -60, w: 600, h: 400 };
const TALL_VIEW = { x: 0, y: -40, w: 360, h: 520 };

const boxes = (L: MindMapLayout): [string, Box][] =>
  L.branches.flatMap((b) => [
    [b.label, b.node] as [string, Box],
    ...b.leaves.map((l) => [l.text, l.box] as [string, Box]),
  ]);

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each([
  ['wide', WIDE_LAYOUT, WIDE_VIEW],
  ['tall', TALL_LAYOUT, TALL_VIEW],
] as const)('the %s mind map', (_name, L, view) => {
  it('keeps every node and idea inside the viewBox', () => {
    for (const [, b] of boxes(L)) {
      expect(b.x).toBeGreaterThanOrEqual(view.x);
      expect(b.y).toBeGreaterThanOrEqual(view.y);
      expect(b.x + b.w).toBeLessThanOrEqual(view.x + view.w);
      expect(b.y + b.h).toBeLessThanOrEqual(view.y + view.h);
    }
  });

  it('never lays one box over another or over the centre', () => {
    const all = boxes(L);
    const c = L.centre;
    const centre = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    all.forEach(([name, a], i) => {
      expect(overlaps(a, centre), name).toBe(false);
      all
        .slice(i + 1)
        .forEach(([other, b]) => expect(overlaps(a, b), `${name} / ${other}`).toBe(false));
    });
  });

  it('rides the teammate onto the Events branch and each idea they add', () => {
    const events = L.branches.find((b) => b.key === 'events')!;
    expect(L.teammate).toHaveLength(2 + events.leaves.length);
  });
});
