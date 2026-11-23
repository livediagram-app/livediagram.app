import { guardedSources, type SourceGuardOptions } from './source-files';

// A line that clips its overflow never sets its line box shorter than its glyphs: `leading-none` makes the box exactly
// the font size, so `truncate` (overflow hidden) cut the descenders of g, p and y off a palette tile's name ("Cylinder"
// read "Cvlinder"). This scans every class string that clips (truncate, overflow-hidden, line-clamp) and fails one that
// also sets `leading-none` on text. Words are compared whole, split on spaces, so no pattern backtracks.
const CLIPS = (word: string) =>
  word === 'truncate' || word === 'overflow-hidden' || word.startsWith('line-clamp-');
const TEXT_SIZE = (word: string) => word.startsWith('text-[') || /^text-(xs|sm|base)$/.test(word);

/** Whether a class string clips a line of text whose line box is shorter than its glyphs. */
export function clipsDescenders(classes: string): boolean {
  const words = classes.split(' ');
  return words.some(CLIPS) && words.includes('leading-none') && words.some(TEXT_SIZE);
}

/** One entry for each such className in the .tsx files under the guard's dirs, as `path:line`. */
export function checkClippedDescenders(options: SourceGuardOptions): string[] {
  const offenders: string[] = [];
  for (const { rel, text } of guardedSources(options, /\.tsx$/))
    text.split('\n').forEach((line, i) => {
      for (const [, cls] of line.matchAll(/className="([^"]*)"/g))
        if (cls && clipsDescenders(cls)) offenders.push(`${rel}:${i + 1}`);
    });
  return offenders;
}
