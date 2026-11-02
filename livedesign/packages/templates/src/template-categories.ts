// The template catalogue's categories (docs/specs/008-canvas/canvas-and-palette.md "Template categories"): livedesign's
// own, not shared with the other products, grouped by what a design is for (the use case) rather than its device or
// page kind, so a phone, a laptop and a browser flow for the same job sit together. Every template but the blanks has
// exactly one primary category and may be cross-listed in others where people would genuinely look for it.
// Read by the template step (the template start and /new), the marketing gallery and the agents' catalogue. Pure data
// plus three lookups; a Record over every non-blank kind, so a new template does not compile until it has a home.
import type { TemplateKind } from './templates';

export type TemplateCategory =
  | 'branding'
  | 'health'
  | 'media'
  | 'onboarding'
  | 'photos'
  | 'shopping'
  | 'social'
  | 'travel'
  | 'websites'
  | 'work';

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
    id: 'branding',
    label: 'Branding',
    searchWords: 'logo logos brand mark wordmark identity emblem badge icon',
    description: 'Logos, wordmarks, emblems and app icons.',
  },
  {
    id: 'health',
    label: 'Health and Fitness',
    searchWords: 'fitness workout wellness wearable activity',
    description: 'Workouts, heart rate and activity on the wrist.',
  },
  {
    id: 'media',
    label: 'Music and Video',
    searchWords: 'music audio video podcast streaming media player',
    description: 'Music, podcast and video players, and galleries.',
  },
  {
    id: 'onboarding',
    label: 'Sign Up and Onboarding',
    searchWords: 'signup register login sign in account first run welcome',
    description: 'First runs: welcome, sign up, verify, permissions.',
  },
  {
    id: 'photos',
    label: 'Photos',
    searchWords: 'picture image edit retouch',
    description: 'Photo edits, retouches and layered pictures.',
  },
  {
    id: 'shopping',
    label: 'Shopping',
    searchWords: 'shop ecommerce e-commerce store retail cart checkout delivery',
    description: 'Stores, carts, checkouts and order tracking.',
  },
  {
    id: 'social',
    label: 'Social and Messaging',
    searchWords: 'social network chat messaging community feed',
    description: 'Feeds, stories, posts, chat and profiles.',
  },
  {
    id: 'travel',
    label: 'Travel and Transport',
    searchWords: 'travel trip flight booking map ride taxi transport',
    description: 'Flights, boarding passes, maps and rides.',
  },
  {
    id: 'websites',
    label: 'Websites',
    searchWords: 'website web page site landing marketing browser',
    description: 'Landing pages, blogs, stores and help sites.',
  },
  {
    id: 'work',
    label: 'Work and Productivity',
    searchWords: 'work productivity saas business admin team',
    description: 'Dashboards, boards, tasks, calendars and inboxes.',
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
  | 'blank'
  | 'blank-illustration'
  | 'blank-logo'
  | 'blank-wireframe-phone'
  | 'blank-wireframe-tablet'
  | 'blank-wireframe-browser'
  | 'blank-wireframe-laptop'
  | 'blank-wireframe-watch';

// Every non-blank template's primary category.
const TEMPLATE_CATEGORY: Record<Exclude<TemplateKind, BlankKind>, TemplateCategory> = {
  // Branding: a brand's mark, worked up or explored by family.
  'logo-design': 'branding',
  'logo-lockups': 'branding',
  'logo-wordmarks': 'branding',
  'logo-emblems': 'branding',
  'logo-marks': 'branding',
  // Photos: a picture to edit (docs/specs/031-photo/photo-pages.md "Making a photo page").
  'photo-edit': 'photos',
  // Shopping: buying something, from browsing to paying or tracking it.
  'wireframe-mobile-app': 'shopping',
  'wireframe-delivery-app': 'shopping',
  // Websites: pages people visit in a browser.
  'wireframe-website': 'websites',
  'wireframe-online-store': 'websites',
  'wireframe-blog': 'websites',
  'wireframe-company-site': 'websites',
  // Work and Productivity: the screens a team works in.
  'wireframe-dashboard': 'work',
  'wireframe-project-tool': 'work',
  'wireframe-team-inbox': 'work',
  // Social and Messaging: people and what they share.
  'wireframe-social-app': 'social',
  'wireframe-tablet-app': 'social',
  // Health and Fitness: activity on the wrist (the Watch App's glance is an activity ring).
  'wireframe-watch-app': 'health',
  'wireframe-fitness-watch': 'health',
  // Travel and Transport: getting somewhere.
  'wireframe-travel-app': 'travel',
  'wireframe-ride-app': 'travel',
  // Music and Video: listening and watching.
  'wireframe-music-app': 'media',
  'wireframe-video-app': 'media',
  'wireframe-watch-music': 'media',
  // Sign Up and Onboarding: an app's first run.
  'wireframe-app-onboarding': 'onboarding',
};

// Cross-listing: the other categories a template is also shown in, where someone would genuinely look for it there.
// Never its primary, never a category twice (the categories test pins both).
export const TEMPLATE_ALSO_IN: Readonly<
  Partial<Record<TemplateKind, readonly TemplateCategory[]>>
> = {
  // A store is a website and a shop.
  'wireframe-online-store': ['shopping'],
  // The shopping app opens on its onboarding and sign in.
  'wireframe-mobile-app': ['onboarding'],
  // A team inbox is messaging as much as work.
  'wireframe-team-inbox': ['social'],
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
