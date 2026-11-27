import { describe, expect, it } from 'vitest';
import { item } from './test-items';
import { CAPACITY_NEAR, capacityState, estimateOf, sessionTally } from './session-tally';

// docs/specs/026-plan/session-tabs.md "Sprint Planning": committed estimates against capacity, a missing estimate
// counted apart.
describe('sessionTally', () => {
  const five = item({ title: 'Five', estimate: 5 });
  const three = item({ title: 'Three', estimate: 3 });
  const none = item({ title: 'None' });
  const zero = item({ title: 'Zero', estimate: 0 });
  const skipped = item({ title: 'Skipped', estimate: 8 });
  const left = item({ title: 'Not decided', estimate: 13 });
  const cards = [five, three, none, zero, skipped, left];

  it('adds up the committed cards’ estimates and counts those with none apart', () => {
    const decided = {
      [five.id]: { outcome: 'committed' as const },
      [three.id]: { outcome: 'committed' as const },
      [none.id]: { outcome: 'committed' as const },
      [zero.id]: { outcome: 'committed' as const },
      [skipped.id]: { outcome: 'skipped' as const },
    };
    expect(sessionTally(cards, decided)).toEqual({ points: 8, counted: 3, unestimated: 1 });
  });

  it('is empty with nothing decided', () => {
    expect(sessionTally(cards, undefined)).toEqual({ points: 0, counted: 0, unestimated: 0 });
  });

  it('reads an estimate only as a finite number of 0 or more', () => {
    expect(estimateOf(item({ title: 'x', estimate: 2 }))).toBe(2);
    expect(estimateOf(item({ title: 'x', estimate: -1 }))).toBeNull();
    expect(estimateOf(item({ title: 'x', estimate: '3' }))).toBeNull();
    expect(estimateOf(item({ title: 'x', estimate: Number.NaN }))).toBeNull();
  });
});

describe('capacityState', () => {
  it('is none without a capacity', () => {
    expect(capacityState(10, undefined)).toBe('none');
    expect(capacityState(10, 0)).toBe('none');
  });

  it('turns near from 85% up to the capacity, and over past it', () => {
    expect(CAPACITY_NEAR).toBe(0.85);
    expect(capacityState(16, 20)).toBe('under');
    expect(capacityState(17, 20)).toBe('near');
    expect(capacityState(20, 20)).toBe('near');
    expect(capacityState(21, 20)).toBe('over');
  });
});
