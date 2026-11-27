import { describe, expect, it } from 'vitest';
import { besideRows, neighbourOf, spinStrip } from './picker-strip';

const ring = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
const labels = (row: ({ label: string } | null)[]) => row.map((c) => c?.label ?? null);

describe('neighbourOf', () => {
  it('walks the ring either way, wrapping at the ends', () => {
    expect(neighbourOf(ring, 'A', -1)?.label).toBe('C');
    expect(neighbourOf(ring, 'C', 1)?.label).toBe('A');
    expect(neighbourOf(ring, 'B', 1)?.label).toBe('C');
  });

  it('shows the first and last names around an empty payline or a name off the ring', () => {
    expect(neighbourOf(ring, undefined, 1)?.label).toBe('A');
    expect(neighbourOf(ring, undefined, -1)?.label).toBe('C');
    expect(neighbourOf(ring, 'Gone', 1)?.label).toBe('A');
  });

  it('shows nothing beside a name with nobody else on the ring', () => {
    expect(neighbourOf([{ label: 'A' }], 'A', 1)).toBeNull();
  });
});

describe('besideRows', () => {
  it('shows a lone other name once, below, rather than either side', () => {
    expect(labels(besideRows([{ label: 'A' }, { label: 'B' }], 'A'))).toEqual([null, 'B']);
    expect(labels(besideRows([{ label: 'A' }], undefined))).toEqual([null, 'A']);
    expect(labels(besideRows(ring, 'B'))).toEqual(['A', 'C']);
  });
});

describe('spinStrip', () => {
  it('starts where the reel stands and ends on the landing with its neighbours', () => {
    const strip = spinStrip(ring, ring[0]!, [ring[1]!, ring[2]!], ring[1]!);
    expect(labels(strip)).toEqual(['C', 'A', 'B', 'C', 'A', 'B', 'C']);
    // The window stops on strip.length - 2: the landing.
    expect(strip[strip.length - 2]?.label).toBe('B');
  });

  it('starts from an empty payline before the first roll', () => {
    expect(spinStrip(ring, null, [], ring[2]!)[1]).toBeNull();
  });
});
