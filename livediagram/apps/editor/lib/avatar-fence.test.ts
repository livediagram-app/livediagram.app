import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { fenceSegments, fenceStep, type FenceSegment } from '@liveworkspace/avatar/collision';

// docs/specs/009-elements/fence.md "Blocking": the collision is @liveworkspace/avatar's (its own tests); this
// editor's fences, rooms and scenery meeting it are tested here.

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
