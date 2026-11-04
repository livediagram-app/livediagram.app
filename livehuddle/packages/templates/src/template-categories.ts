// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): one,
// Virtual Spaces, since the catalogue is the four Spaces and the blank (docs/specs/007-editor/templates-by-mode.md "The
// catalogue"). Every template but the blank has exactly one primary category and may be cross-listed in others where
// people would genuinely look for it. Read by Start a Space, the marketing gallery and the agents' catalogue. Pure
// data plus three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

// The Meetings & Workshops, Retrospectives, Brainstorming, Decisions, Goals & Metrics, People & Teams, Planning,
// Product & UX, Quizzes & Games, Strategy and Teaching & Learning categories left with their templates
// (docs/specs/002-project-scope/not-in-livehuddle.md).
export type TemplateCategory = 'spaces';

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
  // None: with one category there is nowhere else to list a template.
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
