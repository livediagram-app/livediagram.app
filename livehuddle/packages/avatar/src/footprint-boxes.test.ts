import { describe, expect, it } from 'vitest';
import { fenceReachFor, fenceSegments, fenceStep } from './collision';
import { avatarScale } from './config';
import {
  footprintFraction,
  footprintFractions,
  isSceneryShape,
  isWallPieceShape,
  officeFootprint,
  officeFootprints,
  OFFICE_FOOTPRINT_BOXES,
} from './office-geometry';
import { buildNavGrid, findWalkPath } from './pathing';
import { elementUnderFeet } from './walk';

// docs/specs/009-elements/venue-pieces.md "How each one walks" (Work Tracker #609): a footprint of several boxes,
// with open floor between them. The Car Park blocks at its cars and kerb, the Stage Curtains at each drape's hem.

const REACH = fenceReachFor(avatarScale('regular'));
const piece = (shape: string, x: number, y: number, width: number, height: number, extra = {}) => ({
  id: `${shape}-${x}`,
  type: 'shape' as const,
  shape,
  x,
  y,
  width,
  height,
  ...extra,
});
type Piece = ReturnType<typeof piece>;

// A straight walk the way the walk loop takes it (13 px steps through fenceStep): where the feet stop.
function walk(els: Piece[], from: { x: number; y: number }, to: typeof from) {
  const fences = fenceSegments(els);
  let pos = from;
  for (let i = 0; i < 400; i++) {
    const dx = to.x - pos.x;
    const dy = to.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) break;
    const t = Math.min(13, d);
    const step = fenceStep(
      pos,
      { x: pos.x + (dx / d) * t, y: pos.y + (dy / d) * t },
      fences,
      REACH,
    );
    if (step.blocked && Math.hypot(step.pos.x - pos.x, step.pos.y - pos.y) < 0.01) break;
    pos = step.pos;
  }
  return pos;
}

