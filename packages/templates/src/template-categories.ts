// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): thirteen,
// grouped by the job a person is getting done rather than the artefact a template is. Every template but the five
// blanks has exactly one primary category and may be cross-listed in others where people would genuinely look for it.
// Read by the template step (Quick Start and /new), the marketing gallery and the agents' catalogue. Pure data plus
// three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory =
  | 'planning'
  | 'finance'
  | 'spreadsheets'
  | 'forms'
  | 'meetings'
  | 'mindmaps'
  | 'timelines'
  | 'flowcharts'
  | 'strategy'
  | 'hierarchies'
  | 'design'
  | 'presentations'
  | 'technical'
  | 'games';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place. Descriptions are kept to a similar length (40 to 50 characters) so the folded
// category tiles read as an even set. Ids survive where the meaning did (links, tests and the agents' catalogue name
// them): `planning` was Agile, `mindmaps` was Mind maps, `hierarchies` was Hierarchies.
// `searchWords`: what a search also finds the category's templates by, the words a longer label once carried (Flowcharts
// was Flowcharts and Processes), so shortening a label never loses a search.
type CategoryInfo = {
  id: TemplateCategory;
  label: string;
  description: string;
  searchWords?: string;
};

const CATEGORY_LIST: readonly CategoryInfo[] = [
  {
    id: 'planning',
    label: 'Planning',
    searchWords: 'plan track',
    description: 'Boards and trackers for projects and teams.',
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Budgets, invoices, loans and sales forecasts.',
  },
  {
    id: 'spreadsheets',
    label: 'Spreadsheets',
    description: 'Ready-made sheets with formulas and charts.',
  },
  {
    id: 'forms',
    label: 'Forms',
    searchWords: 'survey questionnaire',
    description: 'Forms to share by link, answers kept for you.',
  },
  {
    id: 'meetings',
    label: 'Workshops',
    searchWords: 'meetings',
    description: 'Agendas, retros, Q&A and workshop formats.',
  },
  {
    id: 'mindmaps',
    label: 'Brainstorm',
    description: 'Mind maps and sketches for getting ideas out.',
  },
  {
    id: 'timelines',
    label: 'Timelines',
    searchWords: 'roadmaps',
    description: 'Timelines, Gantt charts, roadmaps and goals.',
  },
  {
    id: 'flowcharts',
    label: 'Flowcharts',
    searchWords: 'processes',
    description: 'Step-by-step processes, flows and decisions.',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    searchWords: 'decisions',
    description: 'Frameworks for analysis, priorities and risk.',
  },
  {
    id: 'hierarchies',
    label: 'Org Charts',
    searchWords: 'org structure hierarchies',
    description: 'Org charts, goal trees, sitemaps and pyramids.',
  },
  {
    id: 'design',
    label: 'Design',
    searchWords: 'ux',
    description: 'Prototypes, personas, journeys and story maps.',
  },
  {
    id: 'presentations',
    label: 'Presentations',
    searchWords: 'content',
    description: 'Comic strips and stories made to be shared.',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Architecture, schema and sequence diagrams.',
  },
  {
    id: 'games',
    label: 'Quizzes & Games',
    searchWords: 'quiz trivia icebreaker icebreakers warm up energiser fun team building',
    description: 'Quizzes, icebreakers and games for the room.',
  },
];

// The categories in the order every picker shows them (the Quick Start, /new and the marketing gallery): alphabetical
// by label, locale-aware, derived rather than hand-ordered (docs/specs/008-canvas/canvas-and-palette.md "Template
// categories"). Popular is no category: it stays a shelf above them.
// Its search words stay inside the package (templateCategorySearchWords): the list is what every picker and the
// agents' catalogue (list_templates, a fixed output schema) read, so it carries only id, label and description.
export const TEMPLATE_CATEGORIES: readonly Omit<CategoryInfo, 'searchWords'>[] = [...CATEGORY_LIST]
  .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
  .map(({ id, label, description }) => ({ id, label, description }));

// The blanks: in no category, reached from Popular or by search (docs/specs/007-editor/templates-by-mode.md "The blanks").
// Mirrors isBlankTemplate (BLANK_TEMPLATE_FOR_MODE and EXTRA_BLANK_TEMPLATES); the categories test pins them together.
type BlankKind =
  'blank' | 'whiteboard' | 'blank-plan' | 'blank-spreadsheet' | 'blank-session' | 'blank-form';

