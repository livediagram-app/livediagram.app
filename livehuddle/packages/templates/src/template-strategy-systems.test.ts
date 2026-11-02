// The Value Proposition Canvas (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the layout keeps what it
// holds where it belongs.
import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, ShapeElement, StickyElement } from '@livehuddle/document';
import { buildTemplate } from './build-template';

const shapes = (els: Element[], kind?: string) =>
  els.filter(
    (e): e is ShapeElement => e.type === 'shape' && (kind === undefined || e.shape === kind),
  );
const arrows = (els: Element[]) => els.filter((e): e is ArrowElement => e.type === 'arrow');
const pinnedIds = (a: ArrowElement) => [
  a.from.kind === 'pinned' ? a.from.elementId : null,
  a.to.kind === 'pinned' ? a.to.elementId : null,
];

describe('the Value Proposition Canvas', () => {
  const els = buildTemplate('value-proposition-canvas', 0, 0);
  const circle = shapes(els, 'circle').find((c) => c.width > 400)!;
  const notes = els.filter((e): e is StickyElement => e.type === 'sticky');

  it('keeps every Customer Profile note wholly inside its circle', () => {
    const r = circle.width / 2;
    const cx = circle.x + r;
    const cy = circle.y + r;
    const inside = notes.filter((n) => n.x >= circle.x && n.x <= circle.x + circle.width);
    expect(inside.length).toBe(12);
    for (const n of inside)
      for (const [x, y] of [
        [n.x, n.y],
        [n.x + n.width, n.y],
        [n.x, n.y + n.height],
        [n.x + n.width, n.y + n.height],
      ] as const)
        expect(Math.hypot(x - cx, y - cy), n.label).toBeLessThan(r);
  });

  it('joins each fit line from a note in the Value Map to a note in the profile', () => {
    const noteIds = new Set(notes.map((n) => n.id));
    const fits = arrows(els).filter((a) => a.arrowEnds === 'both');
    expect(fits).toHaveLength(4);
    for (const f of fits) for (const id of pinnedIds(f)) expect(noteIds.has(id!)).toBe(true);
  });
});
