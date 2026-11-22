// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): the five a
// knowledgebase's pages are filed under, grouped by what the page is for (the use case). Every template but the blanks
// has exactly one primary category and may
// be cross-listed in others where people would genuinely look for it.
// Read by the template step (Quick Start and /new), the marketing gallery and the agents' catalogue. Pure data plus
// three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory = 'engineering' | 'handbooks' | 'onboarding' | 'product' | 'support';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place.
// The ids, labels and descriptions are the Community's categories for liveknowledge.app (packages/community
// `categories.ts`; `community-categories.test.ts` pins the two together), so Start With can show the Community's
// best beside its own templates. Labels are a word each, so a picker's rail fits each on one line.
// `searchWords`: what a search also finds the category's templates by, beyond its label.
type CategoryInfo = {
  id: TemplateCategory;
  label: string;
  description: string;
  searchWords?: string;
};

const CATEGORY_LIST: readonly CategoryInfo[] = [
  {
    id: 'engineering',
    label: 'Engineering',
    searchWords: 'runbook architecture code technical spec',
    description: 'Runbooks, architecture notes and how the code works.',
  },
  {
    id: 'handbooks',
    label: 'Handbooks',
    searchWords: 'team policy policies values habits',
    description: 'How a team works: its policies, habits and values.',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    searchWords: 'welcome joining starter induction',
    description: 'First weeks: what to read, set up and who to meet.',
  },
  {
    id: 'product',
    label: 'Product',
    searchWords: 'plans proposals plan planning proposal project decisions',
    description: 'Specs, decisions and research behind a product.',
  },
  {
    id: 'support',
    label: 'Support',
    searchWords: 'customers customer answers help fixes',
    description: 'Answers, how-tos and fixes for the people you help.',
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

// The blanks: in no category, reached from Popular or by search (docs/specs/007-editor/start-diagramming.md
// "Groups"). Mirrors isBlankTemplate (BLANK_TEMPLATE, EXTRA_BLANK_TEMPLATES and Blank Tab);
// the categories test pins them together.
type BlankKind =
  'blank' | 'blank-illustration' | 'blank-slide-deck' | 'blank-article' | 'blank-infographic';

// Every non-blank template's primary category: the job it does in a knowledgebase. The slide and infographic kinds
// liveknowledge does not list (docs/specs/002-project-scope/not-in-liveknowledge.md) keep a row, since the Record is
// over every kind; no picker shows them.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, BlankKind>, TemplateCategory> = {
  // The written templates, the 13 every picker lists.
  'design-doc': 'engineering',
  'status-report': 'engineering',
  'meeting-notes': 'handbooks',
  newsletter: 'handbooks',
  'onboarding-handbook': 'onboarding',
  'lesson-plan': 'onboarding',
  'cover-letter': 'onboarding',
  // The Project Brief.
  article: 'product',
  'working-backwards': 'product',
  'business-proposal': 'product',
  'product-one-pager': 'product',
  'research-report': 'product',
  // How a customer was helped.
  'case-study': 'support',
  // Not listed.
  resume: 'onboarding',
  'event-poster': 'handbooks',
  'live-card': 'handbooks',
  'recipe-card': 'support',
  'floor-plan': 'engineering',
  'class-lesson': 'onboarding',
  'social-carousel': 'product',
  versus: 'product',
  'how-it-works': 'support',
  storyboard: 'product',
  'slide-deck': 'product',
  'launch-keynote': 'product',
  'year-in-review': 'handbooks',
  'quarterly-review': 'product',
  'data-story': 'product',
  'workshop-kickoff': 'handbooks',
  'team-welcome': 'onboarding',
  'board-update': 'product',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // The onboarding handbook is a handbook; a case study argues for the next piece of the product.
  'onboarding-handbook': ['handbooks'],
  'case-study': ['product'],
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
