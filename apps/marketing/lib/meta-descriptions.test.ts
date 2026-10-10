import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ALTERNATIVES } from './alternatives';
import { LANDING_SECTIONS } from './landing-content';

// A search result shows about 160 characters of a meta description and cuts the rest; under about 50 it
// is too thin to earn the click (docs/specs/019-marketing/marketing-site.md "SEO and metadata").
const MIN = 50;
const MAX = 160;

const fits = (text: string) => text.length >= MIN && text.length <= MAX;

describe('meta descriptions', () => {
  it.each(LANDING_SECTIONS.map((s) => [s.id, s.metaDescription]))(
    'feature page %s fits a search result',
    (_id, text) => {
      expect(fits(text), `${text.length} chars`).toBe(true);
    },
  );

  it.each(ALTERNATIVES.map((a) => [a.slug, a.description]))(
    'comparison page %s fits a search result',
    (_slug, text) => {
      expect(fits(text), `${text.length} chars`).toBe(true);
    },
  );

  // Static pages write theirs as a literal in `pageMetadata({ description: '...' })`.
  it('fits on every static page that writes its own', () => {
    const app = fileURLToPath(new URL('../app', import.meta.url));
    const pages = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? pages(join(dir, e.name))
          : e.name === 'page.tsx'
            ? [join(dir, e.name)]
            : [],
      );
    const literals = pages(app).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/description:\s*\n?\s*'((?:[^'\\]|\\.)*)'/g)].map(
        (m) => ({ file: file.slice(app.length), text: m[1]!.replace(/\\'/g, "'") }),
      ),
    );
    expect(literals.length).toBeGreaterThan(0);
    for (const { file, text } of literals)
      expect(fits(text), `${file}: ${text.length} chars`).toBe(true);
  });
});
