// The office dog keeps to free floor it can walk to (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog";
// the owner, 2026-11-27: "Make sure the receptionist and dog don't clash with other elements"): every spot it trots to
// and every step of the way there stays out of every piece's footprint, as the Real 3D view's models stand
// (setModelFootprints), and never crosses a wall, the same walls the player's walk is stopped by (fenceSegments).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createShape, pieceFacing, type Element } from '@livehuddle/document';
import { setModelFootprints, officeFootprints } from '@livehuddle/avatar/office-geometry';
import { fenceSegments, segmentsIntersect, type FenceSegment } from '@livehuddle/avatar/collision';
import { findWalkRoute } from '@livehuddle/avatar/pathing';
import { TEMPLATES } from '@livehuddle/templates';
import { buildTemplatedTab } from '../template-builders';
import { petAreasOf } from './useWorkdayPieces';
import { petGrid, petHome, petSpot } from './pet-route';

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

const piece = (shape: string, id: string, x: number, y: number, w?: number, h?: number) =>
  ({
    ...createShape(shape as Parameters<typeof createShape>[0], x, y),
    id,
    ...(w ? { width: w } : {}),
    ...(h ? { height: h } : {}),
  }) as Element;

beforeAll(() => setModelFootprints(pieceFacing));
afterAll(() => setModelFootprints(null));

const inside = (p: Point, b: Box) =>
  p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height;

/** Every footprint on the board, the 3D models' (model footprints on). */
function footprintsOf(elements: readonly Element[]): Box[] {
  const out: Box[] = [];
  for (const el of elements)
    if (el.type === 'shape' && el.shape !== 'room') out.push(...officeFootprints(el));
  return out;
}

/** The first problem with a walk along `path` from `from`, or null: a point in a footprint, or a leg across a wall. */
function clash(
  from: Point,
  path: readonly Point[],
  footprints: readonly Box[],
  walls: readonly FenceSegment[],
): string | null {
  let at = from;
  for (const p of path) {
    const len = Math.hypot(p.x - at.x, p.y - at.y);
    const steps = Math.max(1, Math.ceil(len / 4));
    for (let i = 1; i <= steps; i += 1) {
      const q = { x: at.x + ((p.x - at.x) * i) / steps, y: at.y + ((p.y - at.y) * i) / steps };
      const hit = footprints.find((b) => inside(q, b));
      if (hit) return `steps into a footprint at ${q.x},${q.y}`;
    }
    for (const w of walls)
      if (!w.solid && segmentsIntersect({ a: at, b: p }, w))
        return `crosses a wall from ${at.x},${at.y} to ${p.x},${p.y}`;
    at = p;
  }
  return null;
}

/** Each bed's dog over `legs` walks: every spot free floor, every trot round the pieces and inside the walls. */
function walkEveryLeg(elements: readonly Element[], legs = 160): string[] {
  const problems: string[] = [];
  const areas = petAreasOf(elements);
  const footprints = footprintsOf(elements);
  const walls = fenceSegments(elements);
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'pet-bed') continue;
    const area = areas.get(el.id)!;
    const grid = petGrid(area);
    const home = petHome(el);
    let at = home;
    for (let n = 0; n < legs; n += 1) {
      const spot = petSpot(el, area, grid, n);
      const goal = spot ?? home;
      if (spot) {
        const hit = footprints.find((b) => inside(spot, b));
        if (hit) problems.push(`${el.id} leg ${n}: spot ${spot.x},${spot.y} in a footprint`);
      }
      if (Math.hypot(goal.x - at.x, goal.y - at.y) >= 1) {
        const route = findWalkRoute(grid, at, goal);
        if (route) {
          const why = clash(at, route, footprints, walls);
          if (why) problems.push(`${el.id} leg ${n}: ${why}`);
        }
      }
      at = goal;
    }
  }
  return problems;
}

describe('the office dog among the furniture', () => {
  // A room packed round the bed: desks, a bookcase turned on its side (its 3D model is long), a plant, and an inner
  // room it keeps out of.
  const board = [
    piece('room', 'room', 0, 0, 900, 600),
    piece('pet-bed', 'bed', 400, 260),
    piece('desk', 'd1', 260, 200),
    piece('desk', 'd2', 520, 200),
    { ...(piece('bookshelf', 'shelf', 400, 120) as object), chairFacing: 'e' } as Element,
    piece('plant', 'plant', 380, 380),
    piece('coffee-machine', 'coffee', 120, 420),
    piece('room', 'inner', 640, 360, 220, 200),
  ];

  it('never targets a footprint, steps into one, or crosses a wall', () => {
    expect(walkEveryLeg(board)).toEqual([]);
  });

  it('still goes out, on a board where it can', () => {
    const areas = petAreasOf(board);
    const bed = board[1]!;
    if (bed.type !== 'shape') throw new Error('bed');
    const area = areas.get('bed')!;
    const grid = petGrid(area);
    const spots = Array.from({ length: 40 }, (_, n) => petSpot(bed, area, grid, n)).filter(Boolean);
    expect(spots.length).toBeGreaterThan(10);
  });

  it('passes over a spot it cannot walk to: a pocket walled off by pieces', () => {
    // The bed in a pen of desks: a spot in the room beyond is clear of every piece, but walled off from the bed.
    const pen = [
      piece('room', 'room', 0, 0, 900, 600),
      piece('pet-bed', 'bed', 100, 100),
      piece('bookshelf', 'b1', 40, 30, 260, 40),
      piece('bookshelf', 'b2', 40, 200, 260, 40),
      piece('bookshelf', 'b3', 30, 30, 40, 210),
      piece('bookshelf', 'b4', 240, 30, 40, 210),
    ];
    const bed = pen[1]!;
    if (bed.type !== 'shape') throw new Error('bed');
    const area = petAreasOf(pen).get('bed')!;
    const grid = petGrid(area);
    for (let n = 0; n < 80; n += 1) {
      const spot = petSpot(bed, area, grid, n);
      if (spot) expect(findWalkRoute(grid, petHome(bed), spot)).not.toBeNull();
      // Inside the pen, never out in the room past it.
      if (spot) expect(spot.x < 300 && spot.y < 260).toBe(true);
    }
  });
});

describe('every template with a Pet Bed', () => {
  for (const { kind } of TEMPLATES) {
    const elements = buildTemplatedTab(kind, 'default', 't', 'Tab').elements;
    if (!elements.some((el) => el.type === 'shape' && el.shape === 'pet-bed')) continue;
    it(`${kind}: the dog keeps to free floor inside its walls`, () => {
      expect(walkEveryLeg(elements, 60)).toEqual([]);
    });
  }
});
