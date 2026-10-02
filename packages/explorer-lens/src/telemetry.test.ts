import { describe, expect, it } from 'vitest';
import { LENS_TELEMETRY_TYPES } from './dimensions';
import { parseLens } from './parse';
import { selectedFacets } from './telemetry';
import type { LensContext } from './types';

const context: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const facets = (before: string, after: string) =>
  selectedFacets(parseLens(before, context).lens, parseLens(after, context).lens);

describe('selectedFacets', () => {
  it('names each dimension that gains or changes a value, in dimension order', () => {
    expect(facets('', 'space:mine board:kanban')).toEqual(['board', 'space']);
    expect(facets('board:kanban', 'board:retrospective')).toEqual(['board']);
  });

  it('names nothing for a cleared or unchanged dimension', () => {
    expect(facets('board:kanban', '')).toEqual([]);
    expect(facets('board:kanban x', 'board:kanban y')).toEqual([]);
  });

  it('names the text only when it goes from empty to non-empty', () => {
    expect(facets('', 'plan')).toEqual(['text']);
    expect(facets('plan', 'plan Q3')).toEqual([]);
    expect(facets('plan', '')).toEqual([]);
  });

  it('maps every facet to a closed type', () => {
    expect(facets('', 'plan opens-in:draw').map((facet) => LENS_TELEMETRY_TYPES[facet])).toEqual([
      'Text',
      'OpensIn',
    ]);
  });
});
