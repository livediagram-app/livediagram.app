// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): livedocuments'
// own, grouped by what the document is for (the use case) rather than its page kind, so a deck, an article and a stack
// of flashcards for the same job sit together. Every template but the blanks has exactly one primary category and may
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
  | 'speeches'
  | 'team';

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
    id: 'careers',
    label: 'Careers',
    searchWords: 'job jobs cv application hiring',
    description: 'Résumés and cover letters for the next job.',
  },
  {
    id: 'events',
    label: 'Events and Celebrations',
    searchWords: 'party birthday wedding celebrate invitation',
    description: 'Posters, group cards and toasts for big days.',
  },
  {
    id: 'home',
    label: 'Home and Hobbies',
    searchWords: 'personal family cooking house',
    description: 'Recipes to share and floor plans of a home.',
  },
  {
    id: 'learning',
    label: 'Lessons and Learning',
    searchWords: 'school teacher teaching class education student',
    description: 'Lesson plans, class slides and school talks.',
  },
  {
    id: 'marketing',
    label: 'Marketing and Social',
    searchWords: 'social media content ad advert campaign',
    description: 'Social posts, explainers, ads and comparisons.',
  },
  {
    id: 'pitches',
    label: 'Pitches and Launches',
    searchWords: 'pitch investor startup sales keynote',
    description: 'Decks and cue cards to pitch or launch an idea.',
  },
  {
    id: 'plans',
    label: 'Plans and Proposals',
    searchWords: 'plan planning proposal spec project',
    description: 'Briefs, proposals, PR/FAQs and design docs.',
  },
  {
    id: 'reports',
    label: 'Reports',
    searchWords: 'report review update results numbers',
    description: 'Status reports, reviews and stories in numbers.',
  },
  {
    id: 'speeches',
    label: 'Speeches and Talks',
    searchWords: 'speech talk speaking cue cards',
    description: 'Cue cards for talks, toasts and presentations.',
  },
  {
    id: 'team',
    label: 'Team and Meetings',
    searchWords: 'meeting team onboarding workshop agenda',
    description: 'Meeting notes, workshops and welcomes for a team.',
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
// "Recommended and groups"). Mirrors isBlankTemplate (BLANK_TEMPLATE, EXTRA_BLANK_TEMPLATES and Blank Tab);
// the categories test pins them together.
type BlankKind =
  | 'blank'
  | 'blank-illustration'
  | 'blank-slide-deck'
  | 'blank-article'
  | 'blank-infographic'
  | 'blank-flashcards';

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
  'class-presentation': 'learning',
  'social-carousel': 'marketing',
  versus: 'marketing',
  'how-it-works': 'marketing',
  // A 30-second ad in six shots.
  storyboard: 'marketing',
  // A six-slide pitch.
  'slide-deck': 'pitches',
  'launch-keynote': 'pitches',
  'pitch-flashcards': 'pitches',
  // The Project Brief.
  article: 'plans',
  'working-backwards': 'plans',
  'business-proposal': 'plans',
  'design-doc': 'plans',
  'year-in-review': 'reports',
  'quarterly-review': 'reports',
  'data-story': 'reports',
  'status-report': 'reports',
  'talk-flashcards': 'speeches',
  'wedding-toast': 'speeches',
  'meeting-notes': 'team',
  'workshop-kickoff': 'team',
  'team-welcome': 'team',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // A toast is for a big day as much as it is a speech.
  'wedding-toast': ['events'],
  // Cue cards to speak from, whatever the occasion.
  'pitch-flashcards': ['speeches'],
  'class-presentation': ['speeches'],
  // An explainer teaches.
  'how-it-works': ['learning'],
  // A poster is how an event is marketed.
  'event-poster': ['marketing'],
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
