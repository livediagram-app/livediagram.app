import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { isGridOfficeShape, OFFICE_ART, ROOM_DOOR_WIDTH } from './office';
import { OFFICE_WORKPLACE_ART, WORKPLACE_TONES } from './office-workplace';
import {
  COUNTER_SIDE_WORKTOP,
  COUNTER_WORKTOP_Y,
  counterSideX,
  counterTopY,
  KITCHEN_TONES,
  KITCHEN_UNIT,
  KITCHEN_UNIT_SIDE,
  OFFICE_KITCHEN_ART,
} from './office-kitchen';
import { pieceFacing, turnPiece, turnsWithFacing } from './furniture-facing';
import { OFFICE_RESTROOM_ART, RESTROOM_TONES } from './office-restroom';
import { RESTROOM_LAYOUT, RESTROOM_SIGN, roomPresetCompanions } from './room-presets';
import { applyShapeVariant, RESTROOM_VARIANT } from './shape-variants';
import { withDoorPiece } from './room-builder';
import { isValidElement } from './validate';
import type { ShapeElement } from './index';

// docs/specs/009-elements/office-amenities.md
const ART = { ...OFFICE_WORKPLACE_ART, ...OFFICE_KITCHEN_ART, ...OFFICE_RESTROOM_ART };
const KINDS = Object.keys(ART) as (keyof typeof ART)[];

function partBounds(p: (typeof OFFICE_ART)['printer']['front']['parts'][number]) {
  if (p.tag === 'rect') return { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.h };
  if (p.tag === 'ellipse')
    return { x0: p.cx - p.rx, x1: p.cx + p.rx, y0: p.cy - p.ry, y1: p.cy + p.ry };
  // A path's every number, pairwise, as the points it names (absolute and relative alike stay near the grid).
  return null;
}

