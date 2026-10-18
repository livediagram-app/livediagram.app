import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { headingId, slugOf } from './heading-id';

// An article's sections are linked to by anchor, from other articles and from the marketing site
// (`/help/<path>/#<section>`). The page renders each `##` and `###` heading with the id headingId gives it; every such
// link must name a heading its article has.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const HELP = join(ROOT, 'apps/help/app');

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

describe('heading ids', () => {
  it('slug a heading through any formatting inside it', () => {
    expect(headingId("When a Style Isn't Offered")).toBe('when-a-style-isn-t-offered');
    expect(headingId(['Using ', createElement('code', null, 'Cmd+K'), ' fast'])).toBe(
      'using-cmd-k-fast',
    );
  });

  it('every /help/…#anchor link names a heading of its article', () => {
    const sources = [
      ...files(HELP, ['.mdx']),
      ...files(join(ROOT, 'apps/marketing'), ['.tsx', '.ts', '.mdx']),
    ];
    const missing: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\/help\/([a-z0-9/-]*?)\/?#([a-z0-9-]+)/g)) {
        const page = join(HELP, m[1]!, 'page.mdx');
        let mdx: string;
        try {
          mdx = readFileSync(page, 'utf8');
        } catch {
          continue;
        }
        if (!anchorsOf(mdx).has(m[2]!))
          missing.push(`${file.replace(ROOT, '')}: /help/${m[1]}/#${m[2]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
