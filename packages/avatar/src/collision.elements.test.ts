import { describe, expect, it } from 'vitest';
import { fenceSegments, fenceStep } from './collision';

// livediagram's docs/specs/009-elements/fence.md "Blocking" and office.md, on plain elements: each product also
// tests its own fences, rooms and scenery.
const shape = (id: string, kind: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: kind,
  x: 0,
  y: 0,
  width: 240,
  height: 24,
  ...over,
});

describe('fenceSegments on any board', () => {
  it('blocks along a fence, a room’s walls and a plant’s pot, and nothing else', () => {
    const lines = fenceSegments([
      shape('f', 'fence'),
      shape('r', 'room', { width: 400, height: 300, roomDoor: 's' }),
      shape('p', 'plant', { width: 56, height: 88 }),
      shape('s', 'square'),
      { id: 'a', type: 'arrow' },
    ]);
    // One fence line, five walls (the front wall broken at its doorway), four edges of the pot.
    expect(lines).toHaveLength(10);
    expect(lines[0]).toEqual({ a: { x: 0, y: 12 }, b: { x: 240, y: 12 } });
  });
});

describe('a fence of no length', () => {
  it('stops a step that comes within its reach, with nothing to slide along', () => {
    const point = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
    const step = fenceStep({ x: 0, y: 30 }, { x: 0, y: 5 }, [point]);
    expect(step.blocked).toBe(true);
    expect(step.pos.y).toBeGreaterThan(5);
  });
});
