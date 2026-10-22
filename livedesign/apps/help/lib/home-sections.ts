// The help home page's structure (docs/specs/018-help/help-pages.md "Home page"): which categories each section
// shows, in order, and the popular topics under the search. Kept apart from the page so a test can hold it to the
// registry: every category in exactly one section, every popular topic a real article.

export interface HomeSection {
  /** Anchor id and React key. */
  id: string;
  /** The small uppercase label above the heading. */
  eyebrow: string;
  heading: string;
  lede: string;
  /** Category slugs, in the order the section shows them. */
  categories: string[];
}

/** The category sections between the hero and the closing band, top to bottom. */
export const HOME_SECTIONS: HomeSection[] = [
  {
    id: 'editor-guides',
    eyebrow: 'Editor Guides',
    heading: 'Everything in the editor',
    lede: 'In-depth guides for every part of the editor, grouped by where you find it.',
    categories: [
      'canvas',
      'palette',
      'selection-modes',
      'tabs',
      'collaboration',
      'explorer',
      'user-interface',
      'tools',
      'search-panel',
    ],
  },
  {
    id: 'account',
    eyebrow: 'Your Account',
    heading: 'Your account and your data',
    lede: 'Who you are to livedesign, where your work lives, and the promises that cover it.',
    categories: ['account-and-data', 'privacy-and-security', 'supported-devices', 'policies'],
  },
  {
    id: 'build',
    eyebrow: 'Build and Run',
    heading: 'Developers and self-hosting',
    lede: 'Drive livedesign from your own code, or run your own copy of it.',
    categories: ['developers', 'self-hosting'],
  },
];

/** The Start here section: the walkthrough's category and the cards beside it. */
export const START_HERE = {
  walkthrough: 'getting-started',
  /** How many of the walkthrough's first guides show as numbered steps. */
  steps: 4,
  beside: ['about', 'tips-and-tricks'],
} as const;

/** The closing band: the category beside the Contact route. */
export const STILL_STUCK = { category: 'troubleshooting', contact: 'contact' } as const;

/** The chips under the hero's search: the articles most readers come for, by `categorySlug/slug`. */
export const POPULAR_TOPICS: { label: string; path: string }[] = [
  { label: 'Your first diagram', path: 'getting-started/your-first-diagram' },
  { label: 'Sharing', path: 'getting-started/sharing-your-document' },
  { label: 'Keyboard shortcuts', path: 'tips-and-tricks/keyboard-shortcuts' },
  { label: 'Templates', path: 'canvas/templates' },
  { label: 'Exporting', path: 'account-and-data/exporting-diagrams' },
  { label: 'Plan mode', path: 'canvas/plan-mode' },
];

/** Every category slug the home page shows, in page order. */
export function homeCategorySlugs(): string[] {
  return [
    START_HERE.walkthrough,
    ...START_HERE.beside,
    ...HOME_SECTIONS.flatMap((s) => s.categories),
    STILL_STUCK.category,
    STILL_STUCK.contact,
  ];
}
