// docs/specs/008-canvas/3d-engine.md "Wall pieces sit on their wall": in real 3D a wall piece lies flat on the face of
// the wall it stands against, its back on the face, whichever wall it is on; never standing out like a blade, never
// floating off its wall or behind it.
import { describe, expect, it } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  mountedFace,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { RISE } from './models/kit';
import { screenPanel } from './models/first';
import { piecesMesh } from './scene-pieces';
import { WALL_THICKNESS } from './scene-walls';

const room = { ...createShape('room', 0, 0), id: 'r', width: 400, height: 300 } as Element;
const piece = (kind: string, x: number, y: number, over: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind as never, x, y), id: kind, ...over }) as ShapeElement;

// The model's extent on the canvas, from the pieces' one geometry.
function extent(els: Element[], id: string) {
  const m = piecesMesh(els);
  const r = m.ranges.get(id)!;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = r.from; i < r.to; i++) {
    xs.push(m.positions[i * 3]!);
    ys.push(m.positions[i * 3 + 1]!);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

describe('wall pieces in real 3D', () => {
  it("hangs a sign on a room's back wall on the room's side of it, its back on the wall's face", () => {
    const sign = piece('room-sign', 150, 4, { width: 88, height: 47 });
    const face = mountedFace(sign, [room, sign])!;
    expect(face).toMatchObject({ vertical: false, dir: 1 });
    const e = extent([room, sign], 'room-sign');
    expect(e.y0).toBeCloseTo(face.line + WALL_THICKNESS.wall / 2, 1);
    // Along the wall at its own width, about its middle.
    expect(e.x1 - e.x0).toBeLessThanOrEqual(88 + 0.01);
    expect((e.x0 + e.x1) / 2).toBeCloseTo(150 + 44, 0);
  });

  it('lays a sign by a side wall flat on that wall, not standing out from it', () => {
    // Just right of the room's left wall, facing the room's camera as a sign does.
    const sign = piece('room-sign', 8, 120, { width: 88, height: 47 });
    const face = mountedFace(sign, [room, sign])!;
    expect(face).toMatchObject({ vertical: true, dir: 1 });
    const e = extent([room, sign], 'room-sign');
    // Thin across the wall, its back on the face; its width runs along the wall.
    expect(e.x0).toBeCloseTo(face.line + WALL_THICKNESS.wall / 2, 1);
    expect(e.x1 - e.x0).toBeLessThan(6);
    expect(e.y1 - e.y0).toBeGreaterThan(60);
  });

  it('leaves a piece on no wall where it stands', () => {
    const sign = piece('room-sign', 1000, 1000, { width: 88, height: 47 });
    expect(mountedFace(sign, [room, sign])).toBeNull();
    const e = extent([room, sign], 'room-sign');
    expect(e.y0).toBeCloseTo(1000, 0);
  });

  it('rebuilds a hung piece when its wall moves, and keeps it when nothing changed', () => {
    const sign = piece('room-sign', 150, 4, { width: 88, height: 47 });
    const a = extent([room, sign], 'room-sign');
    const moved = { ...room, y: 6 } as Element;
    const b = extent([moved, sign], 'room-sign');
    expect(b.y0).toBeCloseTo(a.y0 + 6, 1);
  });
});

describe('the Screen in real 3D scales with its size', () => {
  const sizes = ['monitor', 'small', undefined, 'large', 'cinema'] as const;
  const built = sizes.map((variant) => {
    const el = applyShapeVariant(createShape('screen', 0, 0), variant);
    const m = piecesMesh([{ ...el, id: `s-${variant ?? 'medium'}` }]);
    const zs = m.positions.filter((_, i) => i % 3 === 2);
    return { el, top: Math.max(...zs), bottom: Math.min(...zs), panel: screenPanel(el.width) };
  });

  it('keeps every panel 16 by 9 up to a wall, a big one on a stand from the floor', () => {
    for (const b of built.slice(0, 3)) {
      expect(b.panel.stand).toBe(false);
      // Hung under the walls (152 as built, risen less than pieces): never on the floor.
      expect(b.top / RISE).toBeLessThan(130);
      expect(b.bottom).toBeGreaterThan(0);
    }
    expect((built[0]!.panel.z1 - built[0]!.panel.z0) / built[0]!.el.width).toBeCloseTo(9 / 16);
    for (const b of built.slice(3)) {
      expect(b.panel.stand).toBe(true);
      expect(b.bottom).toBeCloseTo(0);
    }
    // Each size stands taller than the one before it, its bezel no thinner.
    for (let i = 1; i < built.length; i++) {
      expect(built[i]!.top).toBeGreaterThan(built[i - 1]!.top);
      expect(built[i]!.panel.bezel).toBeGreaterThanOrEqual(built[i - 1]!.panel.bezel);
    }
  });
});
