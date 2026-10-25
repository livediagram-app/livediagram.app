import { describe, expect, it } from 'vitest';
import { reachableFrom, type WalkedElement } from './graph-walk';

const pin = (elementId: string) => ({ kind: 'pinned' as const, elementId });
const arrow = (from: string, to: string): WalkedElement => ({
  type: 'arrow',
  from: pin(from),
  to: pin(to),
});

// n1 → n2 → n3 → n1 (a loop), n2 → n4, and arrows the walk does not follow.
const elements: WalkedElement[] = [
  { type: 'shape' },
  arrow('n1', 'n2'),
  arrow('n2', 'n3'),
  arrow('n3', 'n1'),
  arrow('n2', 'n4'),
  { type: 'arrow', from: pin('n4'), to: { kind: 'free', x: 0, y: 0 } },
  { type: 'arrow', from: { kind: 'on-arrow', arrowId: 'a1' }, to: pin('n5') },
];

describe('reachableFrom', () => {
  it('follows pinned arrows downstream, leaving the start out, through a loop', () => {
    expect([...reachableFrom(elements, 'n2', 'downstream')].sort()).toEqual(['n1', 'n3', 'n4']);
  });

  it('follows them against their direction upstream', () => {
    expect([...reachableFrom(elements, 'n4', 'upstream')].sort()).toEqual(['n1', 'n2', 'n3']);
  });

  it('reaches nothing from an element no pinned arrow leaves', () => {
    expect(reachableFrom(elements, 'n5', 'downstream').size).toBe(0);
  });
});
