import { describe, expect, it } from 'vitest';

import { comparisonProblems } from '@liveworkspace/comparisons';

import { COMPARISONS } from './alternatives';

// liveknowledge's comparisons (packages/comparisons/README.md "liveknowledge"): the list drives the routes, their
// metadata, the hub and the sitemap, so its shape is checked by the shared comparisonProblems.
// product-claims.test.ts keeps out what the product does not do.
describe('the comparisons', () => {
  it('hold everything every page needs', () => {
    expect(comparisonProblems(COMPARISONS)).toEqual([]);
  });

  it('are the six team knowledge tools, Notion under its own slug here', () => {
    expect(COMPARISONS.alternatives.map((a) => a.slug)).toEqual([
      'notion-wiki',
      'confluence',
      'slite',
      'guru',
      'gitbook',
      'outline',
    ]);
    // `notion` is liveplanner's page; a slug is unique across every app.
    expect(COMPARISONS.alternatives.some((a) => a.slug === 'notion')).toBe(false);
  });

  // The fairness rule: each page gives real reasons to pick the other tool, and says where we are behind.
  it.each(COMPARISONS.alternatives.map((a) => [a.slug, a] as const))(
    '%s says where the other tool is the better pick',
    (_slug, alt) => {
      expect(alt.themBest.length).toBeGreaterThanOrEqual(3);
      expect(alt.usBest.length).toBeGreaterThanOrEqual(3);
      expect(alt.faqs.length).toBeGreaterThanOrEqual(3);
    },
  );

  it('admit, between them, each place liveknowledge is behind', () => {
    const theirs = COMPARISONS.alternatives.flatMap((a) => a.themBest).join(' ');
    for (const gap of [
      /databases/,
      /permissions down to a single page|page restrictions/,
      /integrations/,
      /mobile/,
      /search that understands meaning/,
      /public site/,
    ]) {
      expect(theirs).toMatch(gap);
    }
  });

  // No price, limit or plan content is written for a competitor: positioning only.
  it('state no competitor price or number', () => {
    for (const alt of COMPARISONS.alternatives) {
      for (const text of [...alt.rows.map((r) => r.them), ...alt.themBest]) {
        expect(text, alt.slug).not.toMatch(/[$€£]|\d/);
      }
    }
  });

  it('never call a competitor the best or the worst of anything', () => {
    const copy = JSON.stringify(COMPARISONS.alternatives);
    expect(copy).not.toMatch(/\b(?:best|worst|fastest|leading|unbeatable|only tool)\b/i);
  });
});
