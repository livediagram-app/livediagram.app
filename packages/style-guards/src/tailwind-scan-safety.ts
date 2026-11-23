import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { filesUnder } from './source-files';

// Tailwind's scanner reads whole FILES, not just the parts that are markup. Any class-shaped string in a source
// file gets compiled, including one written inside a comment that DESCRIBES a class rather than uses it. Harmless
// for a real utility; not harmless for a placeholder: a comment once spelled out a padding utility with a
// bracketed ellipsis standing in for the real value, Tailwind compiled a rule whose declared value was that
// ellipsis, and the whole stylesheet failed to parse on the dev server while the production build stayed green.

// Everything Tailwind is pointed at. Build output is excluded: it CONTAINS the compiled result, so scanning it
// would report the rule this prevents.
const SKIP_DIRS = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.turbo']);
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mdx', '.css'];

// A utility with an arbitrary value whose brackets hold an ellipsis: three dots, or the single character. Always
// a placeholder, never a class anybody means, so it can be refused outright. The pattern is assembled from pieces
// and never written out, since a module Tailwind scans must not hold a literal example of it. Escaped: three BARE
// dots in a regex mean 'any three characters'.
const DOTS = ['\\.', '\\.', '\\.'].join('');
const OPEN = String.fromCharCode(91); // [
const CLOSE = String.fromCharCode(93); // ]
const PLACEHOLDER_CLASS = new RegExp(
  `[a-z][a-z0-9-]*-\\${OPEN}[^\\${CLOSE}\\n]*(${DOTS}|\\u2026)[^\\${CLOSE}\\n]*\\${CLOSE}`,
);

/** Whether a source line holds an arbitrary-value class containing an ellipsis. */
export function holdsPlaceholderClass(line: string): boolean {
  return PLACEHOLDER_CLASS.test(line);
}

/** The files Tailwind scans under `dirs` (absolute folders). */
export function tailwindScannedFiles(dirs: readonly string[]): string[] {
  return dirs.flatMap((dir) =>
    filesUnder(dir, SKIP_DIRS, (name) => EXTS.some((e) => name.endsWith(e))),
  );
}

/** Every line of `files` holding a placeholder class, as `path:line  text` (the first 100 characters). */
export function checkTailwindScanSafety({
  root,
  files,
}: {
  root: string;
  files: readonly string[];
}): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (holdsPlaceholderClass(line)) {
          offenders.push(`${relative(root, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
  }
  return offenders;
}
