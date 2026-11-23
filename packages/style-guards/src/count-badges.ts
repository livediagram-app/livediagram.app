import { guardedSources, type SourceGuardOptions } from './source-files';

// Counts are badges (each product's docs/specs/004-interface-design/counts.md): a UI string never puts a count in
// brackets ("Reveal (3)", "Gallery (12)"). This scans sources for a bracketed interpolation (after a space, as in
// prose; a CSS call like `brightness(${n})` has none) of something that counts (`.length`, `count`, `total`),
// outside accessible labels, which spell counts out for a screen reader, and outside tests.
const COUNT_IN_BRACKETS = / \(\$\{[^}]*(\.length|\bcount\b|\btotal\b)[^}]*\}\)/;

/** Whether a source line puts a count in brackets in a UI string. */
export function bracketsACount(line: string): boolean {
  return COUNT_IN_BRACKETS.test(line) && !/aria-label|ariaLabel/.test(line);
}

/** Every line under the guard's dirs that puts a count in brackets, as `path:line: text`. */
export function checkCountBadges(options: SourceGuardOptions): string[] {
  const offenders: string[] = [];
  for (const { rel, text } of guardedSources(options))
    text.split('\n').forEach((line, i) => {
      if (bracketsACount(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  return offenders;
}
