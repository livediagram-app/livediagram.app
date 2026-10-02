// Writing a lens string (docs/specs/013-workspace/explorer-filters.md "Token grammar": the canonical
// string, one token per dimension with its values as a comma list, and chips writing in place).

import { LENS_DIMENSIONS, LENS_VALUE_SEPARATOR, type LensDimension } from './dimensions';
import { normaliseInput, orderValues, parseLens } from './parse';
import type { Lens, LensContext, LensValueOf } from './types';

/** One token: the dimension and its values as a comma list. */
export function tokenOf<D extends LensDimension>(
  dimension: D,
  values: readonly LensValueOf[D][],
): string {
  return `${dimension}:${values.join(LENS_VALUE_SEPARATOR)}`;
}

/** The canonical string: one token per set dimension in dimension order, then the text words. */
export function serialiseLens(lens: Lens): string {
  const tokens = LENS_DIMENSIONS.flatMap((dimension) => {
    const values: readonly string[] = lens.filters[dimension];
    return values.length === 0 ? [] : [`${dimension}:${values.join(LENS_VALUE_SEPARATOR)}`];
  });
  return [...tokens, ...lens.text].join(' ');
}

/**
 * Sets a dimension to exactly `values`, in place. Every token of the dimension leaves; one token
 * with the values in canonical order is written where the first stood, else after the last token,
 * else first. No values clears the dimension.
 */
export function setDimension<D extends LensDimension>(
  input: string,
  dimension: D,
  values: readonly LensValueOf[D][],
  context: LensContext,
): string {
  return setDimensionValues(input, dimension, values, context);
}

/** `setDimension` over strings read from elsewhere (a token, a suggestion): `orderValues` keeps
 *  only the dimension's own values and drops the rest. */
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
  const ordered = orderValues(dimension, values);
  if (ordered.length > 0) {
    words.splice(
      first !== -1 ? first : lastToken + 1,
      0,
      `${dimension}:${ordered.join(LENS_VALUE_SEPARATOR)}`,
    );
  }
  return words.filter((word) => word !== null).join(' ');
}

/** A multi-select chip's click: adds the value to those the dimension's tokens hold, or takes it
 *  away when it is already there. */
export function toggleDimensionValue<D extends LensDimension>(
  input: string,
  dimension: D,
  value: LensValueOf[D],
  context: LensContext,
): string {
  const held = parseLens(input, context).terms.flatMap((term) =>
    term.kind === 'token' && term.dimension === dimension ? term.values : [],
  );
  const next = held.includes(value)
    ? held.filter((candidate) => candidate !== value)
    : [...held, value];
  return setDimensionValues(input, dimension, next, context);
}

/** Removes one term's span from the string, collapsing the whitespace it leaves. */
export function removeTerm(input: string, term: { start: number; end: number }): string {
  return normaliseInput(`${input.slice(0, term.start)} ${input.slice(term.end)}`);
}
