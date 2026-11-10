import { describe, expect, it } from 'vitest';
import { mapSummary } from './MapMenuSection';

// docs/specs/009-elements/map.md "The menu": the section's first line says what the map shows.
describe('mapSummary', () => {
  it('names the view and counts what it holds', () => {
    expect(mapSummary({})).toBe('World · 0 countries · 0 pins');
    expect(
      mapSummary({
        mapRegion: 'europe',
        mapHighlights: ['FR'],
        mapPins: [{ id: 'a', lat: 0, lon: 0 }],
      }),
    ).toBe('Europe · 1 country · 1 pin');
    expect(mapSummary({ mapRegion: 'asia', mapCountry: 'JP' })).toBe(
      'Focused on JP · 0 countries · 0 pins',
    );
  });
});
