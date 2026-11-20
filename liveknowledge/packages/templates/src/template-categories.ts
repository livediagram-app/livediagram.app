// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): liveknowledge'
// own, grouped by what the document is for (the use case) rather than its page kind, so a deck and an article for the same
// job sit together. Every template but the blanks has exactly one primary category and may
// be cross-listed in others where people would genuinely look for it.
// Read by the template step (Quick Start and /new), the marketing gallery and the agents' catalogue. Pure data plus
// three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory =
  | 'careers'
  | 'events'
  | 'home'
  | 'learning'
  | 'marketing'
  | 'pitches'
  | 'plans'
  | 'reports'
  | 'team';

// Declared in any order: TEMPLATE_CATEGORIES below sorts them by label, so a new category lands in place. Descriptions
// are kept to a similar length (40 to 50 characters) so the folded category tiles read as an even set.
// Labels are a word each, so a picker's rail fits each on one line; the longer names they once had (Events and
// Celebrations, Plans and Proposals) live on in `searchWords`, so a search for either half still finds them.
// `searchWords`: what a search also finds the category's templates by, beyond its label.
type CategoryInfo = {
  id: TemplateCategory;
  label: string;
  description: string;
  searchWords?: string;
};

// Events, Home and Pitches held only slide and infographic templates, which liveknowledge does not list
// (docs/specs/002-project-scope/not-in-liveknowledge.md): their ids stay in TemplateCategory for the unlisted kinds'
// rows below, and no picker shows them.
const CATEGORY_LIST: readonly CategoryInfo[] = [
  {
    id: 'careers',
    label: 'Careers',
    searchWords: 'job jobs cv application hiring',
    description: 'Cover letters for the next job you apply for.',
  },
  {
    id: 'learning',
    label: 'Learning',
    searchWords: 'lessons lesson school teacher teaching class education student',
    description: 'Lesson plans for a class, an hour at a time.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    searchWords: 'social media content ad advert campaign',
    description: 'Newsletters and case studies to send round.',
  },
  {
    id: 'plans',
    label: 'Plans',
    searchWords: 'proposals plan planning proposal spec project',
    description: 'Briefs, proposals, PR/FAQs and design docs.',
  },
  {
    id: 'reports',
    label: 'Reports',
    searchWords: 'report review update results numbers',
    description: 'Status reports and research, written to be read.',
  },
  {
    id: 'team',
    label: 'Teams',
    searchWords: 'meetings meeting team onboarding workshop agenda',
    description: 'Meeting notes and handbooks for a whole team.',
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

// Every non-blank template's primary category: the job it does.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, BlankKind>, TemplateCategory> = {
  resume: 'careers',
  'cover-letter': 'careers',
  'event-poster': 'events',
  'live-card': 'events',
  'recipe-card': 'home',
  'floor-plan': 'home',
  'lesson-plan': 'learning',
  'class-lesson': 'learning',
  'social-carousel': 'marketing',
  versus: 'marketing',
  'how-it-works': 'marketing',
  // A 30-second ad in six shots.
  storyboard: 'marketing',
  // A six-slide pitch.
  'slide-deck': 'pitches',
  'launch-keynote': 'pitches',
  // The Project Brief.
  article: 'plans',
  'working-backwards': 'plans',
  'business-proposal': 'plans',
  'design-doc': 'plans',
  'year-in-review': 'reports',
  'quarterly-review': 'reports',
  'data-story': 'reports',
  'status-report': 'reports',
  'meeting-notes': 'team',
  'workshop-kickoff': 'team',
  'team-welcome': 'team',
  'product-one-pager': 'plans',
  'research-report': 'reports',
  'board-update': 'reports',
  newsletter: 'marketing',
  'case-study': 'marketing',
  'onboarding-handbook': 'team',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // A team's newsletter goes round the team; a case study proposes the next project.
  newsletter: ['team'],
  'case-study': ['plans'],
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
