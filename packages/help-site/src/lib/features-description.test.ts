import { describe, expect, it } from 'vitest';
import { FEATURES_DESCRIPTION_MAX, featuresDescription } from './features-description';
import { SITE } from '../test/fixture';
import { featuresMetadata } from '../components/CategoryPages';

describe('featuresDescription', () => {
  it('names every area in order, with a serial "and"', () => {
    expect(featuresDescription('livediagram', ['Canvas', 'Tabs', 'Tools'])).toBe(
      'Browse livediagram feature guides by area: Canvas, Tabs, and Tools.',
    );
    expect(featuresDescription('liveplanner', ['Plan', 'Tabs'])).toBe(
      'Browse liveplanner feature guides by area: Plan and Tabs.',
    );
    expect(featuresDescription('x', ['Plan'])).toBe('Browse x feature guides by area: Plan.');
  });

  it('never runs past a search result, naming as many as fit', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Area Number ${i + 1}`);
    const text = featuresDescription('livedocuments', many);
    expect(text.length).toBeLessThanOrEqual(FEATURES_DESCRIPTION_MAX);
    expect(text).toMatch(
      /^Browse livedocuments feature guides by area: Area Number 1, .*, and more\.$/,
    );
  });

  it('is what the features index says, from the catalogue', () => {
    const areas = SITE.catalogue.categories.filter((c) => c.kind === 'feature').map((c) => c.title);
    expect(featuresMetadata(SITE).description).toBe(
      featuresDescription(SITE.facts.siteName, areas),
    );
  });
});
