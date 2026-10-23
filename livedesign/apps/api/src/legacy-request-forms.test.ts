import { describe, expect, it } from 'vitest';
import { legacyDesignIdOf } from './legacy-request-forms';

// The old body key the team notification routes still read (docs/specs/015-api/public-api-and-tokens.md §3.8).
describe('legacyDesignIdOf', () => {
  it('reads the old body key', () => {
    expect(legacyDesignIdOf({ diagramId: 'd-1' })).toBe('d-1');
  });
  it('is empty when there is none', () => {
    expect(legacyDesignIdOf({})).toBe('');
    expect(legacyDesignIdOf(null)).toBe('');
    expect(legacyDesignIdOf({ diagramId: 7 })).toBe('');
  });
});
