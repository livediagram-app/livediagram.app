import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livepages/document';
import {
  FENCE_REACH,
  fenceReachFor,
  fenceRefuses,
  fenceSegments,
  fenceStep,
  pointSegmentDistance,
  segmentsIntersect,
  type FenceSegment,
} from './avatar-fence';

// docs/specs/009-elements/fence.md "Blocking"
const across: FenceSegment = { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } };

// Walks a character from `from` towards `to` in frame-sized steps, the way the walk loop does.
function walk(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fences: FenceSegment[],
) {
  let pos = from;
  for (let i = 0; i < 400; i++) {
    const dx = to.x - pos.x;
    const dy = to.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) break;
    const travel = Math.min(13, dist);
    pos = fenceStep(
      pos,
      { x: pos.x + (dx / dist) * travel, y: pos.y + (dy / dist) * travel },
      fences,
    ).pos;
  }
  return pos;
}

describe('fenceSegments', () => {
  it('collects the line of every fence, and nothing else', () => {
    const fence = { ...createShape('fence', 0, 0), id: 'f' };
    const square = { ...createShape('square', 0, 0), id: 's' };
    expect(fenceSegments([fence, square] as Element[])).toEqual([
      { a: { x: 0, y: 12 }, b: { x: 240, y: 12 } },
    ]);
  });
});

describe('geometry', () => {
  it('measures a point against a segment, ends included', () => {
    expect(pointSegmentDistance({ x: 100, y: 30 }, across)).toBe(30);
    expect(pointSegmentDistance({ x: 230, y: 40 }, across)).toBe(50);
  });

  it('knows when two segments cross or touch', () => {
    expect(segmentsIntersect({ a: { x: 50, y: -10 }, b: { x: 50, y: 10 } }, across)).toBe(true);
    expect(segmentsIntersect({ a: { x: 50, y: 0 }, b: { x: 50, y: 10 } }, across)).toBe(true);
    expect(segmentsIntersect({ a: { x: 250, y: -10 }, b: { x: 250, y: 10 } }, across)).toBe(false);
  });
});

describe('fenceRefuses', () => {
  it('refuses a step into the reach, from either side', () => {
    expect(fenceRefuses({ x: 100, y: 20 }, { x: 100, y: 8 }, across)).toBe(true);
    expect(fenceRefuses({ x: 100, y: -20 }, { x: 100, y: -8 }, across)).toBe(true);
  });

  it('lets a step past the end of the fence through', () => {
    expect(fenceRefuses({ x: 220, y: 20 }, { x: 220, y: -20 }, across)).toBe(false);
  });

  it('lets a character inside the reach step away but not across', () => {
    expect(fenceRefuses({ x: 100, y: 4 }, { x: 100, y: 10 }, across)).toBe(false);
    expect(fenceRefuses({ x: 100, y: 4 }, { x: 100, y: -4 }, across)).toBe(true);
    expect(fenceRefuses({ x: 100, y: 4 }, { x: 100, y: 2 }, across)).toBe(true);
  });

  it('keeps each character size its own feet’s width from a fence', () => {
    expect(fenceReachFor(1.5)).toBe(FENCE_REACH);
    expect(fenceReachFor(1.95)).toBeCloseTo(15.6, 6);
    expect(fenceRefuses({ x: 100, y: 20 }, { x: 100, y: 14 }, across, fenceReachFor(1.95))).toBe(
      true,
    );
    expect(fenceRefuses({ x: 100, y: 20 }, { x: 100, y: 14 }, across, fenceReachFor(1.5))).toBe(
      false,
    );
  });

  it('lets a character standing exactly on the line step off it, either way', () => {
    // A fence dropped onto a character on a whole-pixel point: every step touches the line.
    const on = { x: 120, y: 0 };
    expect(fenceRefuses(on, { x: 120, y: 4 }, across)).toBe(false);
    expect(fenceRefuses(on, { x: 120, y: -4 }, across)).toBe(false);
    expect(fenceRefuses(on, { x: 124, y: 0 }, across)).toBe(false);
    expect(fenceStep(on, { x: 120, y: 4 }, [across]).pos).toEqual({ x: 120, y: 4 });
  });
});

