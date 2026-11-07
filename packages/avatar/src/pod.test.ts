import { describe, expect, it } from 'vitest';
import {
  closePods,
  podClosed,
  podDoorFront,
  podInterior,
  podWalls,
  podDoorway,
  POD_DOOR_FRONT_PX,
  POD_DOOR_SPAN,
  POD_SIDE_DOOR_SPAN,
} from './pod';
import { fenceSegments, fenceStep } from './collision';
import { POD_SEATS, seatPoints } from './seats';

// livehuddle's docs/specs/009-elements/office.md "Office Pod".
const pod = (over: Record<string, unknown> = {}) => ({
  id: 'pod',
  type: 'shape',
  shape: 'office-pod',
  x: 100,
  y: 200,
  width: 176,
  height: 144,
  ...over,
});

describe('the pod’s walls', () => {
  it('runs round all four sides and the back wall’s foot, the front broken at the doorway', () => {
    const walls = podWalls(pod());
    expect(walls).toHaveLength(6);
    const front = walls.filter((w) => w.a.y === 200 + 140 && w.b.y === 200 + 140);
    expect(front).toEqual([
      { a: { x: 104, y: 340 }, b: { x: 100 + POD_DOOR_SPAN[0], y: 340 } },
      { a: { x: 100 + POD_DOOR_SPAN[1], y: 340 }, b: { x: 272, y: 340 } },
    ]);
  });

  it('shuts the doorway while the door is closed', () => {
    const walls = podWalls(pod({ podClosed: true }));
    expect(walls).toHaveLength(7);
    expect(walls[6]).toEqual({
      a: { x: 100 + POD_DOOR_SPAN[0], y: 340 },
      b: { x: 100 + POD_DOOR_SPAN[1], y: 340 },
    });
  });

  it('scales with the pod, fitted whole and centred in its box', () => {
    const walls = podWalls(pod({ width: 352, height: 400 }));
    // Twice the grid, letterboxed down the taller box: (400 - 288) / 2 = 56 above.
    expect(walls[0]).toEqual({ a: { x: 108, y: 264 }, b: { x: 444, y: 264 } });
  });

  it('lets a character in through the open doorway and keeps it out once shut', () => {
    const doorway = { x: 100 + (POD_DOOR_SPAN[0] + POD_DOOR_SPAN[1]) / 2, y: 380 };
    const inside = { x: doorway.x, y: 320 };
    const open = fenceStep(doorway, inside, fenceSegments([pod()]));
    expect(open.blocked).toBe(false);
    const shut = fenceStep(doorway, inside, fenceSegments([pod({ podClosed: true })]));
    expect(shut.blocked).toBe(true);
    expect(shut.pos.y).toBeGreaterThan(340);
  });

  it('keeps a character coming from behind outside the pod', () => {
    const step = fenceStep({ x: 188, y: 180 }, { x: 188, y: 230 }, fenceSegments([pod()]));
    expect(step.blocked).toBe(true);
    expect(step.pos.y).toBeLessThan(200);
  });
});

describe('the pod’s floor and seats', () => {
  it('is the floor inside its walls', () => {
    expect(podInterior(pod())).toEqual({ x: 104, y: 236, width: 168, height: 104 });
  });

  // livehuddle's docs/specs/012-collaboration/knock.md "Knocking": standing at a closed pod's door.
  it('has a strip in front of its doorway, outside the front wall', () => {
    expect(podDoorFront(pod())).toEqual({ x: 154, y: 340, width: 68, height: POD_DOOR_FRONT_PX });
  });

  it('seats two facing each other, both inside the walls', () => {
    const seats = seatPoints(pod() as Parameters<typeof seatPoints>[0]);
    expect(seats.map((s) => s.facing)).toEqual(['right', 'left']);
    const inside = podInterior(pod());
    for (const s of seats) {
      expect(s.x).toBeGreaterThan(inside.x);
      expect(s.x).toBeLessThan(inside.x + inside.width);
      expect(s.y).toBeGreaterThan(inside.y);
      expect(s.y).toBeLessThan(inside.y + inside.height);
    }
  });
});

describe('the pod’s door', () => {
  it('is shut while every seat is held', () => {
    expect(podClosed(0)).toBe(false);
    expect(podClosed(1)).toBe(false);
    expect(podClosed(POD_SEATS.seats.length)).toBe(true);
  });

  it('marks the pods peers fill, and hands the same board back when none is full', () => {
    const board = [pod(), pod({ id: 'other' }), { id: 'a', type: 'arrow' }];
    expect(closePods(board, [])).toBe(board);
    expect(closePods(board, [{ seatedOn: 'pod' }, { seatedOn: null }])).toBe(board);
    const shut = closePods(board, [{ seatedOn: 'pod' }, { seatedOn: 'pod' }, {}]);
    expect(shut).not.toBe(board);
    expect(shut[0]).toMatchObject({ id: 'pod', podClosed: true });
    expect(shut[1]).toBe(board[1]);
    expect(shut[2]).toBe(board[2]);
  });

  it('never shuts something that is not a pod', () => {
    const chair = { ...pod({ id: 'c' }), shape: 'chair' };
    const board = [chair];
    expect(closePods(board, [{ seatedOn: 'c' }, { seatedOn: 'c' }])).toBe(board);
  });
});

