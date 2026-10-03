// The lens field's model (docs/specs/013-workspace/explorer-filters.md "The field"): one lens string
// shown as **pills**, its token words, and a **draft**, every other word, the one being typed
// included. Pure; the field and the chips edit the string only through these functions, so the
// pills always lead and a token joins them the moment it is complete.

import {
  LENS_DIMENSIONS,
  normaliseInput,
  orderValues,
  parseLens,
  setDimensionValues,
  type LensContext,
  type LensDimension,
} from '@livediagram/explorer-lens';

/** The field's two parts: the pills as one string of tokens, and the draft with its caret. */
export type FieldParts = { tokens: string; draft: string; draftCaret: number };

/** A lens string and where the caret stands in it. */
export type FieldWrite = { input: string; caret: number };

const WHITESPACE = /\s/;

/** One token per dimension, its values merged from every token of it, in canonical order. */
function mergedTokens(tokens: { dimension: LensDimension; values: readonly string[] }[]): string {
  return LENS_DIMENSIONS.flatMap((dimension) => {
    const values = orderValues(
      dimension,
      tokens.filter((token) => token.dimension === dimension).flatMap((token) => token.values),
    );
    return values.length === 0 ? [] : [`${dimension}:${values.join(',')}`];
  }).join(' ');
}

/**
 * Splits a lens string into pills and draft. `caret` (null when the field is not focused) keeps
 * the token-shaped word under it in the draft: it is still being typed. A token word leaves the
 * draft with the whitespace after it, and the caret moves back by what was cut before it.
 */
export function splitField(input: string, context: LensContext, caret: number | null): FieldParts {
  const { terms } = parseLens(input, context, caret ?? undefined);
  const tokens = terms.flatMap((term) => (term.kind === 'token' ? [term] : []));
  let draft = '';
  let cursor = 0;
  let cutBeforeCaret = 0;
  for (const token of tokens) {
    draft += input.slice(cursor, token.start);
    let end = token.end;
    while (end < input.length && WHITESPACE.test(input.charAt(end))) end += 1;
    if (caret !== null && token.start < caret) cutBeforeCaret += Math.min(caret, end) - token.start;
    cursor = end;
  }
  draft += input.slice(cursor);
  if (caret === null) {
    const settled = normaliseInput(draft);
    return { tokens: mergedTokens(tokens), draft: settled, draftCaret: settled.length };
  }
  return { tokens: mergedTokens(tokens), draft, draftCaret: caret - cutBeforeCaret };
}

/** The lens string the field holds: the pills, a space, then the draft; the caret in the draft. */
export function composeField(tokens: string, draft: string, draftCaret: number): FieldWrite {
  if (tokens === '') return { input: draft, caret: draftCaret };
  return { input: `${tokens} ${draft}`, caret: tokens.length + 1 + draftCaret };
}

/** Rewrites a string so its complete tokens lead as pills, keeping the caret where it was. */
export function settleField(input: string, caret: number, context: LensContext): FieldWrite {
  const parts = splitField(input, context, caret);
  return composeField(parts.tokens, parts.draft, parts.draftCaret);
}

/** The draft was edited: a token it completed joins the pills. */
export function writeDraft(
  tokens: string,
  draft: string,
  draftCaret: number,
  context: LensContext,
): FieldWrite {
  const written = composeField(tokens, draft, draftCaret);
  return settleField(written.input, written.caret, context);
}

/** Takes one pill away: every token of its dimension. The draft stays as it is. */
export function removePill(
  tokens: string,
  draft: string,
  dimension: LensDimension,
  context: LensContext,
): string {
  return composeField(setDimensionValues(tokens, dimension, [], context), draft, 0).input;
}

/**
 * A chip's choice (docs/specs/013-workspace/explorer-filters.md "The chip row"): a value toggles
 * in or out of its dimension's pill; `null`, the chip's "Any", clears the dimension. The draft
 * stays as it is.
 */
export function chooseChipValue(
  input: string,
  dimension: LensDimension,
  value: string | null,
  context: LensContext,
): string {
  const { tokens, draft } = splitField(input, context, null);
  const held = parseLens(tokens, context).terms.flatMap((term) =>
    term.kind === 'token' && term.dimension === dimension ? term.values : [],
  );
  const next =
    value === null
      ? []
      : held.includes(value)
        ? held.filter((candidate) => candidate !== value)
        : [...held, value];
  return composeField(setDimensionValues(tokens, dimension, next, context), draft, 0).input;
}
