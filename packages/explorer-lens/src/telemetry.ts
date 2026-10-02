// What `Explorer / Selected / <type>` counts (docs/specs/013-workspace/explorer-filters.md
// "Telemetry"): a facet gaining a value, never the value itself.

import { LENS_DIMENSIONS, type LensFacet } from './dimensions';
import type { Lens } from './types';

/** The facets that gained a value between two lenses: a dimension set to a new value, or the text
 *  going from empty to non-empty. Clearing and unchanged facets count for nothing. */
export function selectedFacets(previous: Lens, next: Lens): LensFacet[] {
  const text: LensFacet[] = previous.text.length === 0 && next.text.length > 0 ? ['text'] : [];
  const dimensions = LENS_DIMENSIONS.filter((dimension) => {
    const value = next.filters[dimension];
    return value !== null && value !== previous.filters[dimension];
  });
  return [...text, ...dimensions];
}
