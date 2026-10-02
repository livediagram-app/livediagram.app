// The lens's catalogue (docs/specs/013-workspace/explorer-filters.md "Dimensions"): every
// dimension, its closed values, their British English labels and the closed telemetry types.

/** The dimensions in canonical order: the order tokens are written in and chips are shown in. */
export const LENS_DIMENSIONS = [
  'opens-in',
  'board',
  'made-by',
  'edited',
  'people',
  'space',
] as const;
export type LensDimension = (typeof LENS_DIMENSIONS)[number];

/** The editor modes a document can be created to open in. Mirrors `EDITOR_MODES` of
 *  `@livediagram/document`, which replaces this list once it exists on main. */
export const OPENS_IN_VALUES = ['diagram', 'draw'] as const;
export type OpensInValue = (typeof OPENS_IN_VALUES)[number];

/** The board types. Mirrors `BOARD_TYPES` of `@livediagram/api-schema` (default folders), which
 *  replaces this list once it exists on main. */
export const BOARD_VALUES = ['event-storming', 'retrospective', 'kanban'] as const;
export type BoardValue = (typeof BOARD_VALUES)[number];

export const MADE_BY_VALUES = ['ai'] as const;
export type MadeByValue = (typeof MADE_BY_VALUES)[number];

export const EDITED_VALUES = ['today', '7d', '30d', 'year'] as const;
export type EditedValue = (typeof EDITED_VALUES)[number];

export const PEOPLE_VALUES = ['me', 'others'] as const;
export type PeopleValue = (typeof PEOPLE_VALUES)[number];

/** The space values that name no team; a team is `team:<id>`. */
export const SPACE_FIXED_VALUES = ['mine', 'shared'] as const;
export const SPACE_TEAM_PREFIX = 'team:';

/** Every dimension whose values are a fixed list, with that list. */
export const FIXED_VALUES = {
  'opens-in': OPENS_IN_VALUES,
  board: BOARD_VALUES,
  'made-by': MADE_BY_VALUES,
  edited: EDITED_VALUES,
  people: PEOPLE_VALUES,
} as const satisfies Record<Exclude<LensDimension, 'space'>, readonly string[]>;

/** The chip label of each dimension; also how messages name it. */
export const DIMENSION_LABELS: Record<LensDimension, string> = {
  'opens-in': 'Opens in',
  board: 'Board',
  'made-by': 'Made by AI',
  edited: 'Edited',
  people: 'People',
  space: 'Space',
};

/** The label of every fixed value. A team's label is its name. */
export const VALUE_LABELS = {
  'opens-in': { diagram: 'Diagram', draw: 'Draw' },
  board: { 'event-storming': 'Event storming', retrospective: 'Retrospective', kanban: 'Kanban' },
  'made-by': { ai: 'Made by AI' },
  edited: { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', year: 'Last 12 months' },
  people: { me: 'Me', others: 'Others' },
  space: { mine: 'My documents', shared: 'Shared with me' },
} as const;

/** A dimension or the free text: what `Explorer / Selected / <type>` names. */
export type LensFacet = 'text' | LensDimension;

/** The closed telemetry type of each facet; never a value, a word or an id. */
export const LENS_TELEMETRY_TYPES = {
  text: 'Text',
  'opens-in': 'OpensIn',
  board: 'Board',
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

/** The URL parameter that carries the lens string. */
export const LENS_QUERY_PARAM = 'q';

export function isLensDimension(value: string): value is LensDimension {
  return LENS_DIMENSIONS.some((dimension) => dimension === value);
}
