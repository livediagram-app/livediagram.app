import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_ORDER } from '@liveworkspace/help-registry';
import { slugOf } from '@liveworkspace/help-site/lib/heading-id';
import { APP_DIR } from '../testing/scoped-articles';

// An article's sections are linked to by anchor, from other articles and from each product's marketing site
// (`/help/<path>/#<section>`). The page renders each `##` and `###` heading with the id headingId gives it; every such
// link must name a heading its article has. One article tree serves every app, so the articles and every product's
// marketing app are read once here.
const REPO = fileURLToPath(new URL('../../../../..', import.meta.url));

function files(dir: string, ext: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.') || name === 'out') return [];
    if (statSync(path).isDirectory()) return files(path, ext);
    return ext.some((e) => name.endsWith(e)) ? [path] : [];
  });
}

// The anchors an article's page carries: its headings, slugged as the page slugs them. Headings in prose only
// (`## ` at the start of a line, outside fenced code), with Markdown formatting read as its text.
function anchorsOf(mdx: string): Set<string> {
  const out = new Set<string>();
  let fenced = false;
  for (const line of mdx.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    const m = !fenced && /^#{2,3} (.+)$/.exec(line);
    if (m) out.add(slugOf(m[1]!.replace(/[`*_]|\[([^\]]*)\]\([^)]*\)/g, '$1')));
  }
  return out;
}

const marketing = APP_ORDER.map((app) => join(REPO, app, 'apps/marketing')).filter((dir) => {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
});

describe('heading ids', () => {
  it('reads the articles and the marketing apps (guard against this test going blind)', () => {
    expect(files(APP_DIR, ['.mdx']).length).toBeGreaterThan(300);
    expect(marketing.length).toBeGreaterThan(0);
  });

  it('every /help/...#anchor link names a heading of its article', () => {
    const sources = [...files(APP_DIR, ['.mdx']), ...marketing.flatMap((dir) => files(dir, ['.tsx', '.ts', '.mdx']))];
    const missing: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\/help\/([a-z0-9/-]*?)\/?#([a-z0-9-]+)/g)) {
        let mdx: string;
        try {
          mdx = readFileSync(join(APP_DIR, m[1]!, 'page.mdx'), 'utf8');
        } catch {
          continue;
        }
        if (!anchorsOf(mdx).has(m[2]!)) missing.push(`${file.replace(REPO, '')}: /help/${m[1]}/#${m[2]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
