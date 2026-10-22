import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Tailwind's scanner reads whole FILES, not just the parts that are markup. Any
// class-shaped string in a source file gets compiled, including one written
// inside a comment that DESCRIBES a class rather than uses it.
//
// Harmless for a real utility, and this codebase names them in prose
// constantly. Not harmless for a placeholder: a comment here once spelled out
// the iOS safe-area padding utility with a bracketed ellipsis standing in for
// the real value, and Tailwind compiled a rule whose declared value was that
// ellipsis. The whole stylesheet then failed to parse, taking the dev server
// with it.
//
// Worth a guard rather than a memo, because of HOW it failed: the production
// build was green and only the dev server rejected it, so the repo's own gate
// could not catch it and the first person to find out was somebody running the
// app.
//
// This file obeys its own rule, which is why the pattern below is assembled
// from pieces and never written out: the test is scanned like every other
// source file, so a literal example in it would be the very bug it forbids.
// (It found exactly that on its first run.)

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// Everything Tailwind is pointed at. Build output is excluded: it CONTAINS the
// compiled result, so scanning it would report the rule we are preventing.
const SKIP_DIRS = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.turbo']);
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mdx', '.css'];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (EXTS.some((e) => entry.endsWith(e))) acc.push(full);
  }
  return acc;
}

// A utility with an arbitrary value whose brackets hold an ellipsis — three
// dots, or the single character. Always a placeholder, never a class anybody
// means, so it can be refused outright with no judgement call.
// Escaped: three BARE dots in a regex mean 'any three characters', which
// matched every arbitrary-value class in the app the first time round.
const DOTS = ['\\.', '\\.', '\\.'].join('');
const OPEN = String.fromCharCode(91); // [
const CLOSE = String.fromCharCode(93); // ]
const PLACEHOLDER_CLASS = new RegExp(
  `[a-z][a-z0-9-]*-\\${OPEN}[^\\${CLOSE}\\n]*(${DOTS}|\\u2026)[^\\${CLOSE}\\n]*\\${CLOSE}`,
);

describe('no placeholder class names anywhere Tailwind can see them', () => {
  const files = sourceFiles(ROOT);

  it('scans a real tree (guard against this test going blind)', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('has no arbitrary-value class containing an ellipsis', () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (PLACEHOLDER_CLASS.test(line)) {
            offenders.push(`${file.slice(ROOT.length)}:${i + 1}  ${line.trim().slice(0, 100)}`);
          }
        });
    }
    // Named in full, because the fix is to reword ONE line and this message is
    // the only thing that says which.
    expect(
      offenders,
      `Tailwind would compile these into invalid CSS:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
