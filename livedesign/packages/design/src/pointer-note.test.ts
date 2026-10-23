import { describe, expect, it } from 'vitest';
import {
  createShape,
  detachChip,
  isValidElement,
  pointerLeader,
  pointerTipOf,
  renderElementsToSvg,
  settleChips,
  snapPointerTip,
  withAttached,
  withPointerTip,
  type Element,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/pointer-note.md, blueprint pointer-note.md.

const host = (over: Partial<ShapeElement> = {}) =>
  ({
    ...createShape('square', 0, 0),
    id: 'host',
    x: 100,
    y: 100,
    width: 120,
    height: 60,
    ...over,
  }) as ShapeElement;

const note = (over: Partial<ShapeElement> = {}) =>
  ({
    ...createShape('pointer-note', 0, 0),
    id: 'note',
    x: 300,
    y: 20,
    ...over,
  }) as ShapeElement;

// A note whose tip sits on the host's top-right point (220, 100).
const attached = () =>
  note({ attachedTo: 'host', attachAt: 'top-right', pointerTip: { x: 220 - 300, y: 100 - 20 } });

const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;

describe('a pointer note', () => {
  it('starts as a valid amber note with its tip below its bottom-left', () => {
    const n = createShape('pointer-note', 0, 0);
    expect(isValidElement(n)).toBe(true);
    expect(pointerTipOf(n)).toEqual({ x: -24, y: 120 });
    expect(isValidElement({ ...n, pointerTip: { x: 1e6, y: 0 } })).toBe(false);
  });

  it('draws its leader from the box edge nearest the tip, and none when the tip is inside the box', () => {
    const n = note({ width: 180, height: 64, pointerTip: { x: -24, y: 120 } });
    expect(pointerLeader(n)).toEqual({ x1: 0, y1: 64, x2: -24, y2: 120 });
    expect(pointerLeader(withPointerTip(n, { x: 50, y: 20 }))).toBeNull();
  });
});

describe('settling a pointer note (I1, I2)', () => {
  it('carries the note when its host moves, keeping the tip on the point', () => {
    const prev = [host(), attached()];
    const next = [host({ x: 160, y: 140 }), attached()];
    const n = byId(settleChips(prev, next), 'note');
    expect(n.x + pointerTipOf(n).x).toBeCloseTo(280, 5);
    expect(n.y + pointerTipOf(n).y).toBeCloseTo(140, 5);
  });

  it('keeps the note where it was moved and re-aims the tip at the point', () => {
    const prev = [host(), attached()];
    const next = [host(), { ...attached(), x: 400, y: 300 }];
    const n = byId(settleChips(prev, next), 'note');
    expect(n.x).toBe(400);
    expect(n.x + pointerTipOf(n).x).toBeCloseTo(220, 5);
    expect(n.y + pointerTipOf(n).y).toBeCloseTo(100, 5);
  });

  it('goes with its host when the host is deleted, and is detached when the host is unknown', () => {
    expect(settleChips([host(), attached()], [attached()]).some((e) => e.id === 'note')).toBe(
      false,
    );
    const orphan = byId(settleChips([], [attached()]), 'note');
    expect(orphan.attachedTo).toBeUndefined();
  });

  it('is never attached by landing its box on a point, only by its tip', () => {
    const loose = note({ x: 210, y: 90 });
    const n = byId(settleChips([host()], [host(), loose]), 'note');
    expect(n.attachedTo).toBeUndefined();
  });

  it('travels with its host when the host is dragged or copied, and detaches on its own', () => {
    expect([...withAttached([host(), attached()], new Set(['host']))].sort()).toEqual([
      'host',
      'note',
    ]);
    expect(detachChip(attached()).attachedTo).toBeUndefined();
  });
});

describe('the tip handle (snapPointerTip)', () => {
  it('attaches to the nearest point within reach', () => {
    const snap = snapPointerTip([host(), note()], note(), { x: 224, y: 104 });
    expect(snap).toEqual({
      pointerTip: { x: 220 - 300, y: 100 - 20 },
      attachedTo: 'host',
      attachAt: 'top-right',
    });
  });

  it('leaves the tip free where it was let go when no point is in reach', () => {
    expect(snapPointerTip([host(), note()], note(), { x: 600, y: 600 })).toEqual({
      pointerTip: { x: 300, y: 580 },
    });
  });
});

describe('exporting a pointer note (I3)', () => {
  it('draws the box, the label, the leader and the tip, and frames the tip', () => {
    const n = note({ x: 0, y: 0, width: 180, height: 64, pointerTip: { x: -24, y: 120 } });
    const svg = renderElementsToSvg(
      { id: 't', name: 't', elements: [n] },
      {
        padding: 0,
      },
    );
    expect(svg).toContain('Stale for 60');
    expect(svg).toContain('<line x1="0" y1="64" x2="-24" y2="120"');
    expect(svg).toContain('<circle cx="-24" cy="120" r="3.5"');
    expect(svg).toMatch(/viewBox="-28 0 /);
  });
});
