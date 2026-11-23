import { guardedSources, type SourceGuardOptions } from './source-files';

// Small text reads at WCAG AA (each product's docs/specs/004-interface-design/color-scheme.md "Accessibility"):
// slate-400 on white is 2.6:1, under the 4.5:1 small text needs, so a small or uppercase label's light colour is
// slate-500 or darker. This scans sources for a class string that pairs a small size or `uppercase` with a bare
// (light-mode) `text-slate-400` (or `!text-slate-400`); a variant (`dark:`, `placeholder:`) is not matched.

// One class string: '...', "..." or `...` on one line.
const CLASS_STRING = /(['"`])((?:(?!\1).)*?)\1/g;
const LIGHT_SLATE_400 = /(?<![\w:!-])!?text-slate-400\b/;
const SMALL_OR_UPPERCASE = /(?<![\w:!-])!?(uppercase|text-\[(9|10|11|12|13)px\]|text-xs|text-sm)\b/;

/** How many class strings on a source line pair small or uppercase text with a light-mode slate-400. */
export function lightSmallLabels(line: string): number {
  let found = 0;
  for (const m of line.matchAll(CLASS_STRING)) {
    const classes = m[2] ?? '';
    if (LIGHT_SLATE_400.test(classes) && SMALL_OR_UPPERCASE.test(classes)) found++;
  }
  return found;
}

/** One entry for each offending class string under the guard's dirs, as `path:line: text`. */
export function checkLabelContrast(options: SourceGuardOptions): string[] {
  const offenders: string[] = [];
  for (const { rel, text } of guardedSources(options))
    text.split('\n').forEach((line, i) => {
      for (let k = lightSmallLabels(line); k > 0; k--)
        offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  return offenders;
}
