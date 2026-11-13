import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { fenceSegments } from '@livehuddle/avatar/collision';
import { FRONT_SPOT_GAP } from '@livehuddle/avatar/front-spot';
import { arcadeAt } from '@/components/canvas/collab/useSocialPieces';
import { receptionAt } from './office/useWorkdayPieces';
import { walkPointFor } from './avatar-click-intent';
import { frontWalkPoint } from './front-walk-point';

// docs/specs/009-elements/social-pieces.md "A crowded machine stays reachable" (Work Tracker 635).
type Boxed = Element & { x: number; y: number; width: number; height: number };
const machine = (id: string, x: number, chairFacing?: 'e') =>
  ({
    ...createShape('arcade-machine', x, 0),
    id,
    ...(chairFacing ? { chairFacing } : {}),
  }) as Boxed;
const fencesOf = (els: Element[]) => fenceSegments(els);
const shapes = (els: Element[]) => els.filter((e) => e.type === 'shape') as never[];
const click = (el: Boxed) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

describe('frontWalkPoint', () => {
  it('is walkPointFor with nobody in the way, and for a piece without a front', () => {
    const m = machine('m', 0);
    const els = [m];
    expect(frontWalkPoint(m, click(m), [], els, fencesOf(els))).toEqual(walkPointFor(m, click(m)));
    const chair = { ...createShape('chair', 0, 0), id: 'c' } as Element;
    expect(frontWalkPoint(chair, { x: 5, y: 5 }, [{ x: 5, y: 5 }], [chair], [])).toEqual({
      x: 5,
      y: 5,
    });
  });

  it('with two people at a machine, a third walks up still in reach of Insert Coin', () => {
    const m = machine('m', 0);
    const els = [m];
    const first = walkPointFor(m, click(m));
    const second = frontWalkPoint(m, click(m), [first], els, fencesOf(els));
    const third = frontWalkPoint(m, click(m), [first, second], els, fencesOf(els));
    for (const at of [first, second, third]) expect(arcadeAt(at, shapes(els))).toBe('m');
    for (const o of [first, second])
      expect(Math.hypot(o.x - third.x, o.y - third.y)).toBeGreaterThanOrEqual(FRONT_SPOT_GAP);
  });

  it('never ends at a neighbouring machine’s front, in a bank of machines', () => {
    const a = machine('a', 0);
    const b = machine('b', a.width);
    const els = [a, b];
    const first = walkPointFor(b, click(b));
    const second = frontWalkPoint(b, click(b), [first], els, fencesOf(els));
    expect(arcadeAt(second, shapes(els))).toBe('b');
  });

  it('searches down the side of a machine turned to face left or right', () => {
    const m = machine('m', 0, 'e');
    const els = [m];
    const first = walkPointFor(m, click(m));
    const second = frontWalkPoint(m, click(m), [first], els, fencesOf(els));
    expect(second.x).toBe(first.x);
    expect(second.y).not.toBe(first.y);
  });

  it('keeps a busy Reception Desk reachable', () => {
    const d = { ...createShape('reception-desk', 0, 0), id: 'd' } as Boxed;
    const els = [d];
    const first = walkPointFor(d, click(d));
    const second = frontWalkPoint(d, click(d), [first], els, fencesOf(els));
    expect(second).not.toEqual(first);
    expect(receptionAt(second, shapes(els))).toBe('d');
  });
});
