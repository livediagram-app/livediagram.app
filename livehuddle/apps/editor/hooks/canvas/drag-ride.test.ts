import { describe, expect, it } from 'vitest';
import { createShape, isBoxed, type Element } from '@livehuddle/document';
import { overlayBetween } from '@/lib/drag-preview';
import { ridingElements } from '@liveworkspace/workbench/lib/drag-ride';

// docs/specs/008-canvas/drag-preview.md "Moves ride an offset": what a preview only translates rides an offset.

const box = (id: string, x: number, y = 0) => ({ ...createShape('focus-button', x, y), id });
const a = box('a', 0);
const b = box('b', 400);
// A retired arrow pinned between them (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"):
// it never rides, its ends are drawn from the preview.
const ab = {
  id: 'ab',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
  to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
} as Element;
const DOC: Element[] = [a, b, ab];
const BEFORE = new Map(DOC.map((el) => [el.id, el]));
// Retired arrows never ride (livehuddle's binding of the workbench's ride rules).
const RULES = { isBoxed, arrowsRide: false };

const rides = (next: Element[]) =>
  Object.fromEntries(ridingElements(overlayBetween('t', next, DOC), BEFORE, RULES));
const swap = (...els: Element[]) => DOC.map((el) => els.find((n) => n.id === el.id) ?? el);

describe('ridingElements', () => {
  it('lets moved boxes ride their own offsets, and never a retired arrow between them', () => {
    expect(rides(swap({ ...a, x: 10, y: 5 }, { ...b, x: 410, y: 5 }))).toEqual({
      a: { dx: 10, dy: 5 },
      b: { dx: 10, dy: 5 },
    });
  });

  it('never carries a reshaped box', () => {
    expect(rides(swap({ ...a, width: 200 }))).toEqual({});
  });

  it('carries nothing a preview adds', () => {
    // An element the preview adds is not in the board it is laid over: it draws from the preview.
    const added = [...DOC, box('new', 900)];
    expect(ridingElements(overlayBetween('t', added, DOC), BEFORE, RULES).size).toBe(0);
  });
});
