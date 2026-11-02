// Every help article's import/export block has to be valid JavaScript: MDX hands it to acorn, and
// one stray apostrophe inside a single-quoted string (`'the editor's bar'`) takes the whole page
// down with a 500 in dev and fails `next build`. Compile each block (imports dropped, `export`
// stripped) with `new Function`, which parses without running it and throws the same SyntaxError,
// so the mistake shows up in a unit test instead.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(import.meta.dirname, 'app');

function mdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return mdxFiles(path);
    return name.endsWith('.mdx') ? [path] : [];
  });
}

/** The leading ESM block: every line before the first JSX or Markdown line at column 0. */
function esmBlock(source: string): string {
  const lines = source.split('\n');
  const end = lines.findIndex((line) => /^(<|#)/.test(line));
  return lines.slice(0, end === -1 ? lines.length : end).join('\n');
}

describe('help articles', () => {
  const files = mdxFiles(APP_DIR);

  it('finds the articles', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [relative(APP_DIR, file), file]))(
    '%s has a valid import/export block',
    (_name, file) => {
      const body = esmBlock(readFileSync(file, 'utf8'))
        .replace(/^import\s[^;]*;$/gm, '')
        .replace(/^export\s+/gm, '');
      // oxlint-disable-next-line typescript/no-implied-eval -- parsing only; the function is never called
      expect(() => new Function(body)).not.toThrow();
    },
  );
});
