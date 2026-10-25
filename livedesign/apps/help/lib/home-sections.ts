import type { HelpHomeLayout, HomeSection } from '@liveworkspace/help-site/lib/home';

// The help home page's layout (docs/specs/018-help/help-pages.md "Home page"): which categories each section
// shows, in order, and the popular topics under the search. The shared suite (help-site.test.ts) holds it to the
// registry: every category in exactly one section, every popular topic a real article.

/** The category sections between the hero and the closing band, top to bottom. */
const sections: HomeSection[] = [
  {
    id: 'editor-guides',
    eyebrow: 'Editor Guides',
    heading: 'Everything in the editor',
    lede: 'In-depth guides for every part of the editor, grouped by where you find it.',
    categories: [
      'pages',
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
const startHere = {
  walkthrough: 'getting-started',
  /** The numbered steps: livedesign's own first reads, in the order a new person takes them. */
  steps: [
    'getting-started/your-first-design',
    'pages/logo-pages',
    'canvas/layers',
    'getting-started/sharing-your-design',
  ],
  beside: ['about', 'tips-and-tricks'],
} as const;

/** The closing band: the category beside the Contact route. */
const stillStuck = { category: 'troubleshooting', contact: 'contact' } as const;

/** The chips under the hero's search: the articles most readers come for, by `categorySlug/slug`. */
const popular: HelpHomeLayout['popular'] = [
  { label: 'Your first design', path: 'getting-started/your-first-design' },
  { label: 'Sharing', path: 'getting-started/sharing-your-design' },
  { label: 'Keyboard shortcuts', path: 'tips-and-tricks/keyboard-shortcuts' },
  { label: 'Templates', path: 'canvas/templates' },
  { label: 'Exporting', path: 'account-and-data/exporting-designs' },
  { label: 'Logo pages', path: 'pages/logo-pages' },
];

export const HOME: HelpHomeLayout = { sections, startHere, stillStuck, popular };
