import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Small text in the editor's chrome reads at WCAG AA (4.5:1, docs/specs/004-interface-design/color-scheme.md).
// slate-300 and slate-400 are too pale for text on the white and near-white surfaces the chrome uses (2.6:1 at best),
// and slate-500 too pale on a slate-100 or slate-200 chip (4.3:1 and 3.9:1). This scans every class string that sets a
// small text size and fails one that pairs it with those light-mode colours; a `dark:` (or other variant) colour, a
// placeholder and an icon (no text size) are not text on a light surface and are left alone.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
// The editor code every editor shares (@liveworkspace/workbench) renders here too.
const DIRS = ['components', 'app', 'hooks', '../../../packages/workbench/src'];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const SMALL = /(?<![\w:-])text-(xs|sm|\[(9|10|11|12|13)(\.5)?px\])(?![\w-])/;
const PALE = /(?<![\w:/!-])text-slate-(300|400)(?![\w/-])/;
const CHIP = /(?<![\w:/-])bg-slate-(100|200)(?![\w/-])/;
const MID = /(?<![\w:/!-])text-slate-500(?![\w/-])/;
const STRING = /(["'`])((?:(?!\1)[^\n])*)\1/g;

describe('small text contrast in the chrome', () => {
  it('never sets small text in slate-300 or slate-400, nor slate-500 on a slate-100 or slate-200 chip', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sourceFiles(join(ROOT, dir))) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            for (const [, , s] of line.matchAll(STRING)) {
              if (!s || !SMALL.test(s)) continue;
              if (PALE.test(s) || (CHIP.test(s) && MID.test(s)))
                offenders.push(`${relative(ROOT, file)}:${i + 1}: ${s.slice(0, 100)}`);
            }
          });
      }
    expect(offenders).toEqual([]);
  });
});
