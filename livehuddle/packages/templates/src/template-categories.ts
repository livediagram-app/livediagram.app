// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): the kind of
// place a Space is, Campus, Events, Games Rooms, Homes, Office, Outdoor, Recreation and Venues, each holding two to seven
// of the twenty-six Spaces
// (docs/specs/007-editor/templates-by-mode.md "The catalogue"). Every template but the blank has exactly one primary category and may be cross-listed in others where
// people would genuinely look for it. Read by Start a Space, the marketing gallery and the agents' catalogue. Pure
// data plus three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

// The Meetings & Workshops, Retrospectives, Brainstorming, Decisions, Goals & Metrics, People & Teams, Planning,
// Product & UX, Quizzes & Games, Strategy and Teaching & Learning categories left with their templates
// (docs/specs/002-project-scope/not-in-livehuddle.md). The one Virtual Spaces category the first four Spaces shared
// split into four, Campus (whole sites joined by gardens) came after, and Games Rooms, Homes and Venues (Work Tracker
// #641) after that, Venues taking the Conference Venue and the Hotel and Suites from Campus.
export type TemplateCategory =
  'campus' | 'office' | 'events' | 'outdoor' | 'recreation' | 'games' | 'homes' | 'venues';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place. Descriptions
// are kept to a similar length (40 to 50 characters) so the folded category tiles read as an even set. No id is stored
// anywhere, so ids follow the meaning.
// `searchWords`: what a search also finds the category's templates by, beyond its label.
type CategoryInfo = {
  id: TemplateCategory;
  label: string;
  description: string;
  searchWords?: string;
};

const CATEGORY_LIST: readonly CategoryInfo[] = [
  {
    id: 'campus',
    label: 'Campus',
    searchWords: 'campus site whole building buildings combined grounds avatar walk room',
    description: 'Whole sites: offices, halls and bars in a garden.',
  },
  {
    id: 'office',
    label: 'Office',
    searchWords: 'office work desk desks avatar walk room',
    description: 'Desks, pods and meeting rooms for the workday.',
  },
  {
    id: 'events',
    label: 'Events',
    searchWords: 'event events stage talk demo hall avatar walk room',
    description: 'Halls and rooms for talks, demos and training.',
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    searchWords: 'outdoors outside garden park nature avatar walk',
    description: 'Gardens and parks to meet in under an open sky.',
  },
  {
    id: 'recreation',
    label: 'Recreation',
    searchWords: 'social fun drinks bar cafe lounge avatar walk',
    description: 'Bars and cafes to unwind in together after work.',
  },
  {
    id: 'games',
    label: 'Games Rooms',
    searchWords: 'game games play arcade gaming fun ping pong pool darts foosball avatar walk room',
    description: 'Arcades, dens and bars for playing games together.',
  },
  {
    id: 'homes',
    label: 'Homes',
    searchWords: 'home house houses stairs upstairs downstairs floors family avatar walk room',
    description: 'Houses to meet in, with Stairs between the floors.',
  },
  {
    id: 'venues',
    label: 'Venues',
    searchWords: 'venue venues gig concert host hotel event events stage avatar walk room',
    description: 'Halls, hotels and stages to host a big day at.',
  },
];

// The categories in the order every picker shows them (every start, /new and the marketing gallery): alphabetical
// by label, locale-aware, derived rather than hand-ordered (docs/specs/008-canvas/canvas-and-palette.md "Template
// categories"). Popular is no category: it stays a shelf above them.
// Its search words stay inside the package (templateCategorySearchWords): the list is what every picker and the
// agents' catalogue (list_templates, a fixed output schema) read, so it carries only id, label and description.
export const TEMPLATE_CATEGORIES: readonly Omit<CategoryInfo, 'searchWords'>[] = [...CATEGORY_LIST]
  .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
  .map(({ id, label, description }) => ({ id, label, description }));

// Every template but the blank's primary category: the job it is for. Blank Space is in none, reached from
// Popular or by search (docs/specs/007-editor/templates-by-mode.md "The blank"); isBlankTemplate names it.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, 'blank-session'>, TemplateCategory> = {
  // Every one a Space to walk round in Avatar mode (docs/specs/012-collaboration/virtual-office-template.md).
  'virtual-office': 'office',
  'coworking-space': 'office',
  'team-pod': 'office',
  'focus-library': 'office',
  'all-hands-hall': 'events',
  'training-room': 'events',
  'rooftop-bar': 'recreation',
  cafe: 'recreation',
  'garden-retreat': 'outdoor',
  'city-park': 'outdoor',
  'company-campus': 'campus',
  'conference-venue': 'venues',
  'startup-hq': 'campus',
  'school-quad': 'campus',
  'hotel-and-suites': 'venues',
  'coworking-tower': 'campus',
  'expo-hall': 'events',
  'beach-offsite': 'outdoor',
  'arcade-lounge': 'games',
  'games-night-den': 'games',
  'sports-bar': 'games',
  'family-house': 'homes',
  'city-townhouse': 'homes',
  'country-cottage': 'homes',
  'music-hall': 'venues',
  'festival-field': 'venues',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // A beach offsite is a whole site for a team's day away, so it is looked for among the Campus sites too.
  'beach-offsite': ['campus'],
  // A sports bar is a bar to unwind in after work as much as a place to play.
  'sports-bar': ['recreation'],
  // An expo is a show a venue hosts.
  'expo-hall': ['venues'],
  // A festival is held in a field under an open sky, so it is looked for among the Outdoor Spaces too.
  'festival-field': ['outdoor'],
};

/** A template's primary category; null for the blank, which is in none. */
export function templateCategory(kind: TemplateKind): TemplateCategory | null {
  return (TEMPLATE_CATEGORY as Partial<Record<TemplateKind, TemplateCategory>>)[kind] ?? null;
}

/** Every category a template is shown in: its primary, then its cross-listings. Empty for a blank. */
export function templateCategories(kind: TemplateKind): readonly TemplateCategory[] {
  const primary = templateCategory(kind);
  return primary ? [primary, ...(TEMPLATE_ALSO_IN[kind] ?? [])] : [];
}

/** True when the template is shown in the category, as its primary or cross-listed. */
export function isInTemplateCategory(kind: TemplateKind, category: TemplateCategory): boolean {
  return templateCategories(kind).includes(category);
}

const LABELS: ReadonlyMap<TemplateCategory, string> = new Map(
  TEMPLATE_CATEGORIES.map((c) => [c.id, c.label]),
);

/** A category's label. */
export function templateCategoryLabel(category: TemplateCategory): string {
  return LABELS.get(category) ?? category;
}

const SEARCH_WORDS: ReadonlyMap<TemplateCategory, string> = new Map(
  CATEGORY_LIST.map((c) => [c.id, c.searchWords ?? '']),
);

/** The words a search also finds a category's templates by, beyond its label. */
export function templateCategorySearchWords(category: TemplateCategory): string {
  return SEARCH_WORDS.get(category) ?? '';
}
