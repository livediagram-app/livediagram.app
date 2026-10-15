import { describe, expect, it } from 'vitest';
import {
  ATTACH_SNAP_PX,
  attachPointXY,
  canHost,
  createShape,
  settleChips,
  withAttached,
  type Element,
  type ShapeElement,
} from './index';

const host = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...(createShape('square', 0, 0) as ShapeElement),
  id: 'h',
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  ...over,
});

const badge = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...(createShape('badge', 0, 0) as ShapeElement),
  id: 'b',
  ...over,
});

const centre = (el: Element) => {
  const b = el as ShapeElement;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;

describe('attachment points (docs/specs/009-elements/badge.md "Attachment")', () => {
  it('names the corners and edge midpoints of the box', () => {
    const h = host();
    expect(attachPointXY(h, 'top-left')).toEqual({ x: 100, y: 100 });
    expect(attachPointXY(h, 'top-right')).toEqual({ x: 300, y: 100 });
    expect(attachPointXY(h, 'bottom')).toEqual({ x: 200, y: 200 });
    expect(attachPointXY(h, 'left')).toEqual({ x: 100, y: 150 });
  });

  it('turns the point with a rotated host', () => {
    const p = attachPointXY(host({ rotation: 90 }), 'top');
    // The top midpoint of a box turned a quarter clockwise sits on its right.
    expect(p.x).toBeCloseTo(250);
    expect(p.y).toBeCloseTo(150);
  });

  it('hosts ordinary elements, never a chip, a container or an annotation', () => {
    expect(canHost(host())).toBe(true);
    expect(canHost(badge())).toBe(false);
    expect(canHost(host({ shape: 'frame' }))).toBe(false);
    expect(canHost(host({ shape: 'boundary' as never }))).toBe(false);
    expect(canHost(host({ shape: 'stack' as never }))).toBe(false);
    expect(canHost(host({ shape: 'diagram-key' as never }))).toBe(false);
  });
});

describe('settleChips', () => {
  it('returns the same array when there is no chip', () => {
    const els = [host()];
    expect(settleChips([], els)).toBe(els);
  });

  it('attaches a new badge dropped on a point, and centres it there (I1)', () => {
    const b = badge({ x: 300 - 24 + 5, y: 100 - 12 + 5 });
    const out = settleChips([host()], [host(), b]);
    const settled = byId(out, 'b');
    expect(settled).toMatchObject({ attachedTo: 'h', attachAt: 'top-right' });
    expect(centre(settled)).toEqual({ x: 300, y: 100 });
  });

  it('leaves a new badge far from every point where it was', () => {
    const b = badge({ x: 500, y: 500 });
    const out = settleChips([host()], [host(), b]);
    expect(byId(out, 'b').attachedTo).toBeUndefined();
  });

  it('carries an attached badge to its point when the host moves or resizes', () => {
    const attached = badge({ attachedTo: 'h', attachAt: 'bottom-right' });
    const placed = settleChips([host(), attached], [host(), attached]);
    const moved = settleChips(placed, [host({ x: 400, width: 300 }), byId(placed, 'b')]);
    expect(centre(byId(moved, 'b'))).toEqual({ x: 700, y: 200 });
  });

  it('detaches a badge dragged away from a host that stayed put', () => {
    const before = settleChips([], [host(), badge({ attachedTo: 'h', attachAt: 'top-left' })]);
    const dragged = { ...byId(before, 'b'), x: 600, y: 600 };
    const out = settleChips(before, [host(), dragged]);
    expect(byId(out, 'b').attachedTo).toBeUndefined();
    expect(byId(out, 'b').x).toBe(600);
  });

  it('snaps a badge nudged within reach back onto its point', () => {
    const before = settleChips([], [host(), badge({ attachedTo: 'h', attachAt: 'top-left' })]);
    const nudged = { ...byId(before, 'b'), x: byId(before, 'b').x + ATTACH_SNAP_PX / 2 };
    const out = settleChips(before, [host(), nudged]);
    expect(centre(byId(out, 'b'))).toEqual({ x: 100, y: 100 });
  });

  it('deletes a badge with its host, and detaches one whose host never existed (I2)', () => {
    const before = settleChips([], [host(), badge({ attachedTo: 'h', attachAt: 'top' })]);
    expect(settleChips(before, [byId(before, 'b')])).toEqual([]);
    const stray = settleChips([], [badge({ attachedTo: 'nope', attachAt: 'top' })]);
    expect(byId(stray, 'b').attachedTo).toBeUndefined();
  });

  it('fits a badge to its text about its centre (I3)', () => {
    const b = badge({ x: 0, y: 0, width: 48, height: 24, label: 'Deprecated' });
    const out = byId(settleChips([b], [b]), 'b');
    expect(out.width).toBeGreaterThan(48);
    expect(centre(out)).toEqual({ x: 24, y: 12 });
  });

  it('numbers a new step and sizes its number to its disc', () => {
    const one = { ...(createShape('step', 0, 0) as ShapeElement), id: 's1', x: 0, label: '1' };
    const fresh = {
      ...(createShape('step', 0, 0) as ShapeElement),
      id: 's2',
      x: 400,
      width: 60,
      height: 60,
    };
    const out = settleChips([one], [one, fresh]);
    expect(byId(out, 's2')).toMatchObject({ label: '2', textSize: 30 });
  });

  it('leaves a locked badge where it is when its host moves', () => {
    const h = host();
    const b = { ...badge({ attachedTo: 'h', attachAt: 'top-left' }), locked: true } as ShapeElement;
    const settled = settleChips([], [h, b]);
    const at = byId(settled, 'b');
    // Placed new, it lands on its point all the same.
    expect(centre(at)).toEqual({ x: 100, y: 100 });
    const moved = settleChips(settled, [{ ...h, x: h.x + 300 }, at]);
    expect(byId(moved, 'b')).toMatchObject({ x: at.x, y: at.y, attachedTo: 'h' });
  });

  it('numbers several new steps in one write in turn', () => {
    const step = (id: string, x: number) =>
      ({ ...(createShape('step', 0, 0) as ShapeElement), id, x, label: '' }) as ShapeElement;
    const out = settleChips([], [step('a', 0), step('b', 100), step('c', 200)]);
    expect(['a', 'b', 'c'].map((id) => byId(out, id).label)).toEqual(['1', '2', '3']);
  });
});

describe('withAttached', () => {
  it('adds the chips attached to the given hosts', () => {
    const els = [host(), badge({ attachedTo: 'h', attachAt: 'top' }), badge({ id: 'c' })];
    expect([...withAttached(els, new Set(['h']))].sort()).toEqual(['b', 'h']);
    const ids = new Set(['c']);
    expect(withAttached(els, ids)).toBe(ids);
  });
});
