// What `Explorer / Selected / <Facet>` counts (explorer-filters.md "Telemetry"): a facet gaining a value it did
// not hold, never the value itself.

import { LENS_DIMENSIONS, LENS_TELEMETRY_TYPES, type LensTelemetryType } from './dimensions';
import type { Lens } from './types';

/** The facets that gained a value between two lenses: a dimension holding a value it did not before, or the text
 *  going from empty to non-empty. Values taken away count for nothing. */
export function selectedFacets(previous: Lens, next: Lens): LensTelemetryType[] {
  const text: LensTelemetryType[] =
    previous.text.length === 0 && next.text.length > 0 ? [LENS_TELEMETRY_TYPES.text] : [];
  const dimensions = LENS_DIMENSIONS.filter((dimension) => {
    const before: readonly string[] = previous.filters[dimension];
    const after: readonly string[] = next.filters[dimension];
    return after.some((value) => !before.includes(value));
  }).map((dimension) => LENS_TELEMETRY_TYPES[dimension]);
  return [...text, ...dimensions];
}
