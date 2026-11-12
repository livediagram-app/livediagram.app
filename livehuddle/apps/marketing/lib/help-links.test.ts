import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleHref, articles, categories, categoryHref } from '@livehuddle/help-registry';
import { describe, expect, it } from 'vitest';

// Every link marketing makes into the help centre must land on a registered article or category
// (docs/specs/019-marketing/marketing-site.md); a renamed or retired article otherwise 404s quietly.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
// The shared marketing pages (@liveworkspace/marketing-site) link into this app's help centre too.
const SOURCE_DIRS = ['app', 'components', 'lib', '../../../packages/marketing-site/src'];

// The shared Build with AI page, which livehuddle does not render (no MCP server,
// docs/specs/002-project-scope/not-in-livehuddle.md), so its links are not this app's.
const NOT_RENDERED = join('marketing-site', 'src', 'components', 'ai');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path.endsWith(NOT_RENDERED) ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const known = new Set([
  '/help/',
  ...articles.map((a) => `/help${articleHref(a)}`),
  ...categories.map((c) => `/help${categoryHref(c.slug)}`),
]);

const links = SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/["'`](\/help\/[a-z0-9/-]*)(?:#[a-z0-9-]*)?["'`]/g)].map(
    (m) => ({ file: file.slice(ROOT.length), href: m[1]! }),
  ),
);

describe('help centre links', () => {
  it('finds the links it checks', () => {
    expect(links.length).toBeGreaterThan(40);
  });

  it('points every one at a registered article or category', () => {
    const broken = links.filter((l) => !known.has(l.href));
    expect(broken).toEqual([]);
  });
});
