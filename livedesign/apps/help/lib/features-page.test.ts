import { describe, expect, it } from 'vitest';
import { featuresMetadata } from '@liveworkspace/help-site/components/CategoryPages';
import { categories } from './articles';
import { site } from './help-site';

// The features index's meta description names its areas (docs/specs/018-help/help-app.md "SEO"): every feature
// category, in the registry's order, and nothing else. It once left out Pages, Selection Modes and Search Panel, which the
// page itself lists.
// The description is made from the catalogue (featuresMetadata), so this holds the product's real one.
describe('the features index description', () => {
  const description = String(featuresMetadata(site).description ?? '');

  it('names every feature category and no other', () => {
    const areas = description.match(/feature guides by area: ([^.]+)\./)?.[1];
    expect(areas, 'the description lost its list of areas').toBeTruthy();
    const named = areas!.split(/,\s*(?:and\s+)?|\s+and\s+/);
    expect(named).toEqual(categories.filter((c) => c.kind === 'feature').map((c) => c.title));
  });

  it('fits a search result', () => {
    expect(description.startsWith('Browse livedesign ')).toBe(true);
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(160);
  });
});
