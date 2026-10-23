// The lens's catalogue (liveplanner/docs/specs/013-workspace/explorer-filters.md "Dimensions"): every dimension,
// its values, their labels and the closed telemetry types. Brought over from liveplanner's explorer-lens for the
// index's lists: Template's values are the host app's own (its template families), and Opens in is retired, since
// the Plans / All switch says which app's items a list shows.

/** The dimensions in canonical order: the order tokens are written in and chips are shown in. */
export const LENS_DIMENSIONS = ['template', 'made-by', 'edited', 'people', 'space'] as const;
export type LensDimension = (typeof LENS_DIMENSIONS)[number];

/** Keys an older link may carry that no longer filter: kept in the string, not applied, and said why. */
export const RETIRED_KEYS = ['opens-in'] as const;
export type RetiredKey = (typeof RETIRED_KEYS)[number];

export const MADE_BY_VALUES = ['ai'] as const;
export type MadeByValue = (typeof MADE_BY_VALUES)[number];

export const EDITED_VALUES = ['today', '7d', '30d', '12m', 'this-year'] as const;
export type EditedValue = (typeof EDITED_VALUES)[number];

export const PEOPLE_VALUES = ['me', 'others'] as const;
export type PeopleValue = (typeof PEOPLE_VALUES)[number];

/** The space values that name no team; a team is `team:<id>`. */
export const SPACE_FIXED_VALUES = ['mine', 'shared'] as const;
export const SPACE_TEAM_PREFIX = 'team:';

/** The dimensions whose values are a fixed list, with that list. Template's come from the host; Space's teams
 *  from the person. */
export const FIXED_VALUES = {
  'made-by': MADE_BY_VALUES,
  edited: EDITED_VALUES,
  people: PEOPLE_VALUES,
} as const satisfies Partial<Record<LensDimension, readonly string[]>>;
export type FixedDimension = keyof typeof FIXED_VALUES;

export const isFixedDimension = (d: LensDimension): d is FixedDimension => d in FIXED_VALUES;

/** The chip label of each dimension; also how messages name it. */
export const DIMENSION_LABELS: Record<LensDimension, string> = {
  template: 'Template',
  'made-by': 'Made by AI',
  edited: 'Edited',
  people: 'People',
  space: 'Space',
};

/** The label of every fixed value. A team's label is its name; a template's is the host's. */
export const VALUE_LABELS = {
  'made-by': { ai: 'Made by AI' },
  edited: {
    today: 'Today',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '12m': 'Last 12 months',
    'this-year': 'This year',
  },
  people: { me: 'Me', others: 'Others' },
  space: { mine: 'My Work', shared: 'Shared With Me' },
} as const;

/** A dimension or the free text: what `Explorer / Selected / <Facet>` names. */
export type LensFacet = 'text' | LensDimension;

/** The closed telemetry type of each facet; never a value, a word or an id. */
export const LENS_TELEMETRY_TYPES = {
  text: 'Text',
  template: 'Template',
  'made-by': 'MadeBy',
  edited: 'Edited',
  people: 'People',
  space: 'Space',
} as const satisfies Record<LensFacet, string>;
export type LensTelemetryType = (typeof LENS_TELEMETRY_TYPES)[LensFacet];

/** The longest lens string read; the rest is cut and reported (`too_long`). */
export const LENS_MAX_INPUT_LENGTH = 512;

/** The most suggestions offered at once. */
export const LENS_MAX_SUGGESTIONS = 8;

/** How long after the last change the result count is announced, in milliseconds. */
export const LENS_SETTLE_MS = 400;

/** Separates the values of one token: `template:retrospective,kanban`. */
export const LENS_VALUE_SEPARATOR = ',';

/** The URL parameter that carries the lens string. */
export const LENS_QUERY_PARAM = 'q';

export function isLensDimension(value: string): value is LensDimension {
  return (LENS_DIMENSIONS as readonly string[]).includes(value);
}

export function isRetiredKey(value: string): value is RetiredKey {
  return (RETIRED_KEYS as readonly string[]).includes(value);
}
