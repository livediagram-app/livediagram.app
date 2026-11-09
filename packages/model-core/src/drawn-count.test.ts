import { describe, expect, it } from 'vitest';
import { drawnCount } from './drawn-count';

// docs/specs/006-document/document-snapshots.md "An empty document is never asked for".

describe('drawnCount', () => {
  it('counts the elements', () => {
    expect(drawnCount({ elements: [] })).toBe(0);
    expect(drawnCount({ elements: [{}, {}] })).toBe(2);
  });

  it('reads anything else as nothing to draw', () => {
    expect(drawnCount({})).toBe(0);
    expect(drawnCount({ elements: 'x' })).toBe(0);
  });
});
