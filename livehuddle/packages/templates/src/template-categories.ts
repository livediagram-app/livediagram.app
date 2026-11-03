// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): thirteen,
// grouped by what a person is using the template for (the use case), never by the shape of artefact it is. Every
// template but the blank has exactly one primary category and may be cross-listed in others where people would
// genuinely look for it. Read by Start a Workshop, the marketing gallery and the agents' catalogue. Pure data plus three lookups; a Record over every non-blank kind, so a new template does not
// compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory =
  | 'ideas'
  | 'decisions'
  | 'goals'
  | 'meetings'
  | 'people'
  | 'planning'
  | 'product'
  | 'games'
  | 'retros'
  | 'strategy'
  | 'learning'
  | 'spaces';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place. Descriptions
// are kept to a similar length (40 to 50 characters) so the folded category tiles read as an even set. No id is stored
// anywhere, so ids follow the meaning. Kanban, Finance, Spreadsheets and Forms went with Plan mode to liveplanner.
// `searchWords`: what a search also finds the category's templates by, beyond its label.
type CategoryInfo = {
  id: TemplateCategory;
  label: string;
  description: string;
  searchWords?: string;
};

const CATEGORY_LIST: readonly CategoryInfo[] = [
  {
    id: 'ideas',
    label: 'Brainstorming',
    searchWords: 'brainstorm ideation',
    description: 'Boards for getting ideas out and sorting them.',
  },
  {
    id: 'decisions',
    label: 'Decisions',
    searchWords: 'priorities prioritise prioritize risk',
    description: 'Priorities, trade-offs and the risks ahead.',
  },
  {
    id: 'goals',
    label: 'Goals & Metrics',
    searchWords: 'okr okrs objectives outcomes',
    description: 'Objectives, outcomes and the results to aim at.',
  },
  {
    id: 'meetings',
    label: 'Meetings & Workshops',
    searchWords: 'meeting workshop session facilitation',
    description: 'Agendas, Q&A and formats for running a session.',
  },
  {
    id: 'people',
    label: 'People & Teams',
    searchWords: 'hr roles responsibilities ownership',
    description: 'Roles, responsibilities and stakeholders.',
  },
  {
    id: 'planning',
    label: 'Planning',
    searchWords: 'roadmaps project plan releases',
    description: 'Roadmaps, release slices and who does what.',
  },
  {
    id: 'product',
    label: 'Product & UX',
    searchWords: 'design ux research discovery',
    description: 'Personas, journeys, story maps and discovery.',
  },
  {
    id: 'games',
    label: 'Quizzes & Games',
    searchWords: 'quiz trivia icebreaker icebreakers warm up energiser fun team building',
    description: 'Quizzes, icebreakers and games for the room.',
  },
  {
    id: 'retros',
    label: 'Retrospectives',
    searchWords: 'retro retros look back lessons learned',
    description: 'Look back as a team and agree what to change.',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    searchWords: 'business analysis frameworks',
    description: 'Frameworks for where the business stands and goes.',
  },
  {
    id: 'learning',
    label: 'Teaching & Learning',
    searchWords: 'school classroom students teachers lesson education study',
    description: 'KWL charts and quizzes for the classroom.',
  },
  {
    id: 'spaces',
    label: 'Virtual Spaces',
    searchWords: 'office avatar walk room',
    description: 'Offices and halls to walk round as an avatar.',
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
  // Brainstorming: getting ideas out, then sorting them.
  brainstorm: 'ideas',
  'affinity-map': 'ideas',
  'crazy-eights': 'ideas',
  // Decisions: what comes first and what could go wrong.
  'prioritization-matrix': 'decisions',
  'risk-matrix': 'decisions',
  // Goals and Metrics: what to aim at.
  'objectives-planner': 'goals',
  // Meetings and Workshops: running a session with the room.
  'meeting-agenda': 'meetings',
  'workshop-board': 'meetings',
  'lean-coffee': 'meetings',
  'town-hall': 'meetings',
  // People and Teams: who does what.
  'raci-matrix': 'people',
  // Planning: work laid out in time.
  roadmap: 'planning',
  // Product and UX: research, journeys and discovery.
  journey: 'product',
  'user-persona': 'product',
  'empathy-map': 'product',
  'user-story-map': 'product',
  'opportunity-solution-tree': 'product',
  // Quizzes and Games: the lighter end of running a room.
  'pub-quiz': 'games',
  'icebreaker-questions': 'games',
  'two-truths-and-a-lie': 'games',
  'would-you-rather': 'games',
  'people-bingo': 'games',
  // Retrospectives: a team looking back to change what comes next.
  retrospective: 'retros',
  'start-stop-continue': 'retros',
  'mad-sad-glad': 'retros',
  'four-ls': 'retros',
  sailboat: 'retros',
  'incident-postmortem': 'retros',
  // Strategy: where the business stands and where it goes.
  swot: 'strategy',
  'pestle-analysis': 'strategy',
  'business-model-canvas': 'strategy',
  'value-proposition-canvas': 'strategy',
  'stakeholder-map': 'strategy',
  // Teaching and Learning: a topic taught or studied.
  'kwl-chart': 'learning',
  // Virtual Spaces: the spaces to walk round in Avatar mode (docs/specs/012-collaboration/virtual-office-template.md).
  'virtual-office': 'spaces',
  'coworking-space': 'spaces',
  'team-pod': 'spaces',
  'all-hands-hall': 'spaces',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // Run in a session as much as they are ways to get ideas out.
  brainstorm: ['meetings'],
  'crazy-eights': ['meetings', 'product'],
  // Research synthesis is product work too.
  'affinity-map': ['product'],
  // An all-hands is a meeting.
  'all-hands-hall': ['meetings'],
  // Planned work: who does what, and the release slices.
  'raci-matrix': ['planning'],
  'user-story-map': ['planning'],
  // A roadmap is strategy in time.
  roadmap: ['strategy'],
  // Discovery is aimed at an outcome.
  'opportunity-solution-tree': ['goals'],
  // A value proposition is product design.
  'value-proposition-canvas': ['product'],
  // Stakeholders are people.
  'stakeholder-map': ['people'],
  // A quiz is how a class checks what it learned.
  'pub-quiz': ['learning'],
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
