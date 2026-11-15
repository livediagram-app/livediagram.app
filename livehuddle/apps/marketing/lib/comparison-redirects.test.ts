import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { redirectProblems } from '@liveworkspace/comparisons';

import { COMPARISONS } from './alternatives';

// livehuddle compared itself with Miro and FigJam for meetings and workshops until the meet-first refocus (Work
// Tracker #423, packages/comparisons/README.md "livehuddle"), and dropped Teamflow, whose virtual office looks closed
// (Work Tracker 767). Those addresses redirect permanently to the hub, and no
// rule in public/_redirects may catch the hub or a live comparison.
const redirects = readFileSync(
  fileURLToPath(new URL('../public/_redirects', import.meta.url)),
  'utf8',
);

const RETIRED = ['miro', 'figjam', 'teamflow'];

describe('the Meetings feature page', () => {
  it('takes the old Workshops address permanently', () => {
    expect(redirects).toContain('/features/workshops /features/meetings 301');
    expect(redirects).toContain('/features/workshops/ /features/meetings/ 301');
  });
});

describe('the comparison redirects', () => {
  it('never catch a live comparison, and are all permanent', () => {
    expect(redirectProblems(redirects, COMPARISONS)).toEqual([]);
  });

  it.each(RETIRED)('send the retired %s comparison to the hub', (slug) => {
    expect(COMPARISONS.alternatives.some((a) => a.slug === slug)).toBe(false);
    for (const from of [`/alternatives/${slug}`, `/alternatives/${slug}/`]) {
      expect(redirects).toContain(`${from} /alternatives 301`);
    }
  });
});
