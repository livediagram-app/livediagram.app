import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_ORDER, appliesTo } from '@liveworkspace/help-registry';
import { allArticles, categoriesFor, HELP_REDIRECTS } from '@liveworkspace/help-registry/catalogue';
import { articlePath } from '@liveworkspace/help-registry/telemetry';
import { APP_DIR } from '../testing/scoped-articles';

// The moved and retired help paths (packages/help-registry catalogue/redirects.ts), which the help Worker answers
// with a 308 before any file (each product help app's public/_redirects until the merge). The catalogue's own test
// checks each target is a listed path; this checks the page is really there on disk, that a redirect limited to some
// apps lands on a page those apps show, and that no path still live where the redirect holds is sent away from itself.
const pageExists = (path: string) =>
  ['page.mdx', 'page.tsx'].some((file) => existsSync(`${APP_DIR}/${path ? `${path}/` : ''}${file}`));

const byPath = new Map(allArticles.map((a) => [articlePath(a), a]));
const apps = (r: { apps?: readonly (typeof APP_ORDER)[number][] }) => r.apps ?? APP_ORDER;

describe('retired help paths', () => {
  it('has rules to check', () => {
    expect(HELP_REDIRECTS.length).toBeGreaterThan(0);
  });

  it.each(HELP_REDIRECTS.filter((r) => !r.to.startsWith('https://')))(
    '$from redirects to a page on disk that its apps show',
    (r) => {
      const to = r.to.split('#')[0]!;
      expect(pageExists(to), r.to).toBe(true);
      const article = byPath.get(to);
      if (article) for (const app of apps(r)) expect(appliesTo(article, app), `${r.to} in ${app}`).toBe(true);
    },
  );

  it.each(HELP_REDIRECTS)('$from is not live where it holds', (r) => {
    const from = r.from.replace(/\/\*$/, '');
    const article = byPath.get(from);
    for (const app of apps(r)) {
      if (article) expect(appliesTo(article, app), `${from} is an article in ${app}`).toBe(false);
      expect(
        categoriesFor(app).some((c) => c.slug === from),
        `${from} is a landing in ${app}`,
      ).toBe(false);
    }
    if (!r.apps) expect(existsSync(`${APP_DIR}/${from}/page.mdx`), from).toBe(false);
  });
});
