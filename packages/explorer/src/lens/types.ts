// The lens's shapes (liveplanner/docs/specs/013-workspace/explorer-filters.md).

import type {
  EditedValue,
  LensDimension,
  MadeByValue,
  OpensInValue,
  PeopleValue,
} from './dimensions';

/** A space as the lens names it: My Work, Shared With Me, or one team by id. */
export type SpaceValue = 'mine' | 'shared' | `team:${string}`;

/** The value type of each dimension. A template is one of the host's families. */
export type LensValueOf = {
  'opens-in': OpensInValue;
  mode: string;
  template: string;
  'made-by': MadeByValue;
  edited: EditedValue;
  people: PeopleValue;
  space: SpaceValue;
};

/** Whether the current view has a scope (a breadcrumb) or lists every place at once. */
export type LensView = 'aggregate' | 'scoped';

/** One of the reader's teams: the id a token names, the name every label shows. */
export type LensTeam = { id: string; name: string };

/** One value a dimension offers, with its label. */
export type LensOption = { value: string; label: string };

/** What parsing needs to know: where the reader is, their teams, the host's editor modes (none: no Mode dimension)
 *  and its template families (none: no Template dimension). `oneApp`: the kind the list is held to (the host's own-app filter), so Opens in offers no
 *  chip or suggestion; a typed `opens-in:` token still reads, and narrows within it. */
export type LensContext = {
  view: LensView;
  teams: readonly LensTeam[];
  templates: readonly LensOption[];
  modes?: readonly LensOption[];
  oneApp?: OpensInValue | null;
  /** The list is This Browser's, which keeps no template, maker or mode: those dimensions offer no chip there. */
  local?: boolean;
};

/** The applied values of each dimension, deduplicated, in the dimension's value order; empty when unset. */
export type LensFilters = { readonly [D in LensDimension]: readonly LensValueOf[D][] };

/** The one filter state: free words and the values of every dimension. */
export type Lens = { text: readonly string[]; filters: LensFilters };

/** Whether a token narrows the list: `inert` for a Space token on a scoped view. */
export type TokenState = 'applied' | 'inert';

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
      values: readonly string[];
      state: TokenState;
    };

/** Every named reason a word is reported. */
export const LENS_ISSUE_REASONS = [
  'unknown_dimension',
  'missing_value',
  'unknown_value',
  'unknown_team',
  'space_not_here',
  'too_long',
] as const;
type LensIssueReason = (typeof LENS_ISSUE_REASONS)[number];

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
  // The kind of the app it opens in.
  opensIn: OpensInValue;
  // The editor mode its app last reported (`summary.mode`), or null when it has none.
  mode: string | null;
  savedAt: number;
  space: SpaceValue;
  people: PeopleValue;
  madeByAi: boolean | null;
  template: string | null;
};

/** What suggestions need beyond parsing: the rows loaded, to mark a value that matches nothing (only when the
 *  list is whole: `subjects` null while more pages remain, so nothing is marked on a guess). */
export type SuggestContext = LensContext & {
  subjects: readonly LensSubject[] | null;
  now: number;
};

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
