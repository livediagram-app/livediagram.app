import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { categories } from './articles';

// The features index's meta description names its areas (docs/specs/018-help/help-app.md "SEO"): every feature
// category, in the registry's order, and nothing else. It once left out Pages, Selection Modes and Search Panel, which the
// page itself lists.
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

  it('fits a search result', () => {
    const page = readFileSync(
      fileURLToPath(new URL('../app/features/page.tsx', import.meta.url)),
      'utf8',
    );
    const description = page.match(/'(Browse [^']+)'/)?.[1] ?? '';
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(160);
  });
});
