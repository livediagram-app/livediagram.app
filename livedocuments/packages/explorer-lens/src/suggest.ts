// Autocomplete for typed tokens (docs/specs/013-workspace/explorer-filters.md "Suggestions").
// Pure: the field hands in its text and caret, and gets options with the stretch each replaces.

import {
  DIMENSION_LABELS,
  LENS_DIMENSIONS,
  LENS_MAX_SUGGESTIONS,
  LENS_VALUE_SEPARATOR,
  SPACE_TEAM_PREFIX,
  type LensDimension,
} from './dimensions';
import { valueOptions } from './labels';
import { compileLens } from './match';
import { parseLens } from './parse';
import { removeTerm, setDimensionValues } from './serialise';
import type { LensContext, LensSuggestion, SuggestContext } from './types';

const NO_MATCHES = 'no matches';

type Range = LensSuggestion['range'];

function clamp(caret: number, length: number): number {
  return Math.min(Math.max(caret, 0), length);
}

/** The whole word holding the caret: from the whitespace before it to the whitespace after. */
function wordAround(input: string, caret: number): Range {
  const start = input.slice(0, caret).search(/\S*$/);
  const after = input.slice(caret).search(/\s/);
  return { start, end: after === -1 ? input.length : caret + after };
}

function availableDimensions(context: LensContext): LensDimension[] {
  return LENS_DIMENSIONS.filter(
    (dimension) => dimension !== 'space' || context.view === 'aggregate',
  );
}

/** A list entry as the grammar compares it: lower case, a team id keeping its case. */
function normaliseEntry(entry: string): string {
  const lower = entry.toLowerCase();
  return lower.startsWith(SPACE_TEAM_PREFIX)
    ? `${SPACE_TEAM_PREFIX}${entry.slice(SPACE_TEAM_PREFIX.length)}`
    : lower;
}

/** The value list of a token being typed, split at the caret: the entries before the one under the
 *  caret, what of that one is typed, and the entries after it. Empty entries are dropped. */
function splitList(
  valuePart: string,
  caret: number,
): { earlier: string[]; typed: string; later: string[] } {
  const entryStart = valuePart.slice(0, caret).lastIndexOf(LENS_VALUE_SEPARATOR) + 1;
  const nextSeparator = valuePart.indexOf(LENS_VALUE_SEPARATOR, caret);
  const entries = (text: string) => text.split(LENS_VALUE_SEPARATOR).filter(Boolean);
  return {
    earlier: entries(valuePart.slice(0, Math.max(entryStart - 1, 0))),
    typed: valuePart.slice(entryStart, caret).toLowerCase(),
    later: nextSeparator === -1 ? [] : entries(valuePart.slice(nextSeparator + 1)),
  };
}

function dimensionSuggestion(dimension: LensDimension, range: Range): LensSuggestion {
  const label = DIMENSION_LABELS[dimension];
  return {
    id: `dimension:${dimension}`,
    kind: 'dimension',
    dimension,
    value: null,
    insert: `${dimension}:`,
    range,
    label,
    dimensionLabel: label,
    name: label,
    matchesNothing: false,
  };
}

/** Whether no subject in scope matches the value on its own: the dimension set to that one value,
 *  every other dimension and word of the field kept. */
function matchesNothing(
  input: string,
  range: Range,
  dimension: LensDimension,
  value: string,
  context: SuggestContext,
) {
  const alone = setDimensionValues(removeTerm(input, range), dimension, [value], context);
  return !context.subjects.some(compileLens(parseLens(alone, context).lens, context.now));
}

function valueSuggestions(
  input: string,
  at: number,
  range: Range,
  dimension: LensDimension,
  context: SuggestContext,
): LensSuggestion[] {
  const word = input.slice(range.start, range.end);
  const valueStart = word.indexOf(':') + 1;
  const { earlier, typed, later } = splitList(
    word.slice(valueStart),
    at - range.start - valueStart,
  );
  const listed = new Set([...earlier, ...later].map(normaliseEntry));
  const dimensionLabel = DIMENSION_LABELS[dimension];
  return valueOptions(dimension, context.teams)
    .filter(({ value }) => !listed.has(value))
    .filter(
      ({ value, label }) =>
        value.toLowerCase().startsWith(typed) || label.toLowerCase().startsWith(typed),
    )
    .slice(0, LENS_MAX_SUGGESTIONS)
    .map(({ value, label }) => {
      const nothing = matchesNothing(input, range, dimension, value, context);
      const name = `${label}, ${dimensionLabel}`;
      return {
        id: `value:${dimension}:${value}`,
        kind: 'value',
        dimension,
        value,
        insert: `${dimension}:${[...earlier, value, ...later].join(LENS_VALUE_SEPARATOR)}`,
        range,
        label,
        dimensionLabel,
        name: nothing ? `${name}, ${NO_MATCHES}` : name,
        matchesNothing: nothing,
      };
    });
}

/**
 * The suggestions for the word under the caret. A start of a dimension key offers dimensions; a
 * `<key>:<list>` offers the values the entry under the caret starts, leaving out those listed.
 */
export function suggestTokens(
  input: string,
  caret: number,
  context: SuggestContext,
): LensSuggestion[] {
  const at = clamp(caret, input.length);
  const range = wordAround(input, at);
  const fragment = input.slice(range.start, at).toLowerCase();
  if (fragment === '') return [];

  const dimensions = availableDimensions(context);
  const colon = fragment.indexOf(':');
  if (colon === -1) {
    return dimensions
      .filter((dimension) => dimension.startsWith(fragment))
      .map((dimension) => dimensionSuggestion(dimension, range));
  }
  const dimension = dimensions.find((candidate) => candidate === fragment.slice(0, colon));
  return dimension ? valueSuggestions(input, at, range, dimension, context) : [];
}

/**
 * Applies a suggestion over its range. A dimension writes `<key>:` and leaves the caret after the
 * colon. A value writes its token, then one space and the caret; the rest of the field is kept.
 */
export function acceptSuggestion(
  input: string,
  suggestion: LensSuggestion,
): { input: string; caret: number } {
  const before = input.slice(0, suggestion.range.start);
  const after = input.slice(suggestion.range.end);
  if (suggestion.kind === 'dimension') {
    return {
      input: `${before}${suggestion.insert}${after}`,
      caret: before.length + suggestion.insert.length,
    };
  }
  const head = `${before}${suggestion.insert} `;
  return { input: `${head}${after.trimStart()}`, caret: head.length };
}
