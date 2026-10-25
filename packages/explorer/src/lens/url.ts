// The lens in the URL (explorer-filters.md "URL and carry-over"): `?q=`, whitespace collapsed, removed when
// empty, carried between aggregate views only.

import { normaliseInput } from './parse';
import type { LensView } from './types';

/** The lens a navigation takes along: kept from one aggregate view to another, else none. */
export function carryLens(input: string, from: LensView | null, to: LensView | null): string {
  return from === 'aggregate' && to === 'aggregate' ? normaliseInput(input) : '';
}
