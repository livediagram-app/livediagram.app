import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allPageFiles, APP_DIR } from '../testing/scoped-articles';

// Every article page declares its own canonical and OG url through `helpMetadata({ path })`, a string hand-written
// next to a page whose real route comes from its place on disk. A page moved to another category, or a slug renamed,
// keeps whatever path was typed, and the page still renders while telling search engines it lives somewhere else.
// The route is `/help/<path under app/>/`, the same in every scope, so it is checked once over the whole tree. The
// doc comment on `SeoInput.path` points here.
const pagePaths = allPageFiles()
  .filter((f) => f.endsWith('/page.mdx'))
  .map((f) => f.slice(0, -'/page.mdx'.length));

const declaredPath = (dir: string): string | null =>
  readFileSync(`${APP_DIR}/${dir}/page.mdx`, 'utf8').match(/helpMetadata\(\{[\s\S]*?path:\s*'([^']+)'/)?.[1] ??
  null;

describe('help article canonical paths', () => {
  it('reads a path from every article (guard against this test going blind)', () => {
    expect(pagePaths.length).toBeGreaterThan(300);
    expect(pagePaths.filter((d) => declaredPath(d) === null)).toEqual([]);
  });

  it('declares the route the page actually sits at', () => {
    const wrong = pagePaths
      .map((dir) => ({ dir, declared: declaredPath(dir), real: `/help/${dir}/` }))
      .filter((r) => r.declared !== r.real)
      .map((r) => `${r.dir}: declares ${r.declared}, sits at ${r.real}`);
    expect(wrong).toEqual([]);
  });
});
