// Writing a lens string (docs/specs/013-workspace/explorer-filters.md "Token grammar": the canonical
// string, and a chip writing its token in place).

import { LENS_DIMENSIONS, type LensDimension } from './dimensions';
import { normaliseInput, parseLens } from './parse';
import type { Lens, LensContext, LensValueOf } from './types';

export function tokenOf<D extends LensDimension>(dimension: D, value: LensValueOf[D]): string {
  return `${dimension}:${value}`;
}

/** The canonical string: applied tokens in dimension order, then the text words, one space apart. */
export function serialiseLens(lens: Lens): string {
  const tokens = LENS_DIMENSIONS.flatMap((dimension) => {
    const value = lens.filters[dimension];
    return value === null ? [] : [`${dimension}:${value}`];
  });
  return [...tokens, ...lens.text].join(' ');
}

/**
 * Writes a chip's choice into the string. Every token of the dimension leaves; a value is written
 * where the first one stood, else after the last token, else first. `null` clears the dimension.
 */
export function setDimension<D extends LensDimension>(
  input: string,
  dimension: D,
  value: LensValueOf[D] | null,
  context: LensContext,
): string {
  const { terms } = parseLens(input, context);
  const ofDimension = (index: number) => {
    const term = terms[index]!;
    return term.kind === 'token' && term.dimension === dimension;
  };
  const first = terms.findIndex((_, index) => ofDimension(index));
  const lastToken = terms.findLastIndex(
    (term, index) => term.kind === 'token' && !ofDimension(index),
  );
  const at = first !== -1 ? first : lastToken + 1;
  const words = terms.map((term, index) => (ofDimension(index) ? null : term.raw));
  if (value !== null) words.splice(at, 0, tokenOf(dimension, value));
  return words.filter((word) => word !== null).join(' ');
}

/** Removes one term's span from the string, collapsing the whitespace it leaves. */
export function removeTerm(input: string, term: { start: number; end: number }): string {
  return normaliseInput(`${input.slice(0, term.start)} ${input.slice(term.end)}`);
}
