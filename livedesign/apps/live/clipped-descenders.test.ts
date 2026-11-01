import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// A line that clips its overflow never sets its line box shorter than its glyphs: `leading-none` makes the box exactly
// the font size, so `truncate` (overflow hidden) cut the descenders of g, p and y off a palette tile's name ("Cylinder"
// read "Cvlinder"). This scans every class string that clips (truncate, overflow-hidden, line-clamp) and fails one that
// also sets `leading-none` on text. Words are compared whole, split on spaces, so no pattern backtracks.
const ROOT = fileURLToPath(new URL('./', import.meta.url));
// The editor code every editor shares (@liveworkspace/workbench) renders here too.
const DIRS = ['components', 'app', 'hooks', '../../../packages/workbench/src'];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) acc.push(full);
  }
  return acc;
}

const CLIPS = (word: string) =>
  word === 'truncate' || word === 'overflow-hidden' || word.startsWith('line-clamp-');
const TEXT_SIZE = (word: string) => word.startsWith('text-[') || /^text-(xs|sm|base)$/.test(word);

function clipsDescenders(classes: string): boolean {
  const words = classes.split(' ');
  return words.some(CLIPS) && words.includes('leading-none') && words.some(TEXT_SIZE);
}

describe('clipped descenders', () => {
  it('reads a clipped line set leading-none as cutting its descenders', () => {
    expect(clipsDescenders('w-full truncate text-center text-[11px] leading-none')).toBe(true);
    expect(clipsDescenders('w-full truncate text-center text-[11px] leading-tight')).toBe(false);
    expect(clipsDescenders('text-[8px] font-semibold leading-none')).toBe(false);
  });

  it('never clips a line of text whose line box is shorter than its glyphs', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sourceFiles(join(ROOT, dir)))
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            for (const [, cls] of line.matchAll(/className="([^"]*)"/g))
              if (cls && clipsDescenders(cls)) offenders.push(`${relative(ROOT, file)}:${i + 1}`);
          });
    expect(offenders).toEqual([]);
  });
});
