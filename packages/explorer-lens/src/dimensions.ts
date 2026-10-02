// The lens's catalogue (docs/specs/013-workspace/explorer-filters.md "Dimensions"): every
// dimension, its closed values, their British English labels and the closed telemetry types.

import type { TabKind } from '@livediagram/document';

/** The dimensions in canonical order: the order tokens are written in and chips are shown in. */
export const LENS_DIMENSIONS = [
  'opens-in',
  'kind',
  'template',
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

/** The specific tab kinds: every creatable tab kind but the general diagram tab. Mirrors
 *  `SPECIFIC_TAB_KINDS` of `@livediagram/api-schema` (default folders), which replaces it once on
 *  main. */
export const KIND_VALUES = ['event-storming'] as const satisfies readonly TabKind[];
export type KindValue = (typeof KIND_VALUES)[number];

/** The template families: ordinary diagram tabs made from a family of templates. Mirrors
 *  `TEMPLATE_FAMILIES` of `@livediagram/api-schema` (default folders), which replaces it once on
 *  main. */
export const TEMPLATE_VALUES = ['retrospective', 'kanban'] as const;
export type TemplateValue = (typeof TEMPLATE_VALUES)[number];

export const MADE_BY_VALUES = ['ai'] as const;
export type MadeByValue = (typeof MADE_BY_VALUES)[number];

export const EDITED_VALUES = ['today', '7d', '30d', '12m', 'this-year'] as const;
export type EditedValue = (typeof EDITED_VALUES)[number];

export const PEOPLE_VALUES = ['me', 'others'] as const;
export type PeopleValue = (typeof PEOPLE_VALUES)[number];

/** The space values that name no team; a team is `team:<id>`. */
export const SPACE_FIXED_VALUES = ['mine', 'shared'] as const;
export const SPACE_TEAM_PREFIX = 'team:';

/** Every dimension whose values are a fixed list, with that list. */
export const FIXED_VALUES = {
  'opens-in': OPENS_IN_VALUES,
  kind: KIND_VALUES,
  template: TEMPLATE_VALUES,
  'made-by': MADE_BY_VALUES,
  edited: EDITED_VALUES,
  people: PEOPLE_VALUES,
} as const satisfies Record<Exclude<LensDimension, 'space'>, readonly string[]>;

/** The chip label of each dimension; also how messages name it. */
export const DIMENSION_LABELS: Record<LensDimension, string> = {
  'opens-in': 'Opens in',
  kind: 'Kind',
  template: 'Template',
  'made-by': 'Made by AI',
  edited: 'Edited',
  people: 'People',
  space: 'Space',
};

/** The label of every fixed value. A team's label is its name. */
export const VALUE_LABELS = {
  'opens-in': { diagram: 'Diagram', draw: 'Draw' },
  kind: { 'event-storming': 'Event Storming' },
  template: { retrospective: 'Retrospective', kanban: 'Kanban' },
  'made-by': { ai: 'Made by AI' },
  edited: {
    today: 'Today',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '12m': 'Last 12 months',
    'this-year': 'This year',
  },
  people: { me: 'Me', others: 'Others' },
  space: { mine: 'My documents', shared: 'Shared with me' },
} as const;

/** A dimension or the free text: what `Explorer / Selected / <Facet>` names. */
export type LensFacet = 'text' | LensDimension;

/** The closed telemetry type of each facet; never a value, a word or an id. */
export const LENS_TELEMETRY_TYPES = {
  text: 'Text',
  'opens-in': 'OpensIn',
  kind: 'Kind',
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
  return LENS_DIMENSIONS.some((dimension) => dimension === value);
}
