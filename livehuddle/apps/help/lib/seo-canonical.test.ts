import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every article page declares its own canonical + OG url through
// `helpMetadata({ path })`, and that string is hand-written next to a page
// whose real route comes from its position on disk. Nothing ties the two
// together: a page moved to another category, or a slug renamed, keeps
// whatever path was typed when it was created, and the page still renders
// perfectly while telling search engines and link previews it lives
// somewhere else.
//
// The route is `/help/<path under app/>/`, so it is derivable, which makes
// this checkable rather than a thing to remember. The doc comment on
// `SeoInput.path` points here.

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

const pagePaths = readdirSync(APP_DIR, { recursive: true })
  .map((p) => String(p).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('/page.mdx'))
  .map((p) => p.slice(0, -'/page.mdx'.length));

const declaredPath = (dir: string): string | null => {
  const src = readFileSync(`${APP_DIR}/${dir}/page.mdx`, 'utf8');
  return src.match(/helpMetadata\(\{[\s\S]*?path:\s*'([^']+)'/)?.[1] ?? null;
};

describe('help article canonical paths', () => {
  it('reads a path from every article (guard against this test going blind)', () => {
    expect(pagePaths.length).toBeGreaterThan(200);
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
