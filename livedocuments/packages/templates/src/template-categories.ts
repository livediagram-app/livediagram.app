// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): two,
// grouped by the job a person is getting done rather than the artefact a template is. Every template but the
// blanks has exactly one primary category and may be cross-listed in others where people would genuinely look for it.
// Read by the template step (Quick Start and /new), the marketing gallery and the agents' catalogue. Pure data plus
// three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory = 'design' | 'presentations';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place. Descriptions
// are kept to a similar length (40 to 50 characters) so the folded category tiles read as an even set.
// `searchWords`: what a search also finds the category's templates by, beyond its label.
type CategoryInfo = {
  id: TemplateCategory;
  label: string;
  description: string;
  searchWords?: string;
};

const CATEGORY_LIST: readonly CategoryInfo[] = [
  {
    id: 'design',
    label: 'Design',
    searchWords: 'ux',
    description: 'Storyboards and floor plans, on A3 sheets.',
  },
  {
    id: 'presentations',
    label: 'Presentations',
    searchWords: 'content',
    description: 'Slides, articles, posters and social posts.',
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
// "Recommended and groups"). Mirrors isBlankTemplate (BLANK_TEMPLATE_FOR_MODE, EXTRA_BLANK_TEMPLATES and Blank Tab);
// the categories test pins them together.
type BlankKind =
  'blank' | 'blank-illustration' | 'blank-slide-deck' | 'blank-article' | 'blank-infographic';

// Every non-blank template's primary category.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, BlankKind>, TemplateCategory> = {
  // Presentations and Content: pages made to be read or shared.
  'slide-deck': 'presentations',
  article: 'presentations',
  'working-backwards': 'presentations',
  'how-it-works': 'presentations',
  'data-story': 'presentations',
  'year-in-review': 'presentations',
  versus: 'presentations',
  'social-carousel': 'presentations',
  'launch-keynote': 'presentations',
  'quarterly-review': 'presentations',
  'team-welcome': 'presentations',
  'workshop-kickoff': 'presentations',
  'event-poster': 'presentations',
  resume: 'presentations',
  'recipe-card': 'presentations',
  'live-card': 'presentations',
  // Design: shots and the spaces people move through.
  storyboard: 'design',
  'floor-plan': 'design',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both). None today: with two categories, each
// Pages template is found in one.
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {};

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
