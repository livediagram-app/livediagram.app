import { describe, expect, it } from 'vitest';
import {
  closePods,
  podClosed,
  podDoorFront,
  podInterior,
  podWalls,
  POD_DOOR_FRONT_PX,
  POD_DOOR_SPAN,
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
    expect(walls).toHaveLength(5);
    expect(walls[4]).toEqual({ a: { x: 104, y: 340 }, b: { x: 272, y: 340 } });
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
