// Reading a lens string (docs/specs/013-workspace/explorer-filters.md "Token grammar", blueprint
// "Behaviour and state"). Pure and total: every word yields one term, every rejection is named.

import {
  EDITED_VALUES,
  FIXED_VALUES,
  KIND_VALUES,
  LENS_MAX_INPUT_LENGTH,
  LENS_VALUE_SEPARATOR,
  MADE_BY_VALUES,
  OPENS_IN_VALUES,
  PEOPLE_VALUES,
  SPACE_FIXED_VALUES,
  SPACE_TEAM_PREFIX,
  TEMPLATE_VALUES,
  isLensDimension,
  type LensDimension,
} from './dimensions';
import type {
  Lens,
  LensContext,
  LensFilters,
  LensIssue,
  LensTerm,
  ParsedLens,
  SpaceValue,
  WordProblem,
} from './types';

/** A word that looks like `<key>:…`, the only shape that can be reported as a bad token. */
const TOKEN_SHAPED = /^([A-Za-z][A-Za-z-]*):(.*)$/s;
const WORD = /\S+/g;
const WHITESPACE = /\s/;

/** How one word reads: a token and its values, or text with the problem that kept it from being
 *  one (null for a plain word). */
export type WordReading =
  | { kind: 'token'; dimension: LensDimension; values: readonly string[] }
  | { kind: 'text'; problem: WordProblem | null };

/** How one entry of a token's value list reads. */
type ValueReading = { ok: true; value: string } | { ok: false; problem: WordProblem };

const NO_FILTERS: LensFilters = {
  'opens-in': [],
  kind: [],
  template: [],
  'made-by': [],
  edited: [],
  people: [],
  space: [],
};

const PLAIN: WordReading = { kind: 'text', problem: null };

export function emptyLens(): Lens {
  return { text: [], filters: NO_FILTERS };
}

/** Collapses every run of whitespace to one space and trims: the form the URL carries. */
export function normaliseInput(input: string): string {
  return input.split(/\s+/).filter(Boolean).join(' ');
}

/** The key of a token-shaped word, lower-cased, or null for any other word. */
export function tokenKeyOf(word: string): string | null {
  const [, key] = TOKEN_SHAPED.exec(word) ?? [];
  return key === undefined ? null : key.toLowerCase();
}

function isTeamValue(value: string): value is `team:${string}` {
  return value.startsWith(SPACE_TEAM_PREFIX) && value.length > SPACE_TEAM_PREFIX.length;
}

/** The members of `list` found in `values`, in the list's order. */
function inOrder<T extends string>(list: readonly T[], values: readonly string[]): T[] {
  return list.filter((candidate) => values.includes(candidate));
}

/** Spaces in canonical order: My documents, Shared with me, then teams by id. */
function orderSpaces(values: readonly string[]): SpaceValue[] {
  const teams = [...new Set(values.filter(isTeamValue))].sort();
  return [...inOrder(SPACE_FIXED_VALUES, values), ...teams];
}

/** A dimension's values deduplicated and in its canonical order; any value outside it is dropped. */
export function orderValues(dimension: LensDimension, values: readonly string[]): string[] {
  return dimension === 'space'
    ? orderSpaces(values)
    : inOrder<string>(FIXED_VALUES[dimension], values);
}

function problem(
  reason: Extract<WordProblem, { dimension: LensDimension }>['reason'],
  dimension: LensDimension,
  value: string | null,
): ValueReading {
  return { ok: false, problem: { reason, dimension, value } };
}

function readSpaceValue(raw: string, context: LensContext): ValueReading {
  const lower = raw.toLowerCase();
  if (inOrder(SPACE_FIXED_VALUES, [lower]).length > 0) return { ok: true, value: lower };
  if (!lower.startsWith(SPACE_TEAM_PREFIX)) return problem('unknown_value', 'space', raw);
  const id = raw.slice(SPACE_TEAM_PREFIX.length);
  if (id === '') return problem('missing_value', 'space', null);
  const value = `${SPACE_TEAM_PREFIX}${id}`;
  if (!context.teams.some((team) => team.id === id)) return problem('unknown_team', 'space', value);
  return { ok: true, value };
}

