// Writing a lens string (explorer-filters.md "Token grammar": the canonical string, one token per dimension with
// its values as a comma list, and chips writing in place).

import { LENS_DIMENSIONS, LENS_VALUE_SEPARATOR, type LensDimension } from './dimensions';
import { normaliseInput, orderValues, parseLens } from './parse';
import type { Lens, LensContext } from './types';

/** The canonical string: one token per set dimension in dimension order, then the text words. */
export function serialiseLens(lens: Lens): string {
  const tokens = LENS_DIMENSIONS.flatMap((dimension) => {
    const values: readonly string[] = lens.filters[dimension];
    return values.length === 0 ? [] : [`${dimension}:${values.join(LENS_VALUE_SEPARATOR)}`];
  });
  return [...tokens, ...lens.text].join(' ');
}

/**
 * Sets a dimension to exactly `values`, in place. Every token of the dimension leaves; one token with the values
 * in canonical order is written where the first stood, else after the last token, else first. No values clears
 * the dimension. Values that are not the dimension's are dropped.
 */
export function setDimensionValues(
  input: string,
  dimension: LensDimension,
  values: readonly string[],
  context: LensContext,
): string {
  const { terms } = parseLens(input, context);
  const ofDimension = terms.map((term) => term.kind === 'token' && term.dimension === dimension);
  const first = ofDimension.indexOf(true);
  const lastToken = terms.findLastIndex(
    (term, index) => term.kind === 'token' && !ofDimension[index],
  );
  const words = terms.map((term, index) => (ofDimension[index] ? null : term.raw));
  const ordered = orderValues(dimension, values, context);
  if (ordered.length > 0) {
    words.splice(
      first !== -1 ? first : lastToken + 1,
      0,
      `${dimension}:${ordered.join(LENS_VALUE_SEPARATOR)}`,
    );
  }
  return words.filter((word) => word !== null).join(' ');
}

/** Removes one term's span from the string, collapsing the whitespace it leaves. */
export function removeTerm(input: string, term: { start: number; end: number }): string {
  return normaliseInput(`${input.slice(0, term.start)} ${input.slice(term.end)}`);
}
