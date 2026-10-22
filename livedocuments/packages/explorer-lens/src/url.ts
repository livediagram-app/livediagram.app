// The lens in the URL (docs/specs/013-workspace/explorer-filters.md "URL and carry-over"): `?q=`,
// whitespace collapsed, removed when empty, carried between aggregate views only.

import { LENS_QUERY_PARAM } from './dimensions';
import { normaliseInput } from './parse';
import type { LensView } from './types';

/** The lens string a location search carries, or `''`. */
export function readLensQuery(search: string): string {
  return new URLSearchParams(search).get(LENS_QUERY_PARAM) ?? '';
}

/** The location search with `q` set to the normalised lens, or removed when it is empty; every
 *  other parameter kept in order. `''` or a string starting with `?`. */
export function withLensQuery(search: string, input: string): string {
  const params = new URLSearchParams(search);
  const lens = normaliseInput(input);
  if (lens === '') params.delete(LENS_QUERY_PARAM);
  else params.set(LENS_QUERY_PARAM, lens);
  const written = params.toString();
  return written === '' ? '' : `?${written}`;
}

/** The lens a navigation takes along: kept from one aggregate view to another, else none. */
export function carryLensQuery(input: string, from: LensView, to: LensView): string {
  return from === 'aggregate' && to === 'aggregate' ? input : '';
}
