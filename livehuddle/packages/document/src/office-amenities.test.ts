import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { isGridOfficeShape, OFFICE_ART, ROOM_DOOR_WIDTH } from './office';
import { OFFICE_WORKPLACE_ART, WORKPLACE_TONES } from './office-workplace';
import {
  COUNTER_WORKTOP_Y,
  counterTopY,
  KITCHEN_TONES,
  KITCHEN_UNIT,
  OFFICE_KITCHEN_ART,
} from './office-kitchen';
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
  it('draws all thirteen as grid pieces at their own size, wordless, aspect locked, the same from every side', () => {
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
      expect(OFFICE_ART[kind].back).toBe(art);
      expect(OFFICE_ART[kind].side).toBe(art);
      expect(art.seats, kind).toEqual([]);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el), kind).toBe(true);
      expect([el.width, el.height], kind).toEqual([art.width, art.height]);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('keeps every rect and ellipse inside its grid', () => {
    for (const kind of KINDS) {
      const { width, height, parts } = OFFICE_ART[kind].front;
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
