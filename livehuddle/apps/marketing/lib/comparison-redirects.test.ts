import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { redirectProblems } from '@liveworkspace/comparisons';

import { COMPARISONS } from './alternatives';

// The comparisons are this site's own again (packages/comparisons/README.md "livediagram"). The one
// it no longer makes, Google Slides, redirects permanently to the app that compares it now, and no
// rule in public/_redirects may catch the hub or a live comparison.
const redirects = readFileSync(
  fileURLToPath(new URL('../public/_redirects', import.meta.url)),
  'utf8',
);

describe('the comparison redirects', () => {
  it('never catch a live comparison, and are all permanent', () => {
    expect(redirectProblems(redirects, COMPARISONS)).toEqual([]);
  });

  it('send the retired Google Slides comparison to livedocuments, with and without a slash', () => {
    for (const from of ['/alternatives/google-slides', '/alternatives/google-slides/']) {
      expect(redirects).toContain(
        `${from} https://www.livedocuments.app/alternatives/google-slides 301`,
      );
    }
  });
});
