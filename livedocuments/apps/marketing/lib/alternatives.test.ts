import { describe, expect, it } from 'vitest';

import { comparisonProblems } from '@liveworkspace/comparisons';
import { THEMES } from '@livedocuments/document';
import { SLIDE_LAYOUTS, TEMPLATES } from '@livedocuments/templates';

import { COMPARISONS } from './alternatives';

// livedocuments' comparisons (packages/comparisons/README.md): the list drives the routes, their
// metadata, the hub and the sitemap, so its shape is checked by the shared comparisonProblems.
// product-claims.test.ts keeps out claims found false.
describe('the comparisons', () => {
  it('hold everything every page needs', () => {
    expect(comparisonProblems(COMPARISONS)).toEqual([]);
  });
});

// The comparisons write the catalogue's sizes out ("seventeen slide layouts"); every mention must
// match it, so a template or layout added fails here until the comparisons follow.
describe('counts on the comparisons', () => {
  const copy = JSON.stringify(COMPARISONS.alternatives);
  const counted = (pattern: RegExp, words: Record<string, number> = {}) =>
    [...copy.matchAll(pattern)].map((m) =>
      /^\d+$/.test(m[1]!) ? Number(m[1]) : words[m[1]!.toLowerCase()],
    );

  it('match the templates', () => {
    for (const n of counted(/(\d+) (?:ready-made |starter )?templates/g)) {
      expect(n).toBe(TEMPLATES.length);
    }
  });

  it('match the themes a picker offers (the seasonal ones are their looks’ own)', () => {
    const offered = THEMES.filter((t) => !('seasonal' in t && t.seasonal)).length;
    const counts = counted(/\b(\d+|twenty-[a-z]+) (?:one-click )?(?:whole-canvas )?themes\b/gi, {
      'twenty-four': 24,
    });
    for (const n of counts) expect(n).toBe(offered);
  });

  it('match the slide layouts', () => {
    const counts = counted(/\b(\d+|[a-z]+teen) (?:ready-made )?layouts\b/gi, { seventeen: 17 });
    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(n).toBe(SLIDE_LAYOUTS.length);
  });
});
