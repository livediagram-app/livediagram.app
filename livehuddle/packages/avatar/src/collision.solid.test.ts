import { describe, expect, it } from 'vitest';
import {
  clearOfFences,
  FENCE_ON_LINE,
  FENCE_REACH,
  fenceReachFor,
  fenceSegments,
  fenceStep,
} from './collision';
import { officeFootprint } from './office-geometry';
import { seatFor } from './seats';

// A footprint is solid (docs/specs/009-elements/fence.md "Blocking", office.md "Bar, Bar Stool"): a
// character inside one, sat on a stool tucked under a bar's counter or with scenery dropped on it, walks out of it and
// never deeper into it, so standing up never leaves it stuck.

const bar = { id: 'bar', type: 'shape', shape: 'bar', x: 0, y: 0, width: 240, height: 120 };
const stoolAt = (y: number) => ({
  id: 'stool',
  type: 'shape' as const,
  shape: 'bar-stool' as const,
  x: 98,
  y,
  width: 44,
  height: 64,
});
const fences = fenceSegments([bar]);
const counter = officeFootprint(bar)!;

/** Sit as the walk's sitOn does (the seat snapped clear of walls), then take one walking frame toward `to`. */
function standAndStep(stoolY: number, dy: number, reach = FENCE_REACH) {
  const seat = seatFor(stoolAt(stoolY), { x: 120, y: 200 });
  const at = clearOfFences(seat, fences, reach);
  return { at, step: fenceStep(at, { x: at.x, y: at.y + dy }, fences, reach) };
}

describe('a stool tucked under a bar', () => {
  // The stool's top from the counter's top (y 60) to past its front (y 110.4): every seat in the counter's front half
  // (its nearest way out the front) or within a reach of its front edge.
  const tucks = Array.from({ length: 27 }, (_, i) => 60 + i * 2);

  it('lets the character stand and walk away from the bar, whatever the tuck and size', () => {
    for (const reach of [FENCE_REACH, fenceReachFor(1.15), fenceReachFor(1.85)])
      for (const y of tucks) {
        const { at, step } = standAndStep(y, 4.3, reach);
        expect(step.pos.y, `stool at ${y}, reach ${reach}`).toBeGreaterThan(at.y + 4);
      }
  });

  it('never lets the character walk deeper into the counter', () => {
    const depth = (p: { y: number }) => Math.min(p.y - counter.y, counter.y + counter.height - p.y);
    for (const y of tucks)
      for (const dy of [-4.3, 4.3]) {
        const { at, step } = standAndStep(y, dy);
        // From outside, only a seat left in the edge itself (FENCE_ON_LINE) may step a little way in.
        const most = depth(at) > 0 ? depth(at) : FENCE_ON_LINE;
        expect(depth(step.pos), `stool at ${y}`).toBeLessThanOrEqual(most);
      }
  });

  it('walks out of the back of the counter from a seat tucked past its middle, never deeper', () => {
    const { at, step } = standAndStep(48, -4.3);
    expect(step.pos.y).toBeLessThan(at.y - 4);
    expect(standAndStep(48, 4.3).step.pos.y).toBeLessThanOrEqual(at.y);
  });

  it('keeps a seat in the counter on its stool rather than nudging it deeper', () => {
    const seat = seatFor(stoolAt(75), { x: 120, y: 200 });
    expect(seat.y).toBeGreaterThan(counter.y + counter.height - FENCE_REACH);
    expect(clearOfFences(seat, fences)).toEqual(seat);
  });
});

describe('a character inside a footprint', () => {
  const middle = { x: 120, y: counter.y + counter.height / 2 };

  it('walks along it at the same depth and out of its nearest side', () => {
    const along = fenceStep({ x: 120, y: 100 }, { x: 116, y: 100 }, fences);
    expect(along).toEqual({ pos: { x: 116, y: 100 }, blocked: false });
    const out = fenceStep(middle, { x: 120, y: middle.y + 4 }, fences);
    expect(out.blocked).toBe(false);
  });

  it('is refused a step that goes deeper, sliding along instead', () => {
    const step = fenceStep({ x: 120, y: 100 }, { x: 117, y: 97 }, fences);
    expect(step.blocked).toBe(true);
    expect(step.pos.y).toBeGreaterThanOrEqual(100);
  });

  it('is held from outside as before: a step into the counter from the floor is refused', () => {
    const below = counter.y + counter.height + FENCE_REACH + 1;
    const step = fenceStep({ x: 120, y: below }, { x: 120, y: below - 4 }, fences);
    expect(step.blocked).toBe(true);
    expect(step.pos.y).toBeGreaterThan(below - 2);
  });
});