describe('fenceStep', () => {
  it('passes a step untouched when there are no fences', () => {
    expect(fenceStep({ x: 0, y: 0 }, { x: 5, y: 5 }, [])).toEqual({
      pos: { x: 5, y: 5 },
      blocked: false,
    });
  });

  it('stops a walk straight at a fence at the reach, on its own side', () => {
    const end = walk({ x: 100, y: 100 }, { x: 100, y: -100 }, [across]);
    expect(end.y).toBeGreaterThanOrEqual(FENCE_REACH);
    expect(end.y).toBeLessThan(FENCE_REACH + 0.5);
  });

  it('cannot tunnel through with one long step', () => {
    const { pos, blocked } = fenceStep({ x: 100, y: 40 }, { x: 100, y: -40 }, [across]);
    expect(blocked).toBe(true);
    expect(pos.y).toBeGreaterThanOrEqual(FENCE_REACH);
  });

  it('slides at a shallow angle whatever the display’s frame rate', () => {
    // 10 degrees off head-on, at a 60 Hz step (4.33 px) and a 240 Hz one (1.08 px).
    const tilt = (10 * Math.PI) / 180;
    for (const step of [4.33, 1.08]) {
      const from = { x: 100, y: FENCE_REACH + 0.01 };
      const to = { x: from.x + step * Math.sin(tilt), y: from.y - step * Math.cos(tilt) };
      const { pos } = fenceStep(from, to, [across]);
      expect(pos.x - from.x, `${step} px step`).toBeCloseTo(step * Math.sin(tilt), 6);
    }
  });

  it('slides along a fence walked into at an angle', () => {
    const { pos, blocked } = fenceStep({ x: 100, y: 13 }, { x: 109, y: 4 }, [across]);
    expect(blocked).toBe(true);
    expect(pos.x).toBeCloseTo(109, 6);
    expect(pos.y).toBeCloseTo(13, 6);
  });

  it('walks all the way round the outside of a fenced square but never in', () => {
    // Four fences round a 300 x 300 area, joined at the corners.
    const box: FenceSegment[] = [
      { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } },
      { a: { x: 300, y: 0 }, b: { x: 300, y: 300 } },
      { a: { x: 300, y: 300 }, b: { x: 0, y: 300 } },
      { a: { x: 0, y: 300 }, b: { x: 0, y: 0 } },
    ];
    for (const start of [
      { x: 150, y: -100 },
      { x: 400, y: 150 },
      { x: -100, y: 400 },
    ]) {
      const end = walk(start, { x: 150, y: 150 }, box);
      const inside = end.x > 0 && end.x < 300 && end.y > 0 && end.y < 300;
      expect(inside).toBe(false);
    }
    // Round the outside is still open.
    const round = walk({ x: -50, y: -50 }, { x: 350, y: -50 }, box);
    expect(round).toEqual({ x: 350, y: -50 });
  });

  it('seals a gap narrower than a character between two fences', () => {
    const left: FenceSegment = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    const right: FenceSegment = { a: { x: 118, y: 0 }, b: { x: 200, y: 0 } };
    const end = walk({ x: 109, y: 100 }, { x: 109, y: -100 }, [left, right]);
    expect(end.y).toBeGreaterThan(0);
  });

  it('leaves a gap wider than a character open', () => {
    const left: FenceSegment = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    const right: FenceSegment = { a: { x: 160, y: 0 }, b: { x: 260, y: 0 } };
    expect(walk({ x: 130, y: 100 }, { x: 130, y: -100 }, [left, right])).toEqual({
      x: 130,
      y: -100,
    });
  });

  it('keeps a frame within budget against a worst-case number of fences', () => {
    const fences: FenceSegment[] = Array.from({ length: 2000 }, (_, i) => ({
      a: { x: i * 30, y: 500 },
      b: { x: i * 30 + 20, y: 500 },
    }));
    const started = performance.now();
    for (let i = 0; i < 60; i++) fenceStep({ x: 15, y: 0 }, { x: 15, y: 13 }, fences);
    // 60 frames of walking against 2000 fences: well under a frame's budget each.
    expect((performance.now() - started) / 60).toBeLessThan(4);
  });
});

// docs/specs/009-elements/office.md: a room's walls and the scenery's footprints block like a fence.
describe('the office blocks like a fence', () => {
  const room: Element = {
    ...createShape('room', 0, 0),
    id: 'room',
    width: 400,
    height: 300,
    roomDoor: 's',
  };

  it('counts a room’s walls and a plant’s pot as lines, and a cooler as nothing', () => {
    const plant: Element = { ...createShape('plant', 600, 0), id: 'p' };
    const cooler: Element = { ...createShape('water-cooler', 700, 0), id: 'c' };
    expect(fenceSegments([room])).toHaveLength(5);
    expect(fenceSegments([plant])).toHaveLength(4);
    expect(fenceSegments([cooler])).toHaveLength(0);
  });

  it('lets a character walk in through the doorway and not through a wall', () => {
    const walls = fenceSegments([room]);
    // Straight up through the middle of the front wall: the doorway.
    const through = walk({ x: 200, y: 360 }, { x: 200, y: 200 }, walls);
    expect(through.y).toBeCloseTo(200, 0);
    // The same walk a little to the side meets the wall.
    const blocked = walk({ x: 60, y: 360 }, { x: 60, y: 200 }, walls);
    expect(blocked.y).toBeGreaterThan(300);
  });
});

describe('a step along a fence from inside its reach', () => {
  it('is never refused for rounding: the same distance off, a hair either way, is not closer', () => {
    // A fence at 0.0274 rad, a character 5 px off it, stepping 3 px along it: measured, the step lands 1e-15 px
    // "closer", which an exact comparison refused.
    const th = 0.0274;
    const [ux, uy] = [Math.cos(th), Math.sin(th)];
    const fence = { a: { x: 0, y: 0 }, b: { x: 300 * ux, y: 300 * uy } };
    const from = { x: 100 * ux - 5 * uy, y: 100 * uy + 5 * ux };
    const to = { x: from.x + 3 * ux, y: from.y + 3 * uy };
    expect(fenceRefuses(from, to, fence)).toBe(false);
  });
});