// livehuddle's docs/specs/009-elements/furniture-facing.md "A turn": the walls, the doorway, the floor and the door's
// strip turn with the pod. A turned pod's box takes its turned drawing's proportions (144 x 176 on its side).
describe('a turned pod', () => {
  const side = (chairFacing: 'e' | 'w', over: Record<string, unknown> = {}) =>
    pod({ chairFacing, width: 144, height: 176, ...over });
  const step = (
    el: Record<string, unknown>,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => fenceStep(from, to, fenceSegments([el as ReturnType<typeof pod>]));

  it('has its doorway in its left wall facing left, and lets a character in through it', () => {
    const el = side('e');
    const door = podDoorway(el);
    const mid = (POD_SIDE_DOOR_SPAN[0] + POD_SIDE_DOOR_SPAN[1]) / 2;
    expect(door).toEqual({
      at: { x: 104, y: 200 + mid },
      width: POD_SIDE_DOOR_SPAN[1] - POD_SIDE_DOOR_SPAN[0],
      out: { x: -1, y: 0 },
    });
    expect(step(el, { x: 80, y: 200 + mid }, { x: 130, y: 200 + mid }).blocked).toBe(false);
    // Its old doorway, the bottom wall, is shut.
    expect(step(el, { x: 172, y: 390 }, { x: 172, y: 360 }).blocked).toBe(true);
    // The doorway shuts with the door.
    const shut = step(
      side('e', { podClosed: true }),
      { x: 80, y: 200 + mid },
      { x: 130, y: 200 + mid },
    );
    expect(shut.blocked).toBe(true);
    expect(podWalls(side('e', { podClosed: true }))).toHaveLength(7);
  });

  it('mirrors it into its right wall facing right', () => {
    const el = side('w');
    const mid = (POD_SIDE_DOOR_SPAN[0] + POD_SIDE_DOOR_SPAN[1]) / 2;
    expect(podDoorway(el).out).toEqual({ x: 1, y: 0 });
    expect(podDoorway(el).at).toEqual({ x: 240, y: 200 + mid });
    expect(step(el, { x: 270, y: 200 + mid }, { x: 220, y: 200 + mid }).blocked).toBe(false);
    expect(step(el, { x: 80, y: 200 + mid }, { x: 130, y: 200 + mid }).blocked).toBe(true);
  });

  it('has its floor inside its turned walls, its seats on it', () => {
    for (const chairFacing of ['e', 'w'] as const) {
      const el = side(chairFacing);
      const inside = podInterior(el);
      expect(inside).toEqual({ x: 104, y: 236, width: 136, height: 136 });
      const seats = seatPoints({ ...el, shape: 'office-pod' });
      expect(seats.map((s) => s.facing)).toEqual(['down', 'up']);
      for (const s of seats) {
        expect(s.x).toBeGreaterThan(inside.x);
        expect(s.x).toBeLessThan(inside.x + inside.width);
        expect(s.y).toBeGreaterThan(inside.y);
        expect(s.y).toBeLessThan(inside.y + inside.height);
      }
    }
  });

  it('puts the door strip outside the doorway it faces', () => {
    expect(podDoorFront(side('e'))).toEqual({
      x: 104 - POD_DOOR_FRONT_PX,
      y: 200 + POD_SIDE_DOOR_SPAN[0],
      width: POD_DOOR_FRONT_PX,
      height: POD_SIDE_DOOR_SPAN[1] - POD_SIDE_DOOR_SPAN[0],
    });
    expect(podDoorFront(side('w'))).toMatchObject({ x: 240, width: POD_DOOR_FRONT_PX });
    expect(podDoorFront(pod({ chairFacing: 's' }))).toEqual({
      x: 100 + POD_DOOR_SPAN[0],
      y: 204 - POD_DOOR_FRONT_PX,
      width: POD_DOOR_SPAN[1] - POD_DOOR_SPAN[0],
      height: POD_DOOR_FRONT_PX,
    });
  });

  it('from behind, has its doorway in the far wall, through the wall’s face and nowhere else', () => {
    const el = pod({ chairFacing: 's' });
    const mid = 100 + (POD_DOOR_SPAN[0] + POD_DOOR_SPAN[1]) / 2;
    expect(podDoorway(el).out).toEqual({ x: 0, y: -1 });
    // Walking down through the doorway, through the far wall's face, onto the floor.
    expect(step(el, { x: mid, y: 180 }, { x: mid, y: 250 }).blocked).toBe(false);
    // Beside the doorway the far wall blocks, and so does the near wall.
    expect(step(el, { x: 120, y: 180 }, { x: 120, y: 250 }).blocked).toBe(true);
    expect(step(el, { x: mid, y: 360 }, { x: mid, y: 320 }).blocked).toBe(true);
    // Inside the wall's face the doorway's jambs stop a sideways step into it.
    expect(step(el, { x: mid, y: 220 }, { x: 140, y: 220 }).blocked).toBe(true);
    const shut = pod({ chairFacing: 's', podClosed: true });
    expect(step(shut, { x: mid, y: 180 }, { x: mid, y: 250 }).blocked).toBe(true);
    expect(podInterior(el)).toEqual(podInterior(pod()));
    const seats = seatPoints(el as Parameters<typeof seatPoints>[0]);
    expect(seats.map((s) => s.facing)).toEqual(['left', 'right']);
    expect(seats[0]!.x).toBeGreaterThan(seats[1]!.x);
  });
});
