// Show Me on always-loaded surfaces loads its steps at the press (docs/specs/007-editor/show-me.md "Code"): the page
// panel's host and the photo review are in the editor's first load, and their step copy added 3.3 KiB gzipped to it
// when imported statically. The Illustrate tour loads the same page steps at its offer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

describe('Show Me in the editor’s first load', () => {
  it.each([
    ['PageTour.tsx', './page-tour-steps'],
    ['IllustrateTourHost.tsx', './page-tour-steps'],
    ['PhotoReviewTour.tsx', './photo-review-tour-steps'],
  ])('%s imports its steps only at the press', (file, steps) => {
    const src = read(file);
    expect(staticImports(src)).not.toContain(steps);
    expect(src).toContain(`import('${steps}')`);
  });
});
