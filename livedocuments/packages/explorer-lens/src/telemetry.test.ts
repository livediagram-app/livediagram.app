import { describe, expect, it } from 'vitest';
import { LENS_TELEMETRY_TYPES } from './dimensions';
import { parseLens } from './parse';
import { selectedFacets } from './telemetry';
import type { LensContext } from './types';

const context: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const facets = (before: string, after: string) =>
  selectedFacets(parseLens(before, context).lens, parseLens(after, context).lens);

describe('selectedFacets', () => {
  it('names each dimension that gains a value it did not hold, in dimension order', () => {
    expect(facets('', 'space:mine edited:7d')).toEqual(['edited', 'space']);
    expect(facets('edited:7d', 'edited:7d,30d')).toEqual(['edited']);
    expect(facets('edited:7d', 'edited:30d')).toEqual(['edited']);
  });

  it('names nothing for a value taken away, a cleared or an unchanged dimension', () => {
    expect(facets('edited:7d,30d', 'edited:7d')).toEqual([]);
    expect(facets('edited:7d', '')).toEqual([]);
    expect(facets('edited:7d x', 'edited:7d y')).toEqual([]);
  });

  it('names the text only when it goes from empty to non-empty', () => {
    expect(facets('', 'plan')).toEqual(['text']);
    expect(facets('plan', 'plan Q3')).toEqual([]);
    expect(facets('plan', '')).toEqual([]);
  });

  it('maps every facet to a closed type', () => {
    expect(facets('', 'plan edited:7d').map((facet) => LENS_TELEMETRY_TYPES[facet])).toEqual([
      'Text',
      'Edited',
    ]);
  });
});
