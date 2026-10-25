import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { redirectProblems } from '@liveworkspace/comparisons';

import { COMPARISONS } from './alternatives';

// The comparisons are this site's own again (packages/comparisons/README.md "liveplanner"). The ones
// it no longer makes redirect permanently to the app that compares them now, and no rule in
// public/_redirects may catch the hub or a live comparison.
const redirects = readFileSync(
  fileURLToPath(new URL('../public/_redirects', import.meta.url)),
  'utf8',
);

const RETIRED: Record<string, string> = {
  'microsoft-whiteboard': 'https://livediagram-router.liveworkspace-easing509.workers.dev',
  miro: 'https://livediagram-router.liveworkspace-easing509.workers.dev',
  xmind: 'https://livediagram-router.liveworkspace-easing509.workers.dev',
  excalidraw: 'https://livediagram-router.liveworkspace-easing509.workers.dev',
  drawio: 'https://livediagram-router.liveworkspace-easing509.workers.dev',
  figjam: 'https://livediagram-router.liveworkspace-easing509.workers.dev',
  lucidchart: 'https://livediagram-router.liveworkspace-easing509.workers.dev',
  'google-slides': 'https://www.livedocuments.app',
};

describe('the comparison redirects', () => {
  it('never catch a live comparison, and are all permanent', () => {
    expect(redirectProblems(redirects, COMPARISONS)).toEqual([]);
  });

  it.each(Object.entries(RETIRED))(
    'send the retired %s comparison to the same one on %s',
    (slug, site) => {
      for (const from of [`/alternatives/${slug}`, `/alternatives/${slug}/`]) {
        expect(redirects).toContain(`${from} ${site}/alternatives/${slug} 301`);
      }
    },
  );
});
