// The Receptionist stands on free floor and walks round what blocks the player's walk (docs/specs/008-canvas/
// receptionist.md "The reception bell" and "His day"; the owner, 2026-11-27: "Make sure the receptionist and dog don't
// clash with other elements"): his bell spot behind a desk is never in a piece's footprint or a wall, a desk backed
// onto a wall or a piece has him at free floor behind its counter or beside its front, and every route of his day
// stays out of footprints (the Real 3D view's models, setModelFootprints) and never crosses a wall.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createShape, pieceFacing, type Element } from '@livehuddle/document';
import { officeFootprints, setModelFootprints } from '@livehuddle/avatar/office-geometry';
import {
  fenceReachFor,
  fenceSegments,
  pointSegmentDistance,
  segmentsIntersect,
  type FenceSegment,
} from '@livehuddle/avatar/collision';
import { buildNavGrid } from '@livehuddle/avatar/pathing';
import { TEMPLATES } from '@livehuddle/templates';
import { buildTemplatedTab } from '../template-builders';
import { receptionistRoute, receptionistStop, receptionistWorld } from './receptionist-day';
import { bellDetour } from './receptionist-timeline';

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

function worldOf(elements: readonly Element[]) {
  const fences = fenceSegments(elements);
  const grid = buildNavGrid(fences, fenceReachFor(1));
  return { world: receptionistWorld(elements, grid, fences)!, fences };
}

function footprintsOf(elements: readonly Element[]): Box[] {
  const out: Box[] = [];
  for (const el of elements)
    if (el.type === 'shape' && el.shape !== 'room') out.push(...officeFootprints(el));
  return out;
}

/** The first problem with a walk along `route` from `from`: a point in a footprint, or a leg across a wall. */
function clash(
  from: Point,
  route: readonly Point[],
  footprints: readonly Box[],
  walls: readonly FenceSegment[],
): string | null {
  let at = from;
  for (const p of route) {
    const len = Math.hypot(p.x - at.x, p.y - at.y);
    const steps = Math.max(1, Math.ceil(len / 4));
    for (let i = 1; i <= steps; i += 1) {
      const q = { x: at.x + ((p.x - at.x) * i) / steps, y: at.y + ((p.y - at.y) * i) / steps };
      if (footprints.some((b) => inside(q, b))) return `in a footprint at ${q.x},${q.y}`;
    }
    for (const w of walls)
      if (!w.solid && segmentsIntersect({ a: at, b: p }, w))
        return `across a wall from ${at.x},${at.y} to ${p.x},${p.y}`;
    at = p;
  }
  return null;
}

/** Where a rung bell takes him, checked: on free floor, clear of every wall's reach, by a route that clashes nowhere. */
function bellSpot(elements: readonly Element[], deskId: string): Point {
  const { world, fences } = worldOf(elements);
  const desk = elements.find((el) => el.id === deskId)!;
  if (desk.type !== 'shape') throw new Error('desk');
  const detour = bellDetour(world, 0, null, desk)!;
  expect(detour).not.toBeNull();
  const end = detour.route.at(-1)!;
  expect(clash(detour.from, detour.route, footprintsOf(elements), fences)).toBeNull();
  for (const w of fences) if (!w.solid) expect(pointSegmentDistance(end, w)).toBeGreaterThan(8);
  return end;
}

describe('answering the bell', () => {
  const room = piece('room', 'room', 0, 0, 1000, 700);
  const pad = piece('avatar-pad', 'pad', 460, 560);

  it('stands behind a desk in the open, past its back edge', () => {
    const desk = piece('reception-desk', 'desk', 400, 260);
    const end = bellSpot([room, pad, desk], 'desk');
    expect(end.y).toBeLessThan(260);
  });

  it('a desk backed onto the room wall: free floor behind its counter, never in the wall', () => {
    // The desk's box starts at the room's back wall: the spots past its back edge are in or beyond the wall.
    const desk = piece('reception-desk', 'desk', 400, 31);
    const end = bellSpot([room, pad, desk], 'desk');
    expect(end.y).toBeGreaterThan(31);
  });

  it('a bookcase right behind the desk: a free spot, never inside the bookcase', () => {
    const desk = piece('reception-desk', 'desk', 400, 300);
    const shelf = piece('bookshelf', 'shelf', 380, 168, 240, 132);
    const end = bellSpot([room, pad, desk, shelf], 'desk');
    for (const b of officeFootprints(shelf as never)) expect(inside(end, b)).toBe(false);
  });

  it('a desk turned to face east: behind it is its west side', () => {
    const desk = { ...(piece('reception-desk', 'desk', 400, 200) as object), chairFacing: 'e' };
    const end = bellSpot([room, pad, desk as Element], 'desk');
    expect(end.x).toBeGreaterThan(400 + 200 / 2);
  });
});

describe('every template with a Reception Desk', () => {
  for (const { kind } of TEMPLATES) {
    const elements = buildTemplatedTab(kind, 'default', 't', 'Tab').elements;
    const desks = elements.filter((el) => el.type === 'shape' && el.shape === 'reception-desk');
    if (desks.length === 0) continue;
    const { world, fences } = worldOf(elements);
    if (!world) continue;
    it(`${kind}: his bell spots and his day keep to free floor inside the walls`, () => {
      const footprints = footprintsOf(elements);
      for (const desk of desks) {
        if (desk.type !== 'shape') continue;
        const detour = bellDetour(world, 0, null, desk);
        if (!detour) continue;
        expect(clash(detour.from, detour.route, footprints, fences), `${kind} bell`).toBeNull();
      }
      for (let n = 1; n < 40; n += 1) {
        const from = receptionistStop(world, n - 1).at;
        const to = receptionistStop(world, n).at;
        const route = receptionistRoute(world.grid, from, to);
        if (!route) continue;
        expect(clash(from, route, footprints, fences), `${kind} leg ${n}`).toBeNull();
      }
    });
  }
});
