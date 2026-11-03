import { describe, expect, it } from 'vitest';
import { createArrow, createPinnedArrow, createShape, type Element } from '@livehuddle/document';
import { overlayBetween } from '@/lib/drag-preview';
import { buildArrowLinks } from '@/components/canvas/drag-affected-arrows';
import { ridingElements } from './drag-ride';

// docs/specs/008-canvas/drag-preview.md "Moves ride an offset": what a preview only translates rides an offset.

const box = (id: string, x: number, y = 0) => ({ ...createShape('square', x, y), id });
const a = box('a', 0);
const b = box('b', 400);
const c = box('c', 0, 400);
const ab = { ...createPinnedArrow('a', 'e', 'b', 'w'), id: 'ab' };
const ac = { ...createPinnedArrow('a', 's', 'c', 'n'), id: 'ac' };
// From a free point to a: rides only when the gesture shifts its free end with a.
const loose = { ...createArrow(-200, 0, 0, 0), id: 'loose', to: ab.from };
const rider = {
  ...createArrow(0, 300, 0, 0),
  id: 'rider',
  to: { kind: 'on-arrow' as const, arrowId: 'ab', t: 0.5 },
};
const DOC: Element[] = [a, b, c, ab, ac, loose, rider];
const BEFORE = new Map(DOC.map((el) => [el.id, el]));
const LINKS = buildArrowLinks(DOC);

const rides = (next: Element[], still: ReadonlySet<string> = new Set()) =>
  Object.fromEntries(ridingElements(overlayBetween('t', next, DOC), BEFORE, LINKS, still));
const swap = (...els: Element[]) => DOC.map((el) => els.find((n) => n.id === el.id) ?? el);

describe('ridingElements', () => {
  it('lets moved boxes ride their own offsets, and an arrow between two boxes riding the same one', () => {
    expect(rides(swap({ ...a, x: 10, y: 5 }, { ...b, x: 410, y: 5 }))).toEqual({
      a: { dx: 10, dy: 5 },
      b: { dx: 10, dy: 5 },
      ab: { dx: 10, dy: 5 },
    });
  });

  it('re-routes an arrow whose ends move apart, or leave one end behind', () => {
    expect(rides(swap({ ...a, x: 10 }, { ...b, x: 420 }))).toEqual({
      a: { dx: 10, dy: 0 },
      b: { dx: 20, dy: 0 },
    });
    expect(rides(swap({ ...a, x: 10 }))).toEqual({ a: { dx: 10, dy: 0 } });
  });

  it('carries a selected arrow whose free end the gesture shifted with its pinned end', () => {
    const moved = { ...loose, from: { kind: 'free' as const, x: -190, y: 0 } };
    expect(rides(swap({ ...a, x: 10 }, moved))).toMatchObject({ loose: { dx: 10, dy: 0 } });
  });

  it('never carries a reshaped box, a re-anchored or reshaped arrow, or an arrow riding another', () => {
    expect(rides(swap({ ...a, width: 200 }))).toEqual({});
    const moveAll = [
      { ...a, x: 10 },
      { ...b, x: 410 },
      { ...c, x: 10 },
    ];
    const rebound = { ...ac, to: { ...ac.to, anchor: 'w' as const } };
    expect(rides(swap(...moveAll, rebound))).not.toHaveProperty('ac');
    const bent = { ...ab, curveOffset: { dx: 0, dy: 30 } };
    expect(rides(swap(...moveAll, bent))).not.toHaveProperty('ab');
    expect(rides(swap(...moveAll))).not.toHaveProperty('rider');
  });

  it('keeps the ids it is told to out, and needs a box moving to carry anything', () => {
    expect(rides(swap({ ...a, x: 10 }, { ...b, x: 410 }), new Set(['a']))).toEqual({
      b: { dx: 10, dy: 0 },
    });
    const freeOnly = { ...loose, from: { kind: 'free' as const, x: -190, y: 0 } };
    expect(rides(swap(freeOnly))).toEqual({});
    // An element the preview adds is not in the board it is laid over: it draws from the preview.
    const added = [...DOC, box('new', 900)];
    expect(ridingElements(overlayBetween('t', added, DOC), BEFORE, null, new Set()).size).toBe(0);
  });
});
