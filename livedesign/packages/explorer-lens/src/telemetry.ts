// What `Explorer / Selected / <Facet>` counts (docs/specs/013-workspace/explorer-filters.md
// "Telemetry"): a facet gaining a value it did not hold, never the value itself.

import { LENS_DIMENSIONS, type LensFacet } from './dimensions';
import type { Lens } from './types';

/** The facets that gained a value between two lenses: a dimension holding a value it did not
 *  before, or the text going from empty to non-empty. Values taken away count for nothing. */
export function selectedFacets(previous: Lens, next: Lens): LensFacet[] {
  const text: LensFacet[] = previous.text.length === 0 && next.text.length > 0 ? ['text'] : [];
  const dimensions = LENS_DIMENSIONS.filter((dimension) => {
    const before: readonly string[] = previous.filters[dimension];
    const after: readonly string[] = next.filters[dimension];
    return after.some((value) => !before.includes(value));
  });
  return [...text, ...dimensions];
}