describe('the office amenities', () => {
  it('draws all thirteen as grid pieces at their own size, wordless and aspect locked', () => {
    expect(KINDS).toEqual([
      'printer',
      'copier',
      'lockers',
      'coat-rack',
      'umbrella-stand',
      'kitchen-counter',
      'kitchen-sink',
      'fridge',
      'microwave',
      'kettle',
      'toilet-cubicle',
      'washbasin',
      'hand-dryer',
    ]);
    for (const kind of KINDS) {
      expect(isGridOfficeShape(kind), kind).toBe(true);
      const art = OFFICE_ART[kind].front;
      expect(art).toBe(ART[kind].front);
      for (const view of ['front', 'back', 'side'] as const)
        expect(OFFICE_ART[kind][view].seats, kind).toEqual([]);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el), kind).toBe(true);
      expect([el.width, el.height], kind).toEqual([art.width, art.height]);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('keeps every rect and ellipse inside its grid, in every drawing', () => {
    for (const kind of KINDS)
      for (const view of ['front', 'back', 'side'] as const) {
        const { width, height, parts } = OFFICE_ART[kind][view];
        for (const p of parts) {
          const b = partBounds(p);
          if (!b) continue;
          expect(b.x0, kind).toBeGreaterThanOrEqual(0);
          expect(b.y0, kind).toBeGreaterThanOrEqual(0);
          expect(b.x1, kind).toBeLessThanOrEqual(width);
          expect(b.y1, kind).toBeLessThanOrEqual(height);
        }
      }
  });

  it('builds the counter and the sink as one run: the same grid, the same worktop', () => {
    const worktop = (kind: 'kitchen-counter' | 'kitchen-sink') =>
      OFFICE_ART[kind].front.parts.find((p) => p.tag === 'rect' && p.fill === KITCHEN_TONES.oak);
    for (const kind of ['kitchen-counter', 'kitchen-sink'] as const) {
      const { width, height } = OFFICE_ART[kind].front;
      expect({ width, height }).toEqual(KITCHEN_UNIT);
      expect(worktop(kind)).toMatchObject({ y: COUNTER_WORKTOP_Y, x: 0, w: KITCHEN_UNIT.width });
    }
  });

  it('stands a microwave and a kettle on the middle of a worktop', () => {
    const base = (kind: 'microwave' | 'kettle') => {
      const panels = OFFICE_ART[kind].front.parts.filter(
        (p): p is Extract<typeof p, { tag: 'rect' }> => p.tag === 'rect' && p.role === 'panel',
      );
      return Math.max(...panels.map((p) => p.y + p.h));
    };
    for (const kind of ['microwave', 'kettle'] as const)
      expect(counterTopY(kind, 100) + base(kind)).toBe(100 + COUNTER_WORKTOP_Y + 5);
  });

  it('keeps the paper white and the screens lit whatever the theme', () => {
    const fills = (kind: keyof typeof ART) => OFFICE_ART[kind].front.parts.map((p) => p.fill);
    expect(fills('printer')).toContain(WORKPLACE_TONES.paper);
    expect(fills('copier')).toContain(WORKPLACE_TONES.lit);
    expect(fills('toilet-cubicle')).toContain(RESTROOM_TONES.vacant);
    expect(fills('washbasin')).toContain(RESTROOM_TONES.mirror);
    // A machine's body is the theme's: its biggest panel has no fill of its own.
    for (const kind of ['printer', 'copier', 'fridge', 'microwave', 'hand-dryer'] as const)
      expect(
        OFFICE_ART[kind].front.parts.some((p) => p.role === 'panel' && !p.fill),
        kind,
      ).toBe(true);
  });
});

// docs/specs/009-elements/furniture-facing.md, office-amenities.md "Turned".
describe('the office amenities turned', () => {
  type Rect = Extract<(typeof OFFICE_ART)['printer']['front']['parts'][number], { tag: 'rect' }>;
  const rects = (kind: keyof typeof ART, view: 'front' | 'back' | 'side') =>
    OFFICE_ART[kind][view].parts.filter((p): p is Rect => p.tag === 'rect');
  const TURNING = KINDS.filter((k) => !['coat-rack', 'umbrella-stand', 'hand-dryer'].includes(k));

  it('turns all but the coat rack, the umbrella stand and the hand dryer, each with a back and a side of its own', () => {
    expect(TURNING).toHaveLength(10);
    for (const kind of KINDS) {
      const art = OFFICE_ART[kind];
      expect(turnsWithFacing(kind), kind).toBe(TURNING.includes(kind));
      if (!TURNING.includes(kind)) {
        expect([art.back, art.side], kind).toEqual([art.front, art.front]);
        continue;
      }
      expect(art.back, kind).not.toBe(art.front);
      expect(art.side, kind).not.toBe(art.front);
      // From behind it keeps its box; a quarter turn takes the side drawing's proportions about the same centre.
      expect([art.back.width, art.back.height], kind).toEqual([art.front.width, art.front.height]);
      const placed = createShape(kind, 100, 100);
      const left = turnPiece(placed, 'e');
      expect(pieceFacing(left), kind).toBe('e');
      expect(left.width / left.height, kind).toBeCloseTo(art.side.width / art.side.height);
      expect(left.x + left.width / 2, kind).toBeCloseTo(placed.x + placed.width / 2);
      expect(left.y + left.height / 2, kind).toBeCloseTo(placed.y + placed.height / 2);
    }
  });

  it('turns a bank of lockers narrow and long, its four doors one above the other down the left, on a plinth', () => {
    const { front, side } = OFFICE_ART.lockers;
    expect(side.width).toBeLessThan(front.width / 2);
    expect(side.height).toBeGreaterThan(front.height);
    const doors = rects('lockers', 'side').filter(
      (p) => p.fill === WORKPLACE_TONES.lockerA || p.fill === WORKPLACE_TONES.lockerB,
    );
    expect(doors).toHaveLength(4);
    expect(doors.map((d) => d.fill)).toEqual([
      WORKPLACE_TONES.lockerA,
      WORKPLACE_TONES.lockerB,
      WORKPLACE_TONES.lockerA,
      WORKPLACE_TONES.lockerB,
    ]);
    for (const [i, d] of doors.entries()) {
      expect(d.x + d.w).toBeLessThan(side.width / 2);
      if (i) expect(d.y).toBeGreaterThan(doors[i - 1]!.y + doors[i - 1]!.h);
    }
    // The plinth is the lowest thing standing.
    const plinth = rects('lockers', 'side').at(-1)!;
    expect(plinth.role).toBe('face');
    expect(plinth.y + plinth.h).toBeGreaterThan(Math.max(...doors.map((d) => d.y + d.h)));
    // Its back shows no doors.
    expect(OFFICE_ART.lockers.back.parts.some((p) => p.fill === WORKPLACE_TONES.lockerA)).toBe(
      false,
    );
  });

  it('builds turned counters and sinks into one run down a wall: one grid, one worktop the whole length', () => {
    for (const kind of ['kitchen-counter', 'kitchen-sink'] as const) {
      const { width, height } = OFFICE_ART[kind].side;
      expect({ width, height }, kind).toEqual(KITCHEN_UNIT_SIDE);
      // As long down the wall as the unit is across it.
      expect(height, kind).toBe(KITCHEN_UNIT.width);
      const worktop = rects(kind, 'side').find((p) => p.fill === KITCHEN_TONES.oak);
      expect(worktop, kind).toMatchObject({
        x: COUNTER_SIDE_WORKTOP.x,
        w: COUNTER_SIDE_WORKTOP.width,
        y: 0,
        h: KITCHEN_UNIT_SIDE.height,
      });
      // From behind the worktop stays at its front's line, so a microwave stands on it the same way.
      const back = rects(kind, 'back').find((p) => p.fill === KITCHEN_TONES.oak);
      expect(back, kind).toMatchObject({ y: COUNTER_WORKTOP_Y, x: 0, w: KITCHEN_UNIT.width });
    }
  });

  it('stands a turned microwave and kettle on the middle of a turned worktop, and on the same line from behind', () => {
    const baseOf = (kind: 'microwave' | 'kettle', view: 'front' | 'back') =>
      Math.max(
        ...rects(kind, view)
          .filter((p) => p.role === 'panel')
          .map((p) => p.y + p.h),
      );
    const sideBase = (kind: 'microwave' | 'kettle') => {
      const r = rects(kind, 'side').filter((p) => p.role !== 'shadow');
      return (Math.min(...r.map((p) => p.x)) + Math.max(...r.map((p) => p.x + p.w))) / 2;
    };
    const middle = COUNTER_SIDE_WORKTOP.x + COUNTER_SIDE_WORKTOP.width / 2;
    for (const kind of ['microwave', 'kettle'] as const) {
      expect(baseOf(kind, 'back'), kind).toBe(baseOf(kind, 'front'));
      const { width } = OFFICE_ART[kind].side;
      // Facing left, at twice the grid's size, on a counter at x 300.
      expect(counterSideX(kind, 300, 2) + sideBase(kind) * 2, kind).toBe(300 + middle * 2);
      // Facing right, both mirrored.
      expect(counterSideX(kind, 300, 2, true) + (width - sideBase(kind)) * 2, kind).toBe(
        300 + (KITCHEN_UNIT_SIDE.width - middle) * 2,
      );
      expect(counterSideX(kind, 300), kind).toBe(300 + middle - sideBase(kind));
      // Its base fits on the worktop.
      const r = rects(kind, 'side').filter((p) => p.role !== 'shadow');
      expect(
        Math.max(...r.map((p) => p.x + p.w)) - Math.min(...r.map((p) => p.x)),
        kind,
      ).toBeLessThanOrEqual(COUNTER_SIDE_WORKTOP.width);
    }
  });

  it('puts a turned washbasin’s mirror on the side wall behind it, and turned cubicles end to end', () => {
    const mirror = OFFICE_ART.washbasin.side.parts.find((p) => p.fill === RESTROOM_TONES.mirror)!;
    expect(mirror.tag).toBe('path');
    const xs = (mirror as { d: string }).d
      .match(/[\d.]+/g)!
      .map(Number)
      .filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeGreaterThan(OFFICE_ART.washbasin.side.width / 2);
    // From behind the glass is out of sight.
    expect(OFFICE_ART.washbasin.back.parts.some((p) => p.fill === RESTROOM_TONES.mirror)).toBe(
      false,
    );
    // A cubicle on its side: its partitions run its whole depth, the far one at the top and the near one at the foot.
    const side = OFFICE_ART['toilet-cubicle'].side;
    const partitions = rects('toilet-cubicle', 'side').filter(
      (p) => p.fill === RESTROOM_TONES.laminate && p.w > side.width * 0.9,
    );
    expect(Math.min(...partitions.map((p) => p.y))).toBeLessThan(side.height * 0.1);
    expect(Math.max(...partitions.map((p) => p.y + p.h))).toBeGreaterThan(side.height * 0.9);
    expect(side.parts.some((p) => p.fill === RESTROOM_TONES.vacant)).toBe(true);
  });
});

describe('the Restroom preset', () => {
  const room = (over: Partial<ShapeElement> = {}) =>
    ({
      ...applyShapeVariant(createShape('room', 100, 200), RESTROOM_VARIANT),
      ...over,
    }) as ShapeElement;

  it('names the room Restroom at a room’s own size, and leaves other rooms alone', () => {
    const plain = createShape('room', 0, 0);
    expect(room().label).toBe('Restroom');
    expect([room().width, room().height]).toEqual([plain.width, plain.height]);
    expect(applyShapeVariant(plain, 'something-else')).toBe(plain);
  });

  it('places the room, its Door, two cubicles, a hand dryer, two basins and a sign, in one list', () => {
    const els = withDoorPiece(room(), RESTROOM_VARIANT) as ShapeElement[];
    expect(els.map((e) => e.shape)).toEqual([
      'room',
      'door',
      'toilet-cubicle',
      'toilet-cubicle',
      'hand-dryer',
      'washbasin',
      'washbasin',
      'room-sign',
    ]);
    expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
    for (const el of els) expect(isValidElement(el), el.shape).toBe(true);
    // Without the variant, a room is just its room and Door.
    expect(withDoorPiece(room())).toHaveLength(2);
  });

  it('keeps every piece inside the room, clear of the doorway, and the sign by the door outside', () => {
    const r = room();
    const [, door, ...rest] = withDoorPiece(r, RESTROOM_VARIANT) as ShapeElement[];
    const sign = rest.pop()!;
    expect(rest).toHaveLength(RESTROOM_LAYOUT.length);
    for (const p of rest) {
      expect(p.x).toBeGreaterThanOrEqual(r.x);
      expect(p.x + p.width).toBeLessThanOrEqual(r.x + r.width);
      expect(p.y).toBeGreaterThanOrEqual(r.y);
      // On the floor, never across the door's way in (the bottom 80 px under the Door).
      expect(p.y + p.height).toBeLessThan(r.y + r.height - 80);
    }
    expect(door!.x + door!.width / 2).toBeCloseTo(r.x + r.width / 2, 0);
    expect(sign.width).toBe(RESTROOM_SIGN.width);
    expect(sign.x).toBeGreaterThanOrEqual(r.x + r.width / 2 + ROOM_DOOR_WIDTH / 2);
    expect(sign.y).toBe(r.y + r.height + RESTROOM_SIGN.gap);
    // Within the 64 px a sign reaches for its room (screen-and-room-sign.md "A piece's room").
    expect(sign.y + sign.height / 2 - (r.y + r.height)).toBeLessThan(64);
  });

  it('draws its pieces in the room’s stroke when it has one', () => {
    const els = withDoorPiece(room({ strokeColor: '#be123c' }), RESTROOM_VARIANT) as ShapeElement[];
    for (const el of els.slice(2)) expect(el.strokeColor, el.shape).toBe('#be123c');
    const plain = roomPresetCompanions(room(), RESTROOM_VARIANT);
    expect(plain[0]!.strokeColor).toBe(createShape('toilet-cubicle', 0, 0).strokeColor);
  });

  it('furnishes only a room, and only for its variant', () => {
    expect(roomPresetCompanions(createShape('chair', 0, 0), RESTROOM_VARIANT)).toEqual([]);
    expect(roomPresetCompanions(room(), undefined)).toEqual([]);
    expect(withDoorPiece(createShape('chair', 0, 0), RESTROOM_VARIANT)).toHaveLength(1);
  });
});
