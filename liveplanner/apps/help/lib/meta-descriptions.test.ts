import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { categories } from './articles';

// A search result shows about 160 characters of a meta description and cuts
// the rest mid-sentence; under about 50 it is too thin to earn the click
// (docs/specs/018-help/help-app.md "SEO"). The marketing site holds its pages
// to the same range (apps/marketing/lib/meta-descriptions.test.ts). Titles are
// held unique too: two pages titled alike compete for one query and read as
// duplicates to a search engine.
const MIN = 50;
const MAX = 160;

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const files = readdirSync(APP_DIR, { recursive: true }).map((p) => String(p).replaceAll('\\', '/'));

// The title and description literals of a page's helpMetadata({ ... }) call.
function metaOf(file: string) {
  const block = readFileSync(`${APP_DIR}/${file}`, 'utf8').match(
    /helpMetadata\(\{[\s\S]*?\}\)/,
  )?.[0];
  const literal = (key: string) =>
    block?.match(new RegExp(`${key}:\\s*(['"])((?:(?!\\1).)*)\\1`))?.[2] ?? null;
  return { page: file, title: literal('title'), description: literal('description') };
}

// Every article writes its own.
const articles = files.filter((f) => f.endsWith('/page.mdx')).map(metaOf);
// Static pages (the support category landings, the home) write theirs as
// literals too; a feature landing takes its category's from the registry
// through featureCategoryMetadata.
const staticPages = files
  .filter((f) => f.endsWith('page.tsx'))
  .map(metaOf)
  .filter((m) => m.description !== null);
const featureLandings = categories.filter((c) =>
  files.includes(`${c.slug}/page.tsx`)
    ? readFileSync(`${APP_DIR}/${c.slug}/page.tsx`, 'utf8').includes('featureCategoryMetadata(')
    : false,
);

const pages = [
  ...articles,
  ...staticPages,
  ...featureLandings.map((c) => ({ page: c.slug, title: c.title, description: c.description })),
];

describe('help page metadata', () => {
  it('reads every page (guard against this test going blind)', () => {
    expect(articles.length).toBeGreaterThan(100);
    expect(articles.filter((a) => a.title === null || a.description === null)).toEqual([]);
    expect(staticPages.length).toBeGreaterThan(3);
    expect(featureLandings.length).toBeGreaterThan(5);
  });

  it('every meta description fits a search result', () => {
    const misfits = pages
      .filter((p) => p.description!.length < MIN || p.description!.length > MAX)
      .map((p) => `${p.page} (${p.description!.length} chars)`);
    expect(misfits).toEqual([]);
  });

  it('no two pages share a title', () => {
    const titles = pages.map((p) => p.title);
    expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([]);
  });
});
