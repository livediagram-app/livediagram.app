import { describe, expect, it } from 'vitest';

import { comparisonProblems } from '@liveworkspace/comparisons';
import { isBlankTemplate, isPlanTemplate, TEMPLATES } from '@liveplanner/templates';

import { COMPARISONS } from './alternatives';

// liveplanner's comparisons (packages/comparisons/README.md): the list drives the routes, their
// metadata, the hub and the sitemap, so its shape is checked by the shared comparisonProblems.
// product-claims.test.ts keeps out claims found false.
describe('the comparisons', () => {
  it('hold everything every page needs', () => {
    expect(comparisonProblems(COMPARISONS)).toEqual([]);
  });
});

// A comparison that writes the template count out ("19 ready-made templates") must match the Plan
// templates a person can start from, so a template added fails here until the comparisons follow.
describe('counts on the comparisons', () => {
  it('match the Plan templates', () => {
    const plans = TEMPLATES.filter(
      (t) => !t.hidden && isPlanTemplate(t.kind) && !isBlankTemplate(t.kind),
    );
    const copy = JSON.stringify(COMPARISONS.alternatives);
    const counts = [...copy.matchAll(/(\d+) (?:ready-made |starter )?templates/g)].map((m) =>
      Number(m[1]),
    );
    for (const n of counts) expect(n).toBe(plans.length);
  });
});
