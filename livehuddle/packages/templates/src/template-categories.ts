// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): fourteen,
// grouped by what a person is using the template for (the use case), never by the shape of artefact it is. Every
// template but the three blanks has exactly one primary category and may be cross-listed in others where people would
// genuinely look for it. Read by every template start (Diagram, Draw and Workshop), the marketing gallery and the
// agents' catalogue. Pure data plus three lookups; a Record over every non-blank kind, so a new template does not
// compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory =
  | 'ideas'
  | 'decisions'
  | 'goals'
  | 'meetings'
  | 'people'
  | 'planning'
  | 'processes'
  | 'product'
  | 'games'
  | 'retros'
  | 'software'
  | 'strategy'
  | 'learning'
  | 'spaces';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place. Descriptions
// are kept to a similar length (40 to 50 characters) so the folded category tiles read as an even set. No id is stored
// anywhere, so ids follow the meaning. Kanban, Finance, Spreadsheets and Forms went with Plan mode to liveplanner.
// `searchWords`: what a search also finds the category's templates by, beyond its label: the words the old,
// artefact-shaped labels carried (Flowcharts, Org Charts, Technical), so the regroup never loses a search.
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
    searchWords: 'brainstorm ideation mind maps',
    description: 'Mind maps and boards for getting ideas out.',
  },
  {
    id: 'decisions',
    label: 'Decisions',
    searchWords: 'priorities prioritise prioritize risk',
    description: 'Priorities, trade-offs, risks and root causes.',
  },
  {
    id: 'goals',
    label: 'Goals & Metrics',
    searchWords: 'okrs kpis growth',
    description: 'OKRs, metric trees, funnels and growth loops.',
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
    searchWords: 'org chart hr hiring onboarding structure hierarchies',
    description: 'Org charts, roles, onboarding and family trees.',
  },
  {
    id: 'planning',
    label: 'Planning',
    searchWords: 'timelines roadmaps project schedule',
    description: 'Gantt charts, roadmaps and timelines of work.',
  },
  {
    id: 'processes',
    label: 'Processes & Workflows',
    searchWords: 'flowcharts flowchart process',
    description: 'Flowcharts and workflows for how work gets done.',
  },
  {
    id: 'product',
    label: 'Product & UX',
    searchWords: 'design ux research discovery',
    description: 'Prototypes, personas, journeys and discovery.',
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
    id: 'software',
    label: 'Software & IT',
    searchWords: 'technical engineering developer devops infrastructure',
    description: 'Architecture, data, networks and incidents.',
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
    description: 'Concept maps, KWL charts and visual notes.',
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

// The blanks: in no category, reached from Popular or by search (docs/specs/007-editor/templates-by-mode.md "The blanks").
// Mirrors isBlankTemplate (BLANK_TEMPLATE_FOR_MODE); the categories test pins them together.
type BlankKind = 'blank' | 'whiteboard' | 'blank-session';

// Every non-blank template's primary category: the job it is for.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, BlankKind>, TemplateCategory> = {
  // Brainstorming: getting ideas out of heads and into some order.
  mindmap: 'ideas',
  'mindmap-tree': 'ideas',
  'mindmap-bubble': 'ideas',
  brainstorm: 'ideas',
  'idea-garden': 'ideas',
  'affinity-map': 'ideas',
  'crazy-eights': 'ideas',
  // Decisions: what comes first, which option, what could go wrong and why it went wrong.
  'prioritization-matrix': 'decisions',
  'eisenhower-matrix': 'decisions',
  'decision-tree': 'decisions',
  'comparison-table': 'decisions',
  'risk-matrix': 'decisions',
  'pre-mortem': 'decisions',
  fishbone: 'decisions',
  // Goals and Metrics: what to aim at, and the numbers that say how it is going.
  'okr-tree': 'goals',
  'objectives-planner': 'goals',
  'metric-tree': 'goals',
  funnel: 'goals',
  flywheel: 'goals',
  sankey: 'goals',
  // Meetings and Workshops: running a session with the room.
  'meeting-agenda': 'meetings',
  'workshop-board': 'meetings',
  'lean-coffee': 'meetings',
  'town-hall': 'meetings',
  // People and Teams: who is who, who does what, and a new starter's first months.
  orgchart: 'people',
  'raci-matrix': 'people',
  'onboarding-plan': 'people',
  'family-tree': 'people',
  // Planning: work laid out in time.
  gantt: 'planning',
  roadmap: 'planning',
  timeline: 'planning',
  'milestone-timeline': 'planning',
  'milestone-timeline-vertical': 'planning',
  // Processes and Workflows: how work gets done, step by step.
  flowchart: 'processes',
  swimlane: 'processes',
  'approval-workflow': 'processes',
  'value-stream-map': 'processes',
  // Product and UX: screens, research, journeys and discovery.
  'paper-prototype': 'product',
  journey: 'product',
  'journey-doodle': 'product',
  'user-persona': 'product',
  'empathy-map': 'product',
  'user-story-map': 'product',
  'service-blueprint': 'product',
  sitemap: 'product',
  'opportunity-solution-tree': 'product',
  // A comic strip tells a user's story in panels, as a storyboard does.
  'comic-strip': 'product',
  // The design-thinking lenses: is this idea worth building?
  venn: 'product',
  // Quizzes and Games: the lighter end of running a room.
  'pub-quiz': 'games',
  'icebreaker-questions': 'games',
  'two-truths-and-a-lie': 'games',
  'would-you-rather': 'games',
  'people-bingo': 'games',
  'doodle-warmup': 'games',
  // Retrospectives: a team looking back to change what comes next.
  retrospective: 'retros',
  'start-stop-continue': 'retros',
  'mad-sad-glad': 'retros',
  'four-ls': 'retros',
  sailboat: 'retros',
  // Software and IT: the developer's and the IT team's diagrams.
  'system-architecture': 'software',
  'cloud-architecture': 'software',
  'network-diagram': 'software',
  'er-diagram': 'software',
  'sequence-diagram': 'software',
  'uml-class': 'software',
  'state-machine': 'software',
  'data-flow': 'software',
  'event-storming': 'software',
  'threat-model': 'software',
  'incident-postmortem': 'software',
  // Strategy: where the business stands and where it goes.
  swot: 'strategy',
  'pestle-analysis': 'strategy',
  'business-model-canvas': 'strategy',
  'value-proposition-canvas': 'strategy',
  'wardley-map': 'strategy',
  'rich-picture': 'strategy',
  'stakeholder-map': 'strategy',
  pyramid: 'strategy',
  // Teaching and Learning: a topic taught, studied or taken notes on.
  'concept-map': 'learning',
  'kwl-chart': 'learning',
  sketchnote: 'learning',
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
  // A concept map is a map of ideas, as a mind map is.
  'concept-map': ['ideas'],
  // Visual notes are taken in meetings and talks.
  sketchnote: ['meetings'],
  // Event storming is a workshop, and maps a business process.
  'event-storming': ['meetings', 'processes'],
  // An all-hands is a meeting.
  'all-hands-hall': ['meetings'],
  // Looking back at an incident, or forward at a failure, is a retro's job.
  'incident-postmortem': ['retros'],
  'pre-mortem': ['retros', 'strategy'],
  // Flows of a process, drawn as a tree, a DFD or a blueprint.
  'decision-tree': ['processes'],
  'data-flow': ['processes'],
  'service-blueprint': ['processes'],
  // Planned work: who does what, the release slices, a new starter's months, a week sorted.
  'raci-matrix': ['planning'],
  'user-story-map': ['planning'],
  'onboarding-plan': ['planning'],
  'eisenhower-matrix': ['planning'],
  // Goals and a growth loop are strategy as much as tracking; a roadmap is strategy in time.
  roadmap: ['strategy'],
  'okr-tree': ['strategy'],
  flywheel: ['strategy'],
  // Discovery is aimed at an outcome.
  'opportunity-solution-tree': ['goals'],
  // A value proposition is product design.
  'value-proposition-canvas': ['product'],
  // Stakeholders are people.
  'stakeholder-map': ['people'],
  // Weighing an idea through three lenses is a decision, and the Venn is taught in class.
  venn: ['decisions', 'learning'],
  // What a class uses: mind maps, timelines, family trees and a quiz.
  mindmap: ['learning'],
  'mindmap-bubble': ['learning'],
  timeline: ['learning'],
  'family-tree': ['learning'],
  'pub-quiz': ['learning'],
};

/** A template's primary category; null for the blanks, which are in none. */
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
