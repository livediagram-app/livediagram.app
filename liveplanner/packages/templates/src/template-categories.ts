// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): eleven of
// liveplanner's own, grouped by what the work is for (the use case) rather than the artefact a template is, so a
// board, a Sheet and a form for the same job sit together. Every template but the four blanks has exactly one primary
// category and may be cross-listed in others where people would genuinely look for it.
// Read by the marketing gallery, template search and the agents' catalogue. Pure data plus a few lookups; a Record
// over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory =
  | 'support'
  | 'education'
  | 'events'
  | 'finance'
  | 'hiring'
  | 'marketing'
  | 'meetings'
  | 'personal'
  | 'product'
  | 'planning'
  | 'sales';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place. Descriptions
// are kept to a similar length (40 to 50 characters) so the folded category tiles read as an even set. Ids survive
// where the meaning did (links, tests and the agents' catalogue name them): `planning` was Planning, now Projects and
// Teams; `finance` and `meetings` kept theirs.
// `searchWords`: what a search also finds the category's templates by, beyond its label: other names for the job
// ("crm", "helpdesk", "school").
type CategoryInfo = {
  id: TemplateCategory;
  label: string;
  description: string;
  searchWords?: string;
};

const CATEGORY_LIST: readonly CategoryInfo[] = [
  {
    id: 'support',
    label: 'Customer Support',
    searchWords: 'helpdesk service customers',
    description: 'Tickets, contact forms and what customers say.',
  },
  {
    id: 'education',
    label: 'Education',
    searchWords: 'school study students teachers class',
    description: 'Study plans, coursework and a class grade book.',
  },
  {
    id: 'events',
    label: 'Events',
    searchWords: 'party wedding conference occasion',
    description: 'Plans, guest lists and RSVPs for any occasion.',
  },
  {
    id: 'finance',
    label: 'Finance',
    searchWords: 'money accounts',
    description: 'Budgets, invoices, expenses, loans and stock.',
  },
  {
    id: 'hiring',
    label: 'Hiring and People',
    searchWords: 'hr recruiting',
    description: 'Open roles, candidates and their first month.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    searchWords: 'campaigns content',
    description: 'Content and launches, planned to the day.',
  },
  {
    id: 'meetings',
    label: 'Meetings',
    searchWords: 'workshops retros',
    description: 'Agendas, retros and the actions they lead to.',
  },
  {
    id: 'personal',
    label: 'Personal',
    searchWords: 'life home self',
    description: 'Your week, goals, habits and household money.',
  },
  {
    id: 'product',
    label: 'Product and Engineering',
    searchWords: 'software development agile',
    description: 'Sprints, bugs and feedback for product teams.',
  },
  {
    id: 'planning',
    label: 'Projects and Teams',
    searchWords: 'plan track project management',
    description: 'Boards, trackers and goals that keep teams moving.',
  },
  {
    id: 'sales',
    label: 'Sales',
    searchWords: 'crm selling revenue',
    description: 'Deals, contacts and the forecast they add up to.',
  },
];

// The categories in the order every picker shows them (the marketing gallery, the agents' catalogue): alphabetical
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

// Every non-blank template's primary category: the job it is for. A form sits with the job its answers feed, a sheet
// with the job it does.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, BlankKind>, TemplateCategory> = {
  // Customer Support.
  'help-desk': 'support',
  'contact-form': 'support',
  'feedback-form': 'support',
  // Education.
  'study-planner': 'education',
  'grade-book': 'education',
  // Events.
  'event-planner': 'events',
  'guest-list': 'events',
  'rsvp-form': 'events',
  // Finance: money in and out, and the stock it is tied up in.
  'budget-planner': 'finance',
  timesheet: 'finance',
  invoice: 'finance',
  'expense-report': 'finance',
  'loan-calculator': 'finance',
  inventory: 'finance',
  // Hiring and People.
  'hiring-pipeline': 'hiring',
  'job-application-form': 'hiring',
  // Marketing.
  'content-calendar': 'marketing',
  'product-launch': 'marketing',
  // Meetings: the sessions a team runs together.
  'team-retro': 'meetings',
  'meeting-agenda': 'meetings',
  // Personal.
  'weekly-planner': 'personal',
  'habit-tracker': 'personal',
  'personal-goals': 'personal',
  // Product and Engineering.
  'project-planner': 'product',
  'bug-triage': 'product',
  'feedback-board': 'product',
  'bug-report-form': 'product',
  'feature-request-form': 'product',
  // Projects and Teams: running any team's work.
  kanban: 'planning',
  'task-tracker': 'planning',
  okrs: 'planning',
  // Sales.
  'sales-crm': 'sales',
  'sales-pipeline': 'sales',
  'contact-list': 'sales',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // Any team plans its projects and runs retros and meetings, not only product teams.
  'project-planner': ['planning'],
  'team-retro': ['planning'],
  'meeting-agenda': ['planning'],
  'weekly-planner': ['planning'],
  // Software teams run on a Kanban and launch what they build.
  kanban: ['product'],
  'product-launch': ['product'],
  // What customers ask for and report reaches support first.
  'feedback-board': ['support'],
  'bug-report-form': ['support'],
  'feature-request-form': ['support'],
  // A forecast is money too.
  'sales-pipeline': ['finance'],
  // A household's money and a to-do list are personal planning too.
  'budget-planner': ['personal'],
  'loan-calculator': ['personal'],
  'task-tracker': ['personal'],
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
