import { describe, expect, it } from 'vitest';
import { initialReach, widenReach } from './hero-reach';

// The hero draws only the boards a visitor can see or is about to (lib/hero-reach.ts).
describe('hero reach', () => {
  it('starts with the centred window and its neighbours', () => {
    expect(initialReach(0, 7)).toEqual({ lo: 0, hi: 1 });
    expect(initialReach(3, 7)).toEqual({ lo: 2, hi: 4 });
    expect(initialReach(6, 7)).toEqual({ lo: 5, hi: 6 });
  });

  it('draws the next window before it slides in', () => {
    expect(widenReach({ lo: 0, hi: 1 }, 0, 1, 7)).toEqual({ lo: 0, hi: 2 });
  });

  it('covers every window a jump slides past', () => {
    expect(widenReach({ lo: 0, hi: 1 }, 0, 5, 7)).toEqual({ lo: 0, hi: 6 });
  });

  it('never drops a drawn board, and stays inside the stage', () => {
    expect(widenReach({ lo: 0, hi: 6 }, 6, 0, 7)).toEqual({ lo: 0, hi: 6 });
    expect(widenReach({ lo: 2, hi: 4 }, 3, 2, 7)).toEqual({ lo: 1, hi: 4 });
  });
});
