import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import {
  roofOver,
  roofShape,
  roofsInArea,
  spaceRoofs,
  SPACE_ROOF_MAX_RISE,
  SPACE_ROOF_PITCH,
} from './space-3d-roofs';
import { SPACE_WALL_HEIGHT } from './space-3d-walls';

const shape = (kind: string, x: number, y: number, width: number, height: number, extra = {}) =>
  ({ ...createShape(kind as never, x, y), width, height, ...extra }) as Element;

const lawn = shape('grass', 0, 0, 2000, 2000);

describe('spaceRoofs', () => {
  it('roofs a room on grass, and none without a lawn', () => {
    const room = shape('room', 100, 100, 400, 300);
    expect(spaceRoofs([room])).toEqual([]);
    const [roof] = spaceRoofs([lawn, room]);
    expect(roof).toMatchObject({
      id: room.id,
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      across: false,
    });
  });
  it('runs a tall room’s ridge down the plan', () => {
    expect(spaceRoofs([lawn, shape('room', 100, 100, 200, 500)])[0]!.across).toBe(true);
  });
  it('leaves a room off the lawn, a turned or drawn room, and anything else', () => {
    const els = [
      lawn,
      shape('room', 3000, 3000, 400, 300),
      shape('room', 100, 100, 400, 300, { rotation: 15 }),
      shape('room', 100, 100, 400, 300, {
        roomOutline: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ],
      }),
      shape('rug', 100, 100, 100, 100),
    ];
    expect(spaceRoofs(els)).toEqual([]);
  });
});

describe('roofsInArea and roofOver', () => {
  const roofs = spaceRoofs([lawn, shape('room', 100, 100, 400, 300)]);
  it('keeps the roofs meeting the area', () => {
    expect(roofsInArea(roofs, { left: 0, top: 0, right: 200, bottom: 200 })).toHaveLength(1);
    expect(roofsInArea(roofs, { left: 600, top: 0, right: 900, bottom: 900 })).toHaveLength(0);
  });
  it('finds the roof over your feet', () => {
    expect(roofOver(roofs, { x: 300, y: 200 })).toBe(roofs[0]!.id);
    expect(roofOver(roofs, { x: 50, y: 50 })).toBeNull();
    expect(roofOver(roofs, null)).toBeNull();
  });
});

describe('roofShape', () => {
  it('pitches over half the span on the wall tops', () => {
    const [roof] = spaceRoofs([lawn, shape('room', 0, 0, 400, 200)]);
    const s = roofShape(roof!);
    expect(s).toMatchObject({ length: 400, span: 200, base: SPACE_WALL_HEIGHT });
    expect(s.rise).toBeCloseTo(100 * SPACE_ROOF_PITCH);
    expect(s.slant).toBeCloseTo(Math.hypot(100, s.rise));
    expect(s.pitch).toBeCloseTo(35, 0);
  });
  it('caps a big hall’s ridge, along its long side', () => {
    const [roof] = spaceRoofs([lawn, shape('room', 0, 0, 600, 1200)]);
    const s = roofShape(roof!);
    expect(s).toMatchObject({ length: 1200, span: 600, rise: SPACE_ROOF_MAX_RISE });
  });
});