describe('footprints of several boxes', () => {
  it('reads one box for a single-box piece, none for one that does not block', () => {
    expect(footprintFractions('plant')).toEqual([footprintFraction('plant')]);
    expect(footprintFractions('chair')).toEqual([]);
    expect(officeFootprints(piece('chair', 0, 0, 40, 40))).toEqual([]);
    expect(officeFootprint(piece('chair', 0, 0, 40, 40))).toBeNull();
  });

  it('gives the car park its kerb and two cars at each facing, the back as drawn, the right the side mirrored', () => {
    const boxes = OFFICE_FOOTPRINT_BOXES['car-park']!;
    expect(footprintFractions('car-park', 'n')).toBe(boxes.front);
    expect(footprintFractions('car-park', 's')).toBe(boxes.back);
    expect(footprintFractions('car-park', 'e')).toBe(boxes.side);
    expect(footprintFractions('car-park', 'w')).toEqual(
      boxes.side!.map((f) => ({ x0: 1 - f.x1, x1: 1 - f.x0, y0: f.y0, y1: f.y1 })),
    );
    for (const facing of ['n', 's', 'e', 'w'] as const) {
      const all = footprintFractions('car-park', facing);
      expect(all, facing).toHaveLength(3);
      for (const f of all) {
        expect(f.x0, facing).toBeGreaterThanOrEqual(0);
        expect(f.x1, facing).toBeLessThanOrEqual(1);
        expect(f.y0, facing).toBeGreaterThanOrEqual(0);
        expect(f.y1, facing).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps one drawing’s hems for the curtains at every facing, and makes them scenery, never a destination', () => {
    for (const facing of ['n', 's', 'e', 'w'] as const)
      expect(footprintFractions('stage-curtains', facing)).toHaveLength(2);
    expect(isSceneryShape('stage-curtains')).toBe(true);
    expect(isWallPieceShape('stage-curtains')).toBe(false);
    const curtains = piece('stage-curtains', 0, 0, 360, 120);
    expect(elementUnderFeet([curtains], { x: 180, y: 100 })).toBeNull();
    expect(elementUnderFeet([curtains], { x: 30, y: 110 })).toBeNull();
  });

  it('bounds a several-box footprint in one box for a caller after one place, and outlines each box as its own solid', () => {
    const park = piece('car-park', 100, 50, 240, 128);
    const boxes = officeFootprints(park);
    expect(officeFootprint(park)).toEqual({ x: 100, y: 50 + 18, width: 240, height: 120 - 18 });
    const solids = new Set(fenceSegments([park]).map((s) => s.solid));
    expect(solids.size).toBe(3);
    for (const b of boxes) expect([...solids]).toContainEqual(b);
  });

  it('joins car parks side by side at their cars and kerb, so a row still blocks', () => {
    const a = officeFootprints(piece('car-park', 0, 0, 240, 128));
    const b = officeFootprints(piece('car-park', 240, 0, 240, 128));
    // a's right car ends where b's left car starts, and the kerbs meet.
    expect(a[2]!.x + a[2]!.width).toBe(b[1]!.x);
    expect(a[0]!.x + a[0]!.width).toBe(b[0]!.x);
  });
});

describe('the car park’s empty bay', () => {
  const park = piece('car-park', 0, 0, 240, 128);

  it('walks a character from the front into the empty middle bay, up to the kerb', () => {
    const end = walk([park], { x: 120, y: 260 }, { x: 120, y: 60 });
    expect(Math.round(end.y)).toBe(60);
  });

  it('stops a character walking into either car at its bumper, and at the kerb from behind', () => {
    for (const x of [44, 196]) {
      const end = walk([park], { x, y: 260 }, { x, y: 60 });
      expect(end.y, String(x)).toBeGreaterThan(120);
    }
    const back = walk([park], { x: 120, y: -100 }, { x: 120, y: 60 });
    expect(back.y).toBeLessThan(18);
  });

  it('routes a click into the bay from beside the car park, round the car', () => {
    const grid = buildNavGrid(fenceSegments([park]), REACH);
    const path = findWalkPath(grid, { x: 320, y: 60 }, { x: 120, y: 70 });
    expect(path.at(-1)).toEqual({ x: 120, y: 70 });
    // The route leaves by the front, below the blue car's bumper.
    expect(Math.max(...path.map((p) => p.y))).toBeGreaterThan(120);
  });

  it('opens the bay from the far edge from behind, and from the side away from the kerb on its side', () => {
    const back = piece('car-park', 0, 0, 240, 128, { chairFacing: 's' });
    expect(Math.round(walk([back], { x: 120, y: -150 }, { x: 120, y: 70 }).y)).toBe(70);
    const side = piece('car-park', 0, 0, 128, 240, { chairFacing: 'e' });
    expect(Math.round(walk([side], { x: -150, y: 120 }, { x: 70, y: 120 }).x)).toBe(70);
    const mirrored = piece('car-park', 0, 0, 128, 240, { chairFacing: 'w' });
    expect(Math.round(walk([mirrored], { x: 300, y: 120 }, { x: 58, y: 120 }).x)).toBe(58);
  });
});

describe('the stage curtains’ drapes', () => {
  const curtains = piece('stage-curtains', 0, 0, 360, 120);

  it('stops a character walking up into each drape at its hem', () => {
    for (const x of [30, 330]) {
      const end = walk([curtains], { x, y: 260 }, { x, y: 60 });
      expect(end.y, String(x)).toBeGreaterThan(118);
    }
  });

  it('walks a character between the drapes, under the pelmet, onto the stage', () => {
    const end = walk([curtains], { x: 180, y: 260 }, { x: 180, y: 60 });
    expect(Math.round(end.y)).toBe(60);
  });

  it('routes round a drape to a point behind it', () => {
    const grid = buildNavGrid(fenceSegments([curtains]), REACH);
    const path = findWalkPath(grid, { x: 30, y: 200 }, { x: 30, y: 60 });
    expect(path.at(-1)).toEqual({ x: 30, y: 60 });
    expect(path.length).toBeGreaterThan(2);
  });
});