function readValue(dimension: LensDimension, raw: string, context: LensContext): ValueReading {
  if (raw === '') return problem('missing_value', dimension, null);
  if (dimension === 'space') return readSpaceValue(raw, context);
  const value = raw.toLowerCase();
  if (inOrder<string>(FIXED_VALUES[dimension], [value]).length === 0) {
    return problem('unknown_value', dimension, raw);
  }
  return { ok: true, value };
}

/** Reads one whitespace-free word against the grammar. A comma list is a token only when every
 *  entry is a value of its dimension; otherwise the first bad entry names the problem. */
export function readWord(word: string, context: LensContext): WordReading {
  const [, rawKey, rawValues = ''] = TOKEN_SHAPED.exec(word) ?? [];
  if (rawKey === undefined) return PLAIN;
  const key = rawKey.toLowerCase();
  if (!isLensDimension(key)) {
    return { kind: 'text', problem: { reason: 'unknown_dimension', dimension: null, value: null } };
  }
  const values: string[] = [];
  for (const raw of rawValues.split(LENS_VALUE_SEPARATOR)) {
    const reading = readValue(key, raw, context);
    if (!reading.ok) return { kind: 'text', problem: reading.problem };
    values.push(reading.value);
  }
  return { kind: 'token', dimension: key, values: orderValues(key, values) };
}

/** The typed filters of the applied values; every value was already validated by `readWord`. */
function filtersOf(applied: ReadonlyMap<LensDimension, readonly string[]>): LensFilters {
  const of = (dimension: LensDimension) => applied.get(dimension) ?? [];
  return {
    'opens-in': inOrder(OPENS_IN_VALUES, of('opens-in')),
    kind: inOrder(KIND_VALUES, of('kind')),
    template: inOrder(TEMPLATE_VALUES, of('template')),
    'made-by': inOrder(MADE_BY_VALUES, of('made-by')),
    edited: inOrder(EDITED_VALUES, of('edited')),
    people: inOrder(PEOPLE_VALUES, of('people')),
    space: orderSpaces(of('space')),
  };
}

/** Where the readable prefix of an over-long input ends: a word boundary when there is one. */
function cutAt(input: string): number {
  if (input.length <= LENS_MAX_INPUT_LENGTH) return input.length;
  if (WHITESPACE.test(input.charAt(LENS_MAX_INPUT_LENGTH))) return LENS_MAX_INPUT_LENGTH;
  const lastSpace = input.slice(0, LENS_MAX_INPUT_LENGTH).search(/\s\S*$/);
  return lastSpace === -1 ? LENS_MAX_INPUT_LENGTH : lastSpace;
}

/**
 * Reads a lens string. `caret`, given only by the live field, holds the token-shaped word under it
 * as pending: neither applied nor text, and not reported until the caret leaves it. Tokens of one
 * dimension join their values, as one comma list would.
 */
export function parseLens(input: string, context: LensContext, caret?: number): ParsedLens {
  const cut = cutAt(input);
  const terms: LensTerm[] = [];
  const issues: LensIssue[] = [];
  const applied = new Map<LensDimension, readonly string[]>();

  for (const match of input.slice(0, cut).matchAll(WORD)) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    const key = tokenKeyOf(raw);
    const underCaret = caret !== undefined && start <= caret && caret <= end;
    if (underCaret && key !== null && isLensDimension(key)) {
      terms.push({ kind: 'pending', raw, start, end, dimension: key });
      continue;
    }
    const reading = readWord(raw, context);
    if (reading.kind === 'text') {
      terms.push({ kind: 'text', raw, start, end });
      if (reading.problem) issues.push({ ...reading.problem, raw, start, end });
      continue;
    }
    const { dimension, values } = reading;
    const inert = dimension === 'space' && context.view === 'scoped';
    terms.push({
      kind: 'token',
      raw,
      start,
      end,
      dimension,
      values,
      state: inert ? 'inert' : 'applied',
    });
    if (inert) {
      const value = values.join(LENS_VALUE_SEPARATOR);
      issues.push({ reason: 'space_not_here', raw, start, end, dimension, value });
    } else {
      applied.set(dimension, [...(applied.get(dimension) ?? []), ...values]);
    }
  }

  if (cut < input.length) {
    issues.push({
      reason: 'too_long',
      raw: input.slice(cut),
      start: cut,
      end: input.length,
      dimension: null,
      value: null,
    });
  }

  return {
    lens: {
      text: terms.filter((term) => term.kind === 'text').map((term) => term.raw),
      filters: filtersOf(applied),
    },
    terms,
    issues,
  };
}
