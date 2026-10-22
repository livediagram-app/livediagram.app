// `Explorer / Selected / <Facet>` (docs/specs/013-workspace/explorer-filters.md "Telemetry"): once
// per facet that gained a value it did not hold. Only the closed facet name leaves the browser.

import { LENS_TELEMETRY_TYPES, selectedFacets, type Lens } from '@livediagram/explorer-lens';
import { track } from '@/lib/telemetry';

export function trackLensChange(previous: Lens, next: Lens): void {
  for (const facet of selectedFacets(previous, next)) {
    track('Explorer', 'Selected', LENS_TELEMETRY_TYPES[facet]);
  }
}
