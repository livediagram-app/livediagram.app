// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): five,
// grouped by the job a person is getting done rather than the artefact a template is. Every template but the four
// blanks has exactly one primary category and may be cross-listed in others where people would genuinely look for it.
// Read by the template step (Quick Start and /new), the marketing gallery and the agents' catalogue. Pure data plus
// three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory = 'planning' | 'finance' | 'spreadsheets' | 'forms' | 'meetings';

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
    label: 'Meetings',
    searchWords: 'workshops retros',
    description: 'Retros and feedback boards a team runs together.',
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

// The blanks: in no category, reached from Popular or by search (docs/specs/026-plan/plan-templates.md "The blanks").
// Mirrors isBlankTemplate (BLANK_TEMPLATES); the categories test pins them together.
type BlankKind = 'blank' | 'blank-plan' | 'blank-spreadsheet' | 'blank-form';

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
  // Meetings: the boards a team runs together.
  'team-retro': 'meetings',
  'feedback-board': 'meetings',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // Run as a meeting, tracked as a board.
  'team-retro': ['planning'],
  'feedback-board': ['planning'],
  // A sheet is a spreadsheet whatever it is for.
  'task-tracker': ['spreadsheets'],
  'budget-planner': ['spreadsheets'],
  timesheet: ['spreadsheets'],
  invoice: ['spreadsheets'],
  'expense-report': ['spreadsheets'],
  'loan-calculator': ['spreadsheets'],
  'sales-pipeline': ['spreadsheets'],
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
