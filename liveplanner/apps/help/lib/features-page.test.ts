import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { categories } from './articles';

// The features index's meta description names its areas (docs/specs/018-help/help-app.md "SEO"): every feature
// category, in the registry's order, and nothing else. It once named livediagram's Palette and Canvas, which
// liveplanner has never had, and left out Plan.
describe('the features index description', () => {
  it('names every feature category and no other', () => {
    const page = readFileSync(
      fileURLToPath(new URL('../app/features/page.tsx', import.meta.url)),
      'utf8',
    );
    const areas = page.match(/feature guides by area: ([^.]+)\./)?.[1];
    expect(areas, 'the description lost its list of areas').toBeTruthy();
    const named = areas!.split(/,\s*(?:and\s+)?/);
    expect(named).toEqual(categories.filter((c) => c.kind === 'feature').map((c) => c.title));
  });
});
