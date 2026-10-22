import { describe, expect, it } from 'vitest';
import { legacyDocumentIdOf, upgradeLegacyScope } from './legacy-request-forms';

// Request forms an old client can still send to routes outside /api/diagrams
// (docs/specs/015-api/public-api-and-tokens.md §3.8).
describe('upgradeLegacyScope', () => {
  it('reads an old timeline scope as the document scope', () => {
    expect(upgradeLegacyScope('diagram:d-1')).toBe('document:d-1');
  });
  it('leaves every other scope alone', () => {
    for (const s of ['document:d-1', 'team:t-1', 'user:u', 'diagrams:x'])
      expect(upgradeLegacyScope(s)).toBe(s);
  });
});

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
