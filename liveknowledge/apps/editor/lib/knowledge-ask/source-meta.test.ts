// A source's trust in words (docs/specs/030-knowledgebase/search-and-ask.md "The Ask view"), and nothing of it where
// verification is off (verification.md "Under a Review Period of Never").
import { describe, expect, it } from 'vitest';
import { sourceTrust, trustText } from './source-meta';

const NOW = Date.UTC(2026, 10, 20, 12);
const AT = Date.UTC(2026, 10, 8, 12);

describe('sourceTrust', () => {
  it('gives the badge and its words for each state', () => {
    expect(sourceTrust('verified', AT, 'Priya Nair', NOW)).toEqual({
      mark: 'verified',
      label: 'Verified',
      pieces: [expect.stringMatching(/8/), 'by Priya Nair'],
    });
    expect(sourceTrust('review-due', AT, undefined, NOW).mark).toBe('review-due');
    expect(sourceTrust('never-verified', undefined, undefined, NOW).label).toBe('Never Verified');
  });

  it('gives no badge and no words where verification is off', () => {
    expect(sourceTrust('off', AT, 'Priya Nair', NOW)).toEqual({
      mark: 'off',
      label: '',
      pieces: [],
    });
  });
});

describe('trustText', () => {
  it('says the state, and nothing where verification is off', () => {
    expect(trustText('verified', AT, 'Priya Nair', NOW)).toMatch(/^Verified .*8.* by Priya Nair$/);
    expect(trustText('review-due', undefined, undefined, NOW)).toBe('Review Due');
    expect(trustText('never-verified', undefined, undefined, NOW)).toBe('Never Verified');
    expect(trustText('off', AT, 'Priya Nair', NOW)).toBe('');
  });
});
