import { describe, expect, it } from 'vitest';

import { comparisonProblems } from '@liveworkspace/comparisons';
import { THEMES } from '@livehuddle/document';
import { TEMPLATES } from '@livehuddle/templates';

import { COMPARISONS } from './alternatives';

// livehuddle's comparisons (packages/comparisons/README.md): the list drives the routes, their
// metadata, the hub and the sitemap, so its shape is checked by the shared comparisonProblems.
// product-claims.test.ts keeps out claims found false.
describe('the comparisons', () => {
  it('hold everything every page needs', () => {
    expect(comparisonProblems(COMPARISONS)).toEqual([]);
  });
});

// The comparisons write the catalogue's sizes out ("23 templates", "twenty-four themes"); every
// mention must match it, so a template added fails here until the comparisons follow.
describe('counts on the comparisons', () => {
  const copy = JSON.stringify(COMPARISONS.alternatives);
  const counted = (pattern: RegExp, words: Record<string, number> = {}) =>
    [...copy.matchAll(pattern)].map((m) =>
      /^\d+$/.test(m[1]!) ? Number(m[1]) : words[m[1]!.toLowerCase()],
    );

  it('match the templates', () => {
    const counts = counted(/(\d+) (?:ready-made |starter )?templates/g);
    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(n).toBe(TEMPLATES.length);
  });

  it('match the themes a picker offers (the seasonal ones are their looks’ own)', () => {
    const offered = THEMES.filter((t) => !('seasonal' in t && t.seasonal)).length;
    const counts = counted(/\b(\d+|twenty-[a-z]+) (?:one-click )?(?:whole-canvas )?themes\b/gi, {
      'twenty-four': 24,
    });
    for (const n of counts) expect(n).toBe(offered);
  });
});
