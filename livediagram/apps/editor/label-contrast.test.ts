import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Small text reads at WCAG AA (docs/specs/004-interface-design/color-scheme.md "Accessibility"): slate-400 on
// white is 2.6:1, under the 4.5:1 small text needs (issue #863), so a small or uppercase label's light colour is
// slate-500 or darker. This scans the editor's sources for a class string that pairs a small size or `uppercase`
// with a bare (light-mode) `text-slate-400` (or `!text-slate-400`); a variant (`dark:`, `placeholder:`) is not matched.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  'app',
  'components',
  'hooks',
  'lib',
  // The editor code every editor shares (@liveworkspace/workbench) renders here too, so it is held to the rule as well.
  '../../../packages/workbench/src',
];
// One class string: '...', "..." or `...` on one line.
const CLASS_STRING = /(['"`])((?:(?!\1).)*?)\1/g;
const LIGHT_SLATE_400 = /(?<![\w:!-])!?text-slate-400\b/;
const SMALL_OR_UPPERCASE = /(?<![\w:!-])!?(uppercase|text-\[(9|10|11|12|13)px\]|text-xs|text-sm)\b/;

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

describe('small labels read at AA', () => {
  it('pairs no small or uppercase text with a light-mode text-slate-400', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sources(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            for (const m of line.matchAll(CLASS_STRING)) {
              const classes = m[2] ?? '';
              if (LIGHT_SLATE_400.test(classes) && SMALL_OR_UPPERCASE.test(classes))
                offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          });
      }
    expect(offenders).toEqual([]);
  });
});
