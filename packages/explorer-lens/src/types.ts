// The lens's shapes (docs/specs/013-workspace/explorer-filters.md, blueprint
// docs/specs/013-workspace/blueprints/explorer-filters.md "Interfaces and contracts").

import type {
  BoardValue,
  EditedValue,
  LensDimension,
  MadeByValue,
  OpensInValue,
  PeopleValue,
} from './dimensions';

/** A space as the lens names it: My documents, Shared with me, or one team by id. */
export type SpaceValue = 'mine' | 'shared' | `team:${string}`;

/** The value type of each dimension. */
export type LensValueOf = {
  'opens-in': OpensInValue;
  board: BoardValue;
  'made-by': MadeByValue;
  edited: EditedValue;
  people: PeopleValue;
  space: SpaceValue;
};

/** Whether the current view has a scope (a breadcrumb) or lists every place at once. */
export type LensView = 'aggregate' | 'scoped';

/** One of the reader's teams: the id a token names, the name every label shows. */
export type LensTeam = { id: string; name: string };

/** What parsing needs to know about where the reader is. */
export type LensContext = { view: LensView; teams: readonly LensTeam[] };

/** One applied value per dimension, or null when the dimension is not set. */
export type LensFilters = { readonly [D in LensDimension]: LensValueOf[D] | null };

/** The one filter state: free words and one value per dimension. */
export type Lens = { text: readonly string[]; filters: LensFilters };

/** Why a token does or does not narrow the list. */
export type TokenState = 'applied' | 'superseded' | 'inert';

/** One word of the lens string, with its offsets into the input. */
export type LensTerm =
  | { kind: 'text'; raw: string; start: number; end: number }
  | { kind: 'pending'; raw: string; start: number; end: number; dimension: LensDimension }
  | {
      kind: 'token';
      raw: string;
      start: number;
      end: number;
      dimension: LensDimension;
      value: string;
      state: TokenState;
    };

/** Every named reason a word is reported. */
export const LENS_ISSUE_REASONS = [
  'unknown_dimension',
  'missing_value',
  'unknown_value',
  'unknown_team',
  'superseded',
  'space_not_here',
  'too_long',
] as const;
export type LensIssueReason = (typeof LENS_ISSUE_REASONS)[number];

/** The reasons that concern one dimension, and so name it. */
export type DimensionIssueReason = Exclude<LensIssueReason, 'unknown_dimension' | 'too_long'>;

/** Why a word reads as text instead of a token, when it looked like one. */
export type WordProblem =
  | { reason: 'unknown_dimension'; dimension: null; value: null }
  | {
      reason: Extract<DimensionIssueReason, 'missing_value' | 'unknown_value' | 'unknown_team'>;
      dimension: LensDimension;
      value: string | null;
    };

type Span = { raw: string; start: number; end: number };

/** A named report about one stretch of the input; never silent, never dropped. */
export type LensIssue =
  | (Span & { reason: 'unknown_dimension' | 'too_long'; dimension: null; value: null })
  | (Span & { reason: DimensionIssueReason; dimension: LensDimension; value: string | null });

export type ParsedLens = {
  lens: Lens;
  terms: readonly LensTerm[];
  issues: readonly LensIssue[];
};

/** One listed row, reduced to what the lens reads. `null` means the row cannot say. */
export type LensSubject = {
  name: string;
  savedAt: number;
  space: SpaceValue;
  people: PeopleValue;
  madeByAi: boolean | null;
  opensIn: OpensInValue | null;
  board: BoardValue | null;
};

/** What suggestions need beyond parsing: the rows in scope, to mark a value that matches nothing. */
export type SuggestContext = LensContext & { subjects: readonly LensSubject[]; now: number };

/** One autocomplete option and the stretch of the input it replaces. */
export type LensSuggestion = {
  id: string;
  kind: 'dimension' | 'value';
  dimension: LensDimension;
  value: string | null;
  insert: string;
  range: { start: number; end: number };
  label: string;
  dimensionLabel: string;
  name: string;
  matchesNothing: boolean;
};
