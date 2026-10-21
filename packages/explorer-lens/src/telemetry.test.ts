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
    expect(facets('', 'space:mine template:kanban')).toEqual(['template', 'space']);
    expect(facets('template:kanban', 'template:kanban,retrospective')).toEqual(['template']);
    expect(facets('template:kanban', 'template:retrospective')).toEqual(['template']);
  });

  it('names nothing for a value taken away, a cleared or an unchanged dimension', () => {
    expect(facets('template:kanban,retrospective', 'template:kanban')).toEqual([]);
    expect(facets('template:kanban', '')).toEqual([]);
    expect(facets('template:kanban x', 'template:kanban y')).toEqual([]);
  });

  it('names the text only when it goes from empty to non-empty', () => {
    expect(facets('', 'plan')).toEqual(['text']);
    expect(facets('plan', 'plan Q3')).toEqual([]);
    expect(facets('plan', '')).toEqual([]);
  });

  it('maps every facet to a closed type', () => {
    expect(
      facets('', 'plan kind:event-storming').map((facet) => LENS_TELEMETRY_TYPES[facet]),
    ).toEqual(['Text', 'Kind']);
  });
});