// Every non-blank template's primary category.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, BlankKind>, TemplateCategory> = {
  // Plan and Track: the Plan boards that run real work.
  'project-planner': 'planning',
  kanban: 'planning',
  'task-tracker': 'planning',
  'bug-triage': 'planning',
  'weekly-planner': 'planning',
  'content-calendar': 'planning',
  'product-launch': 'planning',
  'hiring-pipeline': 'planning',
  okrs: 'planning',
  // Finance: a topic across modes, money in and out.
  'budget-planner': 'finance',
  timesheet: 'finance',
  invoice: 'finance',
  'expense-report': 'finance',
  'loan-calculator': 'finance',
  'sales-pipeline': 'finance',
  // Spreadsheets: the ready-made sheets that are not about money.
  'contact-list': 'spreadsheets',
  inventory: 'spreadsheets',
  'guest-list': 'spreadsheets',
  'grade-book': 'spreadsheets',
  'habit-tracker': 'spreadsheets',
  // Forms (form-templates.ts).
  'bug-report-form': 'forms',
  'feedback-form': 'forms',
  'feature-request-form': 'forms',
  'rsvp-form': 'forms',
  'job-application-form': 'forms',
  'contact-form': 'forms',
  // Meetings and Workshops: agendas, retros, live Q&A and the boards a team runs together.
  'meeting-agenda': 'meetings',
  'lean-coffee': 'meetings',
  brainstorm: 'meetings',
  'workshop-board': 'meetings',
  'town-hall': 'meetings',
  retrospective: 'meetings',
  'start-stop-continue': 'meetings',
  'mad-sad-glad': 'meetings',
  'four-ls': 'meetings',
  sailboat: 'meetings',
  'team-retro': 'meetings',
  'pre-mortem': 'meetings',
  'feedback-board': 'meetings',
  // The spaces to walk round in Avatar mode (docs/specs/012-collaboration/virtual-office-template.md).
  'virtual-office': 'meetings',
  'coworking-space': 'meetings',
  'team-pod': 'meetings',
  'all-hands-hall': 'meetings',
  // Brainstorm: getting ideas out of heads.
  mindmap: 'mindmaps',
  'mindmap-tree': 'mindmaps',
  'mindmap-bubble': 'mindmaps',
  sketchnote: 'mindmaps',
  'idea-garden': 'mindmaps',
  'affinity-map': 'mindmaps',
  'crazy-eights': 'mindmaps',
  'doodle-warmup': 'mindmaps',
  // Timelines and Roadmaps: work laid out in time, and who owns it.
  timeline: 'timelines',
  'milestone-timeline': 'timelines',
  'milestone-timeline-vertical': 'timelines',
  gantt: 'timelines',
  roadmap: 'timelines',
  'objectives-planner': 'timelines',
  'raci-matrix': 'timelines',
  // Flowcharts and Processes.
  flowchart: 'flowcharts',
  swimlane: 'flowcharts',
  'decision-tree': 'flowcharts',
  'approval-workflow': 'flowcharts',
  'data-flow': 'flowcharts',
  // Strategy and Decisions: analysis frameworks, priorities and risk.
  swot: 'strategy',
  'business-model-canvas': 'strategy',
  'prioritization-matrix': 'strategy',
  'risk-matrix': 'strategy',
  fishbone: 'strategy',
  venn: 'strategy',
  flywheel: 'strategy',
  funnel: 'strategy',
  sankey: 'strategy',
  'comparison-table': 'strategy',
  'stakeholder-map': 'strategy',
  'rich-picture': 'strategy',
  'wardley-map': 'strategy',
  'value-proposition-canvas': 'strategy',
  // Org and Structure: top-down structure.
  orgchart: 'hierarchies',
  pyramid: 'hierarchies',
  'okr-tree': 'hierarchies',
  sitemap: 'hierarchies',
  'opportunity-solution-tree': 'hierarchies',
  'metric-tree': 'hierarchies',
  'family-tree': 'hierarchies',
  // Design and UX: screens, research and the spaces people move through.
  'paper-prototype': 'design',
  journey: 'design',
  'journey-doodle': 'design',
  'user-persona': 'design',
  'empathy-map': 'design',
  'user-story-map': 'design',
  'service-blueprint': 'design',
  // Presentations and Content: made to be read or shared.
  'comic-strip': 'presentations',
  // Technical: developer diagrams.
  'system-architecture': 'technical',
  'cloud-architecture': 'technical',
  'er-diagram': 'technical',
  'sequence-diagram': 'technical',
  'uml-class': 'technical',
  'state-machine': 'technical',
  'event-storming': 'technical',
  'incident-postmortem': 'technical',
  'threat-model': 'technical',
  'value-stream-map': 'technical',
  // Quizzes and Games: the lighter end of running a room.
  'pub-quiz': 'games',
  'icebreaker-questions': 'games',
  'two-truths-and-a-lie': 'games',
  'would-you-rather': 'games',
  'people-bingo': 'games',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // Run as a meeting, tracked as a board.
  'team-retro': ['planning'],
  'feedback-board': ['planning'],
  // Goals are strategy as much as tracking.
  okrs: ['strategy'],
  'okr-tree': ['strategy'],
  roadmap: ['strategy'],
  'pre-mortem': ['strategy'],
  // A sheet is a spreadsheet whatever it is for.
  'task-tracker': ['spreadsheets'],
  'budget-planner': ['spreadsheets'],
  timesheet: ['spreadsheets'],
  invoice: ['spreadsheets'],
  'expense-report': ['spreadsheets'],
  'loan-calculator': ['spreadsheets'],
  'sales-pipeline': ['spreadsheets'],
  // About money, though drawn as diagrams.
  funnel: ['finance'],
  sankey: ['finance'],
  'business-model-canvas': ['finance'],
  // Diagrams a team plans its work with.
  gantt: ['planning'],
  'user-story-map': ['planning'],
  'prioritization-matrix': ['planning'],
  // Workshop formats.
  'crazy-eights': ['meetings', 'design'],
  'doodle-warmup': ['meetings', 'games'],
  'event-storming': ['meetings'],
  'incident-postmortem': ['meetings'],
  // Research synthesis and site structure are design work too.
  'affinity-map': ['design'],
  sitemap: ['design'],
  // Who does what is structure.
  'raci-matrix': ['hierarchies'],
  // A data-flow diagram is a developer's diagram.
  'data-flow': ['technical'],
  // A north star is a goal, like the OKR tree's.
  'metric-tree': ['strategy'],
  // A blueprint and a value stream are processes across lanes and steps.
  'service-blueprint': ['flowcharts'],
  'value-stream-map': ['flowcharts'],
  // A value proposition is product design.
  'value-proposition-canvas': ['design'],
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
