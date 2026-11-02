import { describe, expect, it } from 'vitest';
import { legacyDocumentIdOf } from './legacy-request-forms';

// Request forms an old client can still send to routes outside /api/diagrams
// (docs/specs/015-api/public-api-and-tokens.md §3.8).
describe('legacyDocumentIdOf', () => {
  it('reads the old body key', () => {
    expect(legacyDocumentIdOf({ diagramId: 'd-1' })).toBe('d-1');
  });
  it('is empty when there is none', () => {
    expect(legacyDocumentIdOf({})).toBe('');
    expect(legacyDocumentIdOf(null)).toBe('');
    expect(legacyDocumentIdOf({ diagramId: 7 })).toBe('');
  });
});
