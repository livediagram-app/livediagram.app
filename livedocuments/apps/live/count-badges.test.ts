import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Counts are badges (docs/specs/004-interface-design/counts.md): a UI string never puts a count in
// brackets ("Reveal (3)", "Gallery (12)"). This scans the editor's sources for
// a bracketed interpolation (after a space, as in prose; a CSS call like
// `brightness(${n})` has none) of something that counts (`.length`, `count`,
// `total`), outside accessible labels, which spell counts out for a screen
// reader, and outside tests.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = ['app', 'components', 'hooks', 'lib'];
const COUNT_IN_BRACKETS = / \(\$\{[^}]*(\.length|\bcount\b|\btotal\b)[^}]*\}\)/;

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

describe('counts are badges', () => {
  it('puts no count in brackets in a UI string', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sources(join(ROOT, dir))) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (COUNT_IN_BRACKETS.test(line) && !/aria-label|ariaLabel/.test(line))
              offenders.push(`${file.slice(ROOT.length)}:${i + 1}: ${line.trim()}`);
          });
      }
    expect(offenders).toEqual([]);
  });
});
