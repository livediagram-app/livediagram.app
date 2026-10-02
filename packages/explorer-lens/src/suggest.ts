// Autocomplete for typed tokens (docs/specs/013-workspace/explorer-filters.md "Suggestions").
// Pure: the field hands in its text and caret, and gets options with the stretch each replaces.

import {
  DIMENSION_LABELS,
  LENS_DIMENSIONS,
  LENS_MAX_SUGGESTIONS,
  type LensDimension,
} from './dimensions';
import { valueOptions } from './labels';
import { compileLens } from './match';
import { parseLens, readWord } from './parse';
import type { LensContext, LensSuggestion, SuggestContext } from './types';

const WORD = /\S+/g;
const NO_MATCHES = 'no matches';

function clamp(caret: number, length: number): number {
  return Math.min(Math.max(caret, 0), length);
}

/** The whole word holding the caret: from the whitespace before it to the whitespace after. */
function wordAround(input: string, caret: number): { start: number; end: number } {
  const start = input.slice(0, caret).search(/\S*$/);
  const after = input.slice(caret).search(/\s/);
  return { start, end: after === -1 ? input.length : caret + after };
}

function availableDimensions(context: LensContext): LensDimension[] {
  return LENS_DIMENSIONS.filter(
    (dimension) => dimension !== 'space' || context.view === 'aggregate',
  );
}

function dimensionSuggestion(
  dimension: LensDimension,
  range: LensSuggestion['range'],
): LensSuggestion {
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

/** Whether no subject in scope matches the field as accepting the suggestion would leave it. */
function matchesNothing(
  input: string,
  suggestion: LensSuggestion,
  context: SuggestContext,
): boolean {
  const { lens } = parseLens(acceptSuggestion(input, suggestion, context).input, context);
  return !context.subjects.some(compileLens(lens, context.now));
}

/**
 * The suggestions for the word under the caret. A start of a dimension key offers dimensions; a
 * `<key>:<start>` offers that dimension's values whose value or label starts with `<start>`.
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
  if (!dimension) return [];
  const typed = fragment.slice(colon + 1);
  const dimensionLabel = DIMENSION_LABELS[dimension];
  return valueOptions(dimension, context.teams)
    .filter(
      ({ value, label }) =>
        value.toLowerCase().startsWith(typed) || label.toLowerCase().startsWith(typed),
    )
    .slice(0, LENS_MAX_SUGGESTIONS)
    .map(({ value, label }) => {
      const suggestion: LensSuggestion = {
        id: `value:${dimension}:${value}`,
        kind: 'value',
        dimension,
        value,
        insert: `${dimension}:${value}`,
        range,
        label,
        dimensionLabel,
        name: `${label}, ${dimensionLabel}`,
        matchesNothing: false,
      };
      if (!matchesNothing(input, suggestion, context)) return suggestion;
      return { ...suggestion, matchesNothing: true, name: `${suggestion.name}, ${NO_MATCHES}` };
    });
}

/**
 * Applies a suggestion. A dimension writes `<key>:` and leaves the caret after the colon. A value
 * writes its token, drops every other token of its dimension, and leaves one space and the caret
 * after it; the rest of the field is rejoined with single spaces.
 */
export function acceptSuggestion(
  input: string,
  suggestion: LensSuggestion,
  context: LensContext,
): { input: string; caret: number } {
  const before = input.slice(0, suggestion.range.start);
  const after = input.slice(suggestion.range.end);
  if (suggestion.kind === 'dimension') {
    return {
      input: `${before}${suggestion.insert}${after}`,
      caret: before.length + suggestion.insert.length,
    };
  }
  const keep = (word: string) => {
    const reading = readWord(word, context);
    return reading.kind !== 'token' || reading.dimension !== suggestion.dimension;
  };
  const wordsOf = (text: string) => [...text.matchAll(WORD)].map((match) => match[0]).filter(keep);
  const head = `${[...wordsOf(before), suggestion.insert].join(' ')} `;
  return { input: `${head}${wordsOf(after).join(' ')}`, caret: head.length };
}
