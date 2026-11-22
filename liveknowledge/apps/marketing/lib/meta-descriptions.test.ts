import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SITE_DESCRIPTION, SITE_TITLE } from './site-words';

// A search result shows about 160 characters of a meta description and cuts the rest; under about 50 is too thin
// to earn the click (docs/specs/019-marketing/marketing-site.md "SEO and metadata").
const APP = fileURLToPath(new URL('../app', import.meta.url));

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pages(join(dir, e.name)) : e.name === 'page.tsx' ? [join(dir, e.name)] : [],
  );
}

// Each description a static page writes for itself, as a string literal after `description:` or a
// `_DESCRIPTION =` constant.
const written = pages(APP).flatMap((file) =>
  [
    ...readFileSync(file, 'utf8').matchAll(
      /(?:description:|_DESCRIPTION =)\s*\n?\s*'([^']{20,})'/g,
    ),
  ].map((m) => ({ file: file.slice(APP.length), text: m[1]! })),
);

describe('meta descriptions', () => {
  it('fits the landing page’s', () => {
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(50);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
  });

  it('finds the pages that write their own', () => {
    expect(written.length).toBeGreaterThanOrEqual(3);
  });

  it.each(written)('$file fits a search result', ({ text }) => {
    expect(text.length).toBeGreaterThanOrEqual(50);
    expect(text.length).toBeLessThanOrEqual(160);
  });
});
