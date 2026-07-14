// The help-centre article registry (spec/55): the single source for the help
// app's search + category/browse listings AND the editor's search-panel "Help"
// group (spec/09 + spec/56). It lives in a shared package because the two
// consumers are separate builds: apps/help renders browse/search/breadcrumbs
// from it, and apps/live derives its searchable help catalogue from it
// (lib/help-search.ts), so every article is findable from the canvas without
// hand-maintaining a second list.
//
// Each article carries `keywords`: the words a user would actually type when
// they don't know the article's title ("transparency" for opacity, "hotkey"
// for keyboard shortcuts). Both search surfaces match on them.

export interface Article {
  slug: string;
  title: string;
  description: string;
  /**
   * Space-separated, lowercase search synonyms. Widens matching beyond the
   * title + description to the vocabulary users actually type: synonyms
   * ("transparency" for opacity), adjacent spellings ("color" next to
   * "colour"), and concept words the copy doesn't happen to use. Every
   * article must have them (enforced by test) so nothing is findable only
   * by its exact title.
   */
  keywords: string;
  category: string;
  /** Full nested path under /help, e.g. "canvas" or "canvas/the-canvas". */
  categorySlug: string;
  /** Feature-landing slug this article hangs off, if it's a sub-article. */
  parentSlug?: string;
  /** Optional sub-category heading used to group a feature category's landing
   *  cards on its index page (e.g. Palette → "Selection Modes" / "Elements" /
   *  "Palette Settings"). Landings without a group render in a single grid. */
  group?: string;
}

/**
 * Canonical in-app path to an article page. Trailing slash to match the help
 * app's `trailingSlash: true` (so internal links resolve directly instead of
 * 308-redirecting). `next/link` prepends the `/help` basePath at render; the
 * sitemap, which needs absolute URLs, prepends the origin + `/help` itself.
 * One source for the `/<categorySlug>/<slug>/` shape every card / list / sitemap
 * entry was spelling out by hand.
 */
export function articleHref(article: Pick<Article, 'categorySlug' | 'slug'>): string {
  return `/${article.categorySlug}/${article.slug}/`;
}

/**
 * Canonical in-app path to a category landing page (`/<slug>/`, trailing slash
 * to match `trailingSlash: true`). `slug` is a category slug — top-level
 * (`canvas`) or a nested feature path (`canvas/the-canvas`), both of
 * which have a landing page. Sibling of {@link articleHref}; one source for the
 * category-link shape the cards / breadcrumbs / sitemap built by hand.
 */
export function categoryHref(slug: string): string {
  return `/${slug}/`;
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  articleCount: number;
  /** Feature-guide categories: grouped under "Feature Guides" on the home page,
   *  apart from the support categories (About, Getting Started, ...). */
  kind?: 'feature';
}

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livediagram',
    description:
      'Get to know livediagram: what it is, who it helps, and the ideas behind a free, open canvas.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a blank canvas to a shared diagram in minutes, with the basics every new user needs.',
    articleCount: 8,
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description:
      'Work faster with the shortcuts, hidden features, and small habits experienced users rely on.',
    articleCount: 6,
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description:
      'Stay in control of your work: how guest access, signing in, syncing, exporting, deletion, API tokens, connecting AI tools, and email notifications work.',
    articleCount: 7,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your diagrams are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'self-hosting',
    title: 'Self-Hosting',
    description:
      'Run livediagram on your own infrastructure, with the full feature set, free and open source.',
    articleCount: 3,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livediagram REST API from your own scripts: authentication, worked examples, errors and limits, and the OpenAPI reference.',
    articleCount: 4,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description:
      'Get unstuck fast with fixes for the most common editor and collaboration problems.',
    articleCount: 5,
  },
  {
    slug: 'supported-devices',
    title: 'Supported Devices',
    description:
      'How livediagram works on a computer, a tablet, and a phone, and what to expect on each.',
    articleCount: 3,
  },
  {
    slug: 'policies',
    title: 'Policies',
    description:
      'The legal terms for the hosted livediagram service: the Terms of Service and the full Privacy Policy.',
    articleCount: 2,
  },
  {
    slug: 'contact',
    title: 'Contact',
    description: 'Get in touch, report a bug, or request a feature.',
    articleCount: 0,
  },
  // Feature-guide categories (kind: 'feature'). Rendered under "Feature Guides"
  // on the home page; each has a card-grid index at /help/<slug>/. articleCount
  // counts the feature landings in the category (each landing has its own
  // sub-guides). See spec/55.
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editor: the panels, toolbar, context menus, minimap, zoom and tab bars, and quick controls.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: how the Explorer keeps your diagrams, folders, teams, and assets easy to find and manage.',
    articleCount: 12,
    kind: 'feature',
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette: Select, Hand, Eraser, Format Painter, Laser, Spotlight, and Isometric.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on the canvas: every element and palette setting explained.',
    articleCount: 14,
    kind: 'feature',
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Master the infinite canvas where diagrams come together: placing, selecting, grouping, linking, annotating, layering, rotating, animating, locking, theming, and templating.',
    articleCount: 15,
    kind: 'feature',
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one diagram: organise, link, and move between multiple boards with tabs.',
    articleCount: 8,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, teams, sharing, and session tools.',
    articleCount: 6,
    kind: 'feature',
  },
  {
    slug: 'activity-panel',
    title: 'Activity Panel',
    description:
      'The running record of every change to a diagram, with undo, redo, and reverting a single change.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: AI, zen mode, light and dark mode, Markdown import, and cleanup.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any diagram, folder, team, tab, or element, and add new elements to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];

// The two ways the category list partitions by `kind`, derived once here so the
// home + features pages don't each re-spell the predicate. Feature-guide
// categories (the card grids), and the support categories (About, Getting
// Started, ...) minus Contact, which the home renders as its own CTA.
export const featureCategories: Category[] = categories.filter((c) => c.kind === 'feature');
export const supportCategories: Category[] = categories.filter(
  (c) => c.kind !== 'feature' && c.slug !== 'contact',
);

export const articles: Article[] = [
  // ---- User Interface ----
  {
    slug: 'panel-layout',
    title: 'Panel Layout',
    description: 'The floating panels that frame the canvas, and how they are arranged.',
    keywords: 'ui window dock arrange workspace interface layout move panels chrome',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'toolbar',
    title: 'The Toolbar',
    description: 'The contextual toolbar that appears when you select one or more elements.',
    keywords: 'selection bar buttons formatting style options floating contextual',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'context-menus',
    title: 'Context Menus',
    description: 'Right-click menus across the editor, each scoped to what you clicked.',
    keywords: 'right click menu long press options popup categories more',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'zoom-controls',
    title: 'Zoom Controls',
    description: 'Move in and out of the canvas, fit the diagram to the screen, and reset to 100%.',
    keywords: 'zoom in out magnify fit screen percentage scale reset view dock',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'minimap',
    title: 'Minimap',
    description:
      'The bottom-left Map: a zoomed-out overview with a box for your view. Tap or drag to navigate.',
    keywords: 'map overview navigate viewport birds eye locate where am i',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'tab-bar',
    title: 'The Tab Bar',
    description:
      'Switch between the boards in a diagram, add new ones, and group them into folders.',
    keywords: 'tabs boards pages switch bottom bar sheets add rename',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'quick-controls',
    title: 'Quick Controls',
    description: 'The always-available actions tucked into the corner of the editor.',
    keywords: 'corner buttons actions settings shortcuts share help github',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },

  // ---- About ----
  {
    slug: 'what-is-livediagram',
    title: 'What is livediagram?',
    description: 'An overview of the real-time, multiplayer diagram editor and what it does.',
    keywords: 'overview intro introduction about product whiteboard drawing tool app',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'who-is-it-for',
    title: 'Who is livediagram For?',
    description: 'The teams and use cases that get the most out of livediagram.',
    keywords: 'audience use cases teams developers designers educators students',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'why-livediagram',
    title: 'Why Use livediagram?',
    description: 'Free, open source, no sign-in wall, real-time collaboration. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'what-is-open-source',
    title: 'What is Open Source?',
    description: 'What open source means, and what livediagram being MIT-licensed gives you.',
    keywords: 'mit license free code github oss public repository',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
  },

  // ---- Getting Started ----
  {
    slug: 'your-first-diagram',
    title: 'Your First Diagram',
    description: 'Create a diagram and add your first shapes in under a minute.',
    keywords: 'start begin new create tutorial beginner basics quickstart onboarding',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'welcome-tour',
    title: 'The Welcome Tour',
    description: 'The interactive editor walkthrough, offered once and replayable from Settings.',
    keywords: 'tour walkthrough guide onboarding show me around intro tutorial replay rerun steps',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'the-canvas-basics',
    title: 'Canvas Basics',
    description: 'Panning, zooming, and finding your way around the editor.',
    keywords: 'pan zoom navigate move around scroll basics orientation',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'adding-shapes-and-arrows',
    title: 'Adding Shapes and Arrows',
    description: 'Use the palette and quick-connect to build out a diagram.',
    keywords: 'add box connector line draw create insert place flowchart',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'sharing-your-diagram',
    title: 'Sharing Your Diagram',
    description: 'Hand a link to anyone and edit together in real time.',
    keywords: 'share link collaborate invite send url realtime together',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'guest-vs-account',
    title: 'Guest vs Account',
    description: 'The canvas works without signing in. Here is what an account adds.',
    keywords: 'sign in sign up anonymous login register benefits sync account',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'keyboard-essentials',
    title: 'Keyboard Essentials',
    description: 'The handful of shortcuts that make editing fast.',
    keywords: 'shortcuts hotkeys keys copy paste undo delete essential',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'accessibility',
    title: 'Accessibility and Keyboard Navigation',
    description:
      'Reach and walk the canvas with the keyboard, with your selection announced to screen readers.',
    keywords: 'a11y screen reader focus tab navigation aria assistive accessible',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },

  // ---- Tips and Tricks ----
  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'The full shortcut reference and how to toggle shortcuts off.',
    keywords: 'hotkey hotkeys keybinding cheat sheet reference keys bindings',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'command-palette',
    title: 'The Palette',
    description: 'Add any shape or run any command from the floating palette.',
    keywords: 'quick add search elements floating toolbar launcher',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'format-painter',
    title: 'The Format Painter',
    description: 'Copy the look of one element onto others in two clicks.',
    keywords: 'copy style paste formatting clone look duplicate appearance brush',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'duplicating-elements',
    title: 'Duplicating Elements',
    description: 'Duplicate in place, copy and paste across tabs, or Shift-drag a copy into place.',
    keywords: 'duplicate copy paste clone repeat shift drag cmd d ctrl d multiply ghost',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'fast-theming',
    title: 'Theme a Diagram Fast',
    description: 'Restyle an entire diagram in seconds with themes and presets.',
    keywords: 'restyle recolour recolor colors colours presets quick style scheme',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'presenting-well',
    title: 'Presenting from the Canvas',
    description: 'Get the most out of Presentation mode and Zen mode.',
    keywords: 'presentation slideshow demo present fullscreen slides meeting',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },

  // ---- Account and Data ----
  {
    slug: 'guest-identity',
    title: 'How Guest Identity Works',
    description: 'The per-browser id that owns your diagrams when you are not signed in.',
    keywords: 'anonymous browser id localstorage owner identity without account',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'signing-in',
    title: 'Signing In',
    description: 'Create an account, sign in, and migrate your guest diagrams.',
    keywords: 'login log in sign up register email code google oauth account create migrate',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'exporting-diagrams',
    title: 'Exporting Diagrams',
    description: 'Get a diagram out as an image or a shareable embed.',
    keywords: 'export download png svg pdf image save picture screenshot',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'deleting-your-data',
    title: 'Deleting Your Data',
    description: 'How to remove a diagram or clear everything tied to your id.',
    keywords: 'delete remove erase gdpr clear account wipe forget',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'api-tokens',
    title: 'API Tokens',
    description: 'Create signed-in-only tokens to call the livediagram API from your own scripts.',
    keywords: 'token key programmatic rest scripts secret bearer automation',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'connect-ai-mcp',
    title: 'Connect an AI tool (MCP)',
    description: 'Connect Claude or any MCP client to find, view, create, and edit your diagrams.',
    keywords: 'claude chatgpt cursor model context protocol ai integration assistant llm connector',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'email-notifications',
    title: 'Email Notifications',
    description: 'The optional emails we send, and how to turn each kind off from your profile.',
    keywords: 'emails unsubscribe opt out notification preferences turn off welcome',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },

  // ---- Developers ----
  {
    slug: 'api-overview',
    title: 'The livediagram API',
    description: 'What the REST API is, the base URL, and how to start calling it with a token.',
    keywords: 'rest api endpoints base url http programmatic developer integrate',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'authentication',
    title: 'Authentication',
    description: 'Authenticate API requests with a bearer token, and how that differs from guests.',
    keywords: 'auth bearer token authorize header credentials api key',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'working-with-diagrams',
    title: 'Working with Diagrams',
    description: 'Worked examples: list, read, create, and update diagrams, tabs, and folders.',
    keywords: 'examples curl crud create update list read api requests',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'errors-and-rate-limits',
    title: 'Errors and Rate Limits',
    description: 'Status codes, the error response shape, rate limits, and token expiry.',
    keywords: 'error 401 403 404 429 throttle limits status codes expiry failed',
    category: 'Developers',
    categorySlug: 'developers',
  },

  // ---- Policies ----
  {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'The terms that govern use of the hosted livediagram service.',
    keywords: 'tos legal terms conditions agreement rules',
    category: 'Policies',
    categorySlug: 'policies',
    parentSlug: 'policies',
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    description: 'The full privacy policy for the hosted livediagram service.',
    keywords: 'legal privacy gdpr data protection personal information',
    category: 'Policies',
    categorySlug: 'policies',
    parentSlug: 'policies',
  },

  // ---- Privacy and Security ----
  {
    slug: 'data-privacy',
    title: 'Data Privacy',
    description: 'Where your diagrams live and how they are handled.',
    keywords: 'storage stored cloudflare security where data location safe',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'offline-mode',
    title: 'Offline Mode',
    description: 'Save a diagram only in this browser, and move it to or from your account.',
    keywords: 'local only browser private no sync device localstorage disconnect',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'what-we-collect',
    title: 'What We Collect',
    description: 'The anonymous, first-party telemetry we record, and how to opt out.',
    keywords: 'privacy telemetry analytics tracking data collect opt out anonymous',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'share-link-security',
    title: 'Share Link Security',
    description: 'Passwords and expiry for the links you hand out.',
    keywords: 'password protect expire lock secure links safety access',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'open-source-trust',
    title: 'Open Source and Trust',
    description: 'The code is public and MIT-licensed. What that means for you.',
    keywords: 'github mit audit code public license transparent inspect',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },

  // ---- Self-Hosting ----
  {
    slug: 'self-hosting-overview',
    title: 'Self-Hosting Overview',
    description: 'What it takes to run your own livediagram, and why you might.',
    keywords: 'host yourself own server on premise deploy install run',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },
  {
    slug: 'deploying-livediagram',
    title: 'Deploying livediagram',
    description: 'The apps, the Cloudflare stack, and how a deploy runs.',
    keywords: 'cloudflare workers deploy install setup infrastructure d1 pages',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },
  {
    slug: 'configuration',
    title: 'Configuration and Optional Auth',
    description: 'Environment variables, optional Clerk auth, and guest-only mode.',
    keywords: 'env vars environment clerk setup secrets settings configure',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },

  // ---- Troubleshooting ----
  {
    slug: 'diagram-not-loading',
    title: 'A Diagram Will Not Load',
    description: 'What to check when a diagram is blank or stuck loading.',
    keywords: 'blank stuck loading error broken empty spinner wont open 404',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'cannot-sign-in',
    title: 'Cannot Sign In',
    description: 'Steps to take if sign-in fails or you lose access.',
    keywords: 'login failed locked out access problem cant sign in error code',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'collaboration-issues',
    title: 'Real-Time Collaboration Problems',
    description: 'Cursors, edits, or presence not syncing? Try these.',
    keywords: 'sync realtime not working lag disconnect websocket updates stale',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'browser-compatibility',
    title: 'Browser Compatibility',
    description: 'Supported browsers and how to fix rendering glitches.',
    keywords: 'chrome safari firefox edge supported rendering glitch display broken',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'missing-changes',
    title: 'My Changes Are Missing',
    description: 'How autosave works and how to recover with history.',
    keywords: 'lost work autosave recover restore disappeared gone save history',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },

  // ---- Supported Devices ----
  {
    slug: 'desktop',
    title: 'Desktop',
    description: 'The full editor on a computer, with every tool, shortcut, and panel.',
    keywords: 'computer pc mac windows laptop mouse full editor',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },
  {
    slug: 'tablet',
    title: 'Tablet',
    description: 'Using livediagram on a tablet, and how a keyboard changes what you can do.',
    keywords: 'ipad touch stylus pen android surface',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },
  {
    slug: 'mobile',
    title: 'Mobile',
    description: 'The touch-friendly editor on a phone, with the compact dock and gestures.',
    keywords: 'phone iphone android touch gestures small screen',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },

  // ============ Features (landing pages) ============
  {
    slug: 'the-canvas',
    title: 'The Canvas',
    description: 'The infinite canvas, the palette, and adding elements.',
    keywords: 'board workspace drawing area infinite surface whiteboard',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  // ---- Selection Modes (own feature category, extracted from Palette) ----
  {
    slug: 'select',
    title: 'Select',
    description: 'The default pointer for selecting, moving, and editing elements.',
    keywords: 'pointer cursor arrow tool default mode click',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'hand',
    title: 'Hand',
    description: 'Grab and pan the canvas without moving any elements.',
    keywords: 'pan drag move canvas grab scroll navigate',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'eraser',
    title: 'Eraser',
    description: 'Click or drag across elements to delete them quickly.',
    keywords: 'delete remove rub out erase clear wipe',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'format-painter',
    title: 'Format Painter',
    description: "Copy one element's style and paint it onto others.",
    keywords: 'copy style clone look paste formatting appearance brush',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'laser',
    title: 'Laser Pointer',
    description: 'A temporary laser trail for drawing attention while presenting.',
    keywords: 'presentation highlight trail point attention presenting red',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'spotlight',
    title: 'Spotlight',
    description: 'Dim the canvas and spotlight the element under your cursor.',
    keywords: 'dim focus highlight presentation emphasis attention darken',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'isometric-mode',
    title: 'Isometric Mode',
    description: 'Toggle the tab into a tilted, isometric perspective.',
    keywords: '3d tilt perspective iso angle view projection',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  // ---- Palette landings: Elements ----
  {
    slug: 'favourites',
    title: 'Favourites',
    description: 'Your go-to tiles from every category in one editable grid.',
    keywords: 'favourites favorites pinned custom controls edit quick grid',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'shapes',
    title: 'Shapes',
    description: 'Squares, circles, cylinders and more, with morphing and markers.',
    keywords: 'square circle rectangle box diamond triangle ellipse cylinder morph node',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'arrows',
    title: 'Arrows',
    description: 'Connectors of every style, with draggable curve and elbow handles.',
    keywords: 'connector line link edge join relationship pointer flow',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description: 'Text, pencil, tables, frames, charts and the rest of the Tools tab.',
    keywords: 'text pencil table frame chart sticky note image draw',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'components',
    title: 'Components',
    description: 'Pre-assembled blocks like banners, callouts, and stat rows.',
    keywords: 'banner callout stat block prebuilt widgets cards sections',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'devices',
    title: 'Devices',
    description: 'Browser, phone, laptop and other wireframing frames.',
    keywords: 'browser phone laptop wireframe mockup frame window screen',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'icons',
    title: 'Icons',
    description: 'A searchable catalogue of single-colour glyphs.',
    keywords: 'glyph symbol pictogram emoji search catalogue catalog reaction smiley thumbs status',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'technology',
    title: 'Technology',
    description: 'Full-colour AWS, Azure, and infrastructure icons.',
    keywords: 'aws azure gcp cloud logos tech stack infrastructure brands kubernetes docker',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  // ---- Palette landings: Palette Settings ----
  {
    slug: 'auto-attach-arrows',
    title: 'Auto-Attach Arrows',
    description: 'Re-pin arrows to the nearest face as shapes move.',
    keywords: 'reconnect pin snap face move connector attach follow',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'alignment-guides',
    title: 'Alignment Guides',
    description: 'Show snap lines while moving or resizing elements.',
    keywords: 'snap lines smart guides distribute align straighten ruler',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'panel-opacity',
    title: 'Panel Opacity',
    description: 'Make the floating panels translucent so the canvas shows through.',
    keywords: 'transparency transparent translucent see through fade panels alpha',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'quick-add-on-hover',
    title: 'Quick-add on Hover',
    description: 'Open an element’s + menu by hovering it instead of clicking.',
    keywords: 'plus menu hover add quick connect popup',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'minimal-panels',
    title: 'Minimal Panels',
    description: 'Swap floating panels for a compact button bar.',
    keywords: 'compact dock hide chrome small collapse reduce clutter',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'reset-palette-position',
    title: 'Reset Palette Position',
    description: 'Snap the palette back to its default corner.',
    keywords: 'move back default corner stuck lost off screen restore',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'selecting-and-grouping',
    title: 'Selecting and Grouping',
    description: 'Marquee, multi-select, groups, and the format painter.',
    keywords: 'multi select marquee group ungroup lasso rubber band combine',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'text-and-fonts',
    title: 'Text and Fonts',
    description: 'Editing labels and choosing from eight fonts per element or tab.',
    keywords: 'label typography font family typeface type writing edit',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'themes',
    title: 'Themes',
    description: 'Restyle a whole diagram, including multi-colour and custom themes.',
    keywords: 'color colour scheme restyle recolour recolor appearance style palette',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'templates',
    title: 'Templates',
    description: 'Start from a themed template instead of a blank canvas.',
    keywords: 'starter kanban flowchart swot gantt wireframe prebuilt scaffold quick start',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'using-tabs',
    title: 'Tabs',
    description: 'Multiple boards in one diagram: add, name, reorder, and switch between them.',
    keywords: 'boards pages multiple sheets add rename reorder switch',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'tab-folders',
    title: 'Tab Folders',
    description: 'Group related tabs under a named, collapsible folder along the tab bar.',
    keywords: 'group tabs organise organize collapse nest sections',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'linking-tabs',
    title: 'Linking Across Tabs',
    description: 'Turn an element into a jump point to another tab, element, diagram, or URL.',
    keywords: 'jump navigation cross reference hyperlink go to connect boards',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'locking-tabs',
    title: 'Locking a Tab',
    description: 'Make a whole board read-only so it cannot be changed by accident.',
    keywords: 'read only protect freeze prevent editing lock board',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'add-to-diagram',
    title: 'Add a Tab to Another Diagram',
    description: 'Add the active tab to another diagram you own; both share the same live tab.',
    keywords: 'reuse share tab sync across diagrams move copy live',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'import-tabs',
    title: 'Importing a Tab',
    description:
      'Import JSON, a Mermaid diagram (flowchart, state, or ER), a Markdown outline, or an Excalidraw scene into the active tab by pasting text or picking a file (it replaces the contents).',
    keywords: 'import json mermaid markdown excalidraw file paste upload load convert migrate',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'export-tabs',
    title: 'Exporting a Tab',
    description:
      'Export the active tab as JSON, a Mermaid flowchart, Markdown, an Excalidraw scene, PNG, SVG, or PDF — copy the text formats or set image options.',
    keywords: 'export download save png svg pdf json mermaid markdown excalidraw image picture',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'tab-cleanup',
    title: 'Cleaning Up a Tab',
    description: 'Tidy a tab in one click: snap to a grid, or auto-lay-out from the arrows.',
    keywords: 'tidy auto layout snap grid arrange organise organize align',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'comments',
    title: 'Comments',
    description: 'Leave threaded comments on the canvas and resolve them.',
    keywords: 'thread feedback reply resolve discussion note annotate mention',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'assigned-actions',
    title: 'Assigned Actions',
    description: 'Assign work on an element to a teammate and track it until done.',
    keywords: 'task assign todo work teammate track tickets delegate owner',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'live-presence',
    title: 'Live Presence',
    description: 'Live cursors, names, selections, and who is on which tab, in real time.',
    keywords: 'cursors online who viewing realtime collaborators avatars multiplayer',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'links',
    title: 'Links and Link Cards',
    description: 'Link elements across tabs or to URLs, and bookmark cards.',
    keywords: 'url hyperlink bookmark card website jump navigate external',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'explorer-page',
    title: 'Explorer Page',
    description: 'The full-page library: the sidebar sections, list view, and folders.',
    keywords: 'library home dashboard files my diagrams list manage browse',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'explorer-panel',
    title: 'Explorer Panel',
    description:
      'The compact in-editor Explorer for switching diagrams without leaving the canvas.',
    keywords: 'sidebar switch diagrams files library in editor open',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'list-and-card-views',
    title: 'List and Card Views',
    description: 'Toggle browse views between compact rows and preview cards with live snapshots.',
    keywords: 'card grid view toggle thumbnail preview snapshot layout rows tiles gallery',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'recent',
    title: 'Recent Diagrams',
    description: 'The default view: the diagrams you opened or edited most recently.',
    keywords: 'history last opened latest edited previously',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'shared-with-you',
    title: 'Shared With You',
    description: 'Diagrams other people have shared with you, collected in one place.',
    keywords: 'received from others incoming shares collaborations',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'folders',
    title: 'Folders',
    description: 'Group diagrams into a nestable tree, and move them between folders.',
    keywords: 'organise organize directory nest move tree group files',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'unsorted',
    title: 'The Unsorted Folder',
    description: 'The catch-all for diagrams that are not filed in any folder yet.',
    keywords: 'inbox uncategorised uncategorized catch all unfiled bucket',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'my-work',
    title: 'My Work and Folders',
    description: 'Your own library: the Unsorted bucket and the nested folders you create.',
    keywords: 'personal library your diagrams own files organise organize',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'team-spaces',
    title: 'Team Spaces',
    description: 'The teams you belong to, their shared folders, and your pending invites.',
    keywords: 'teams shared workspace invites membership group',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'image-gallery',
    title: 'Image Gallery',
    description: 'Every image you have uploaded, with where each is used and how to delete them.',
    keywords: 'uploads pictures photos assets manage delete media',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'themes-library',
    title: 'Saved Themes',
    description: 'Your custom themes as swatch previews, ready to edit, duplicate, or reuse.',
    keywords: 'custom themes swatches colours colors library reuse manage',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'profile',
    title: 'Your Profile',
    description: 'Your account identity, email-notification toggles, and account deletion.',
    keywords: 'account settings email delete avatar name preferences',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'teams',
    title: 'Teams',
    description: 'Invite members, assign roles, and share diagrams across a team.',
    keywords: 'workspace organisation organization members invite group company',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'sharing',
    title: 'Sharing and Embeds',
    description: 'Share links, passwords, expiry, embeds, and live images.',
    keywords: 'share link collaborate invite embed read only publish url send',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'zen-mode',
    title: 'Zen Mode',
    description: 'A distraction-free canvas with all the chrome hidden.',
    keywords: 'distraction free fullscreen hide ui focus clean minimal',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'dark-mode',
    title: 'Light and Dark Mode',
    description: 'Flip the editor chrome between light and dark, separate from your diagram theme.',
    keywords: 'night theme appearance dark light switch toggle eyes',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'ai',
    title: 'AI Assistance',
    description: 'Optional Ask and Clean helpers on the canvas.',
    keywords: 'assistant ask clean generate artificial intelligence helper suggest',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'markdown-import',
    title: 'Markdown Import',
    description: 'Turn a Markdown outline into a themed tree diagram.',
    keywords: 'outline text to diagram tree convert bullet list paste',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'session-tools',
    title: 'Session Tools',
    description: 'A shared countdown or stopwatch and live dot-voting.',
    keywords: 'timer voting workshop meeting facilitation retro countdown poll',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'style-presets',
    title: 'Style Presets',
    description: 'One-click colour and line-style variations for shapes and arrows.',
    keywords: 'quick styles variations color colour line fill appearance',
    category: 'Palette',
    categorySlug: 'palette/shapes',
    parentSlug: 'shapes',
  },
  {
    slug: 'layout-cleanup',
    title: 'Layout Cleanup',
    description: 'Auto-align to a grid or auto-layout the whole diagram.',
    keywords: 'tidy align arrange auto grid organise organize straighten',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'annotations',
    title: 'Annotations',
    description: 'Drop a marker with a note that readers hover to read.',
    keywords: 'note marker callout tooltip pin footnote comment hover',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'layers',
    title: 'Layers',
    description: 'Split a tab into stacking layers you can hide, lock, rename, and restack.',
    keywords: 'photoshop stack hide lock organise organize panel z order',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'layers-visibility-and-locking',
    title: 'Hiding, Locking, and Dimming Layers',
    description: 'Hide, lock, dim, or solo a whole layer, and preview one on hover.',
    keywords: 'show visibility solo preview toggle eye protect',
    category: 'Canvas',
    categorySlug: 'canvas',
    parentSlug: 'layers',
  },
  {
    slug: 'layers-organising',
    title: 'Organising and Merging Layers',
    description: 'Rename, restack, merge, clear, and move elements between layers.',
    keywords: 'organize rename reorder merge move clear manage',
    category: 'Canvas',
    categorySlug: 'canvas',
    parentSlug: 'layers',
  },
  {
    slug: 'layer-order',
    title: 'Layer Order and Opacity',
    description: 'Send elements to the front or back layer, and fade them with opacity.',
    keywords:
      'transparency transparent translucent alpha fade see through bring to front send to back stacking z index overlap behind above',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'rotation',
    title: 'Rotating Elements',
    description:
      'Snap an element to a preset 45° angle from the right-click menu or search palette.',
    keywords: 'rotate turn angle spin degrees tilt flip orientation',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'animations',
    title: 'Animating Elements',
    description: 'Loop a subtle animation on shapes, arrows, and icons.',
    keywords: 'animate motion pulse loop effects moving flow wiggle',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'locking',
    title: 'Locking Elements',
    description: 'Protect an element from accidental moves, resizes, and deletion.',
    keywords: 'lock protect freeze prevent editing pin fixed immovable',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'snapping',
    title: 'Alignment & Snapping',
    description: 'Drag to snap elements into line with guides; hold Cmd/Ctrl to place freely.',
    keywords: 'snap align guides grid free placement override precise position',
    category: 'Canvas',
    categorySlug: 'canvas',
  },

  // ---- Sub-articles: Canvas ----
  {
    slug: 'adding-elements',
    title: 'Adding Elements',
    description: 'Use the palette and double-click to place shapes.',
    keywords: 'place insert drop create add double click new',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },
  {
    slug: 'pan-and-zoom',
    title: 'Panning and Zooming',
    description: 'Move around the infinite canvas and fit the view.',
    keywords: 'navigate move scroll magnify fit view wheel pinch',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },
  {
    slug: 'changing-the-background',
    title: 'Changing the Canvas Background',
    description: 'Pick a canvas background from the Change Canvas dialog.',
    keywords: 'backdrop color colour pattern grid dots lines paper dark',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },

  // ---- Sub-articles: Shapes ----
  {
    slug: 'shape-markers',
    title: 'Shape Markers',
    description: 'Traffic-light dots and a checkbox glyph inside a shape.',
    keywords: 'status dots traffic light checkbox indicator badge red amber green',
    category: 'Palette',
    categorySlug: 'palette/shapes',
    parentSlug: 'shapes',
  },

  // ---- Sub-articles: Arrows ----
  {
    slug: 'arrow-styles',
    title: 'Arrow Styles',
    description: 'Straight, curved, and elbow arrows and how to switch between them.',
    keywords: 'straight curved elbow bezier connector line switch kind',
    category: 'Palette',
    categorySlug: 'palette/arrows',
    parentSlug: 'arrows',
  },
  {
    slug: 'curve-and-elbow-handles',
    title: 'Curve and Elbow Handles',
    description: 'Drag the handles to shape an arrow exactly how you want.',
    keywords: 'bend adjust waypoint drag control point route reshape',
    category: 'Palette',
    categorySlug: 'palette/arrows',
    parentSlug: 'arrows',
  },
  {
    slug: 'arrow-to-arrow',
    title: 'Connecting Arrows to Arrows',
    description: 'Snap an arrow endpoint onto another arrow for sequence diagrams.',
    keywords: 'sequence join connect endpoint attach branch',
    category: 'Palette',
    categorySlug: 'palette/arrows',
    parentSlug: 'arrows',
  },

  // ---- Sub-articles: Tools ----
  {
    slug: 'drawing',
    title: 'Drawing and Sketch',
    description: 'The Pencil, Highlighter, and Polygon tools, plus shape recognition.',
    keywords:
      'pencil freehand sketch draw doodle pen scribble ink highlighter marker highlight translucent polygon polyline vertex points outline zone region',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'images',
    title: 'Images',
    description: 'Add images to the canvas from your per-owner gallery.',
    keywords: 'picture photo upload png jpg insert logo screenshot',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'tables',
    title: 'Tables',
    description: 'An editable grid of cells for tabular content on the canvas.',
    keywords: 'grid cells rows columns spreadsheet matrix data',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'sticky-notes',
    title: 'Sticky Notes',
    description: 'A coloured note card for short annotations and brainstorm items.',
    keywords: 'postit post it note card brainstorm memo colored',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'code-blocks',
    title: 'Code Blocks',
    description: 'A dark monospace card with syntax-highlighted code snippets.',
    keywords:
      'code snippet syntax highlight monospace programming source developer json sql python javascript typescript',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'checklists',
    title: 'Checklists',
    description: 'Checkable to-do rows you tick right on the canvas.',
    keywords: 'todo to-do task tick check box checkbox list rows done progress action items',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'data-elements',
    title: 'Data and Chart Elements',
    description: 'Progress bars, ratings, pie charts, and timeline rails.',
    keywords: 'chart progress bar ring rating star pie timeline graphs visualisation visualization',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'shape-recognition',
    title: 'Shape Recognition',
    description: 'Let the Pencil snap rough sketches into clean shapes.',
    keywords: 'auto detect convert sketch clean up smart drawing',
    category: 'Palette',
    categorySlug: 'palette/tools/drawing',
    parentSlug: 'drawing',
  },

  // ---- Sub-articles: Selecting and Grouping ----
  {
    slug: 'multi-select',
    title: 'Marquee and Multi-Select',
    description: 'Select many elements at once and act on them together.',
    keywords: 'lasso rubber band shift click select all several box',
    category: 'Canvas',
    categorySlug: 'canvas/selecting-and-grouping',
    parentSlug: 'selecting-and-grouping',
  },
  {
    slug: 'groups',
    title: 'Groups',
    description: 'Bind elements into a group that moves and styles as one.',
    keywords: 'group ungroup bind combine together merge unit',
    category: 'Canvas',
    categorySlug: 'canvas/selecting-and-grouping',
    parentSlug: 'selecting-and-grouping',
  },

  // ---- Sub-articles: Text and Fonts ----
  {
    slug: 'choosing-fonts',
    title: 'Choosing Fonts',
    description: 'Set a font per element or a default font for the whole tab.',
    keywords: 'typeface typography font family type text style',
    category: 'Canvas',
    categorySlug: 'canvas/text-and-fonts',
    parentSlug: 'text-and-fonts',
  },

  // ---- Sub-articles: Themes ----
  {
    slug: 'changing-theme',
    title: 'Changing the Theme',
    description: 'Open the theme dialog and browse themes by category.',
    keywords: 'apply browse switch restyle colours colors dialog pick',
    category: 'Canvas',
    categorySlug: 'canvas/themes',
    parentSlug: 'themes',
  },
  {
    slug: 'multicolour-themes',
    title: 'Multi-Colour Themes',
    description: 'Tint each branch of a hierarchy its own hue.',
    keywords: 'multicolor rainbow branch hue tint colorful colourful',
    category: 'Canvas',
    categorySlug: 'canvas/themes',
    parentSlug: 'themes',
  },
  {
    slug: 'custom-themes',
    title: 'Custom Themes',
    description: 'Build, save, and reuse your own themes.',
    keywords: 'own colors colours personalise personalize create save brand',
    category: 'Canvas',
    categorySlug: 'canvas/themes',
    parentSlug: 'themes',
  },

  // ---- Sub-articles: Links ----
  {
    slug: 'link-cards',
    title: 'Link Cards',
    description: 'Bookmark a URL as a card with title, favicon, and preview.',
    keywords: 'bookmark website url card preview embed reference',
    category: 'Canvas',
    categorySlug: 'canvas/links',
    parentSlug: 'links',
  },

  // ---- Sub-articles: Teams ----
  {
    slug: 'roles-and-invites',
    title: 'Roles and Invites',
    description: 'Admin and Member roles, and inviting people by email.',
    keywords: 'admin member permission email invite add people access',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },
  {
    slug: 'team-shared-diagrams',
    title: 'Team Shared Diagrams',
    description: 'A per-team folder tree every member can manage.',
    keywords: 'shared library folder team files workspace common',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },

  // ---- Sub-articles: Sharing ----
  {
    slug: 'share-passwords',
    title: 'Share Passwords',
    description: 'Gate view or edit access behind a password.',
    keywords: 'protect lock secure gate private restrict access',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'share-link-expiry',
    title: 'Share Link Expiry',
    description: 'Give a share link a lifetime so it stops working later.',
    keywords: 'expire time limit temporary duration deadline revoke',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'embeds',
    title: 'Embeds',
    description: 'Drop a live diagram into another page, read-only or editable by link role.',
    keywords: 'iframe embed website notion confluence wiki blog integrate',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'live-image',
    title: 'Live Image',
    description: 'Copy an always-current image of a diagram for READMEs and docs.',
    keywords: 'readme badge always current screenshot png url auto updating',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },

  // ---- Sub-articles: AI ----
  {
    slug: 'ai-tools',
    title: 'Ask and Clean',
    description: 'What each AI helper does and when to reach for it.',
    keywords: 'ai assistant helpers question tidy generate review',
    category: 'Tools',
    categorySlug: 'tools/ai',
    parentSlug: 'ai',
  },

  // ---- Activity Panel (feature category landings) ----
  {
    slug: 'what-it-is',
    title: 'What the Activity Panel Is',
    description: 'A running record of every change to a diagram: who did what, and when.',
    keywords: 'history log changes record audit trail events',
    category: 'Activity Panel',
    categorySlug: 'activity-panel',
  },
  {
    slug: 'how-it-works',
    title: 'How the Activity Panel Works',
    description: 'Per-tab entries, real-time updates, jumping to an element, and clearing history.',
    keywords: 'history log entries realtime jump clear changes',
    category: 'Activity Panel',
    categorySlug: 'activity-panel',
  },
  {
    slug: 'undo',
    title: 'Undo',
    description: 'Step back your most recent change, with a keyboard shortcut and a button.',
    keywords: 'ctrl z cmd z revert back mistake reverse cancel',
    category: 'Activity Panel',
    categorySlug: 'activity-panel',
  },
  {
    slug: 'redo',
    title: 'Redo',
    description: 'Re-apply a change you just undid.',
    keywords: 'ctrl y cmd shift z repeat restore forward again',
    category: 'Activity Panel',
    categorySlug: 'activity-panel',
  },
  {
    slug: 'reverting-changes',
    title: 'Reverting a Change',
    description: 'Cancel one specific past change without disturbing later edits.',
    keywords: 'rollback undo history restore specific single revert',
    category: 'Activity Panel',
    categorySlug: 'activity-panel',
  },

  // ---- Sub-articles: Session Tools ----
  {
    slug: 'timer',
    title: 'The Timer',
    description: 'Run a shared countdown or stopwatch on a tab.',
    keywords: 'countdown stopwatch timebox clock minutes workshop',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
  },
  {
    slug: 'voting',
    title: 'Dot Voting',
    description: 'Let everyone vote live and tally the results.',
    keywords: 'vote poll tally decide prioritise prioritize dots',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
  },

  // ---- Sub-articles: Data Elements ----
  {
    slug: 'progress-elements',
    title: 'Progress Bars and Rings',
    description: 'Show a 0–100% value with fill animations.',
    keywords: 'percent percentage gauge meter loading completion donut',
    category: 'Palette',
    categorySlug: 'palette/tools/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'rating',
    title: 'Rating',
    description: 'A 1–5 star rating element with a score picker.',
    keywords: 'stars score review ranking five points',
    category: 'Palette',
    categorySlug: 'palette/tools/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'pie-chart',
    title: 'Pie Chart',
    description: 'An editable pie chart built from label and value rows.',
    keywords: 'circle graph percentages segments donut proportions data',
    category: 'Palette',
    categorySlug: 'palette/tools/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'bar-and-line-charts',
    title: 'Bar and Line Charts',
    description: 'Multi-series bar and line charts from an editable grid or a CSV import.',
    keywords: 'graph series csv data plot axis columns trends',
    category: 'Palette',
    categorySlug: 'palette/tools/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'timeline-rail',
    title: 'Timeline Rail',
    description: 'A horizontal rail of evenly spaced, labelled points for roadmaps and processes.',
    keywords: 'roadmap milestones process steps schedule phases history',
    category: 'Palette',
    categorySlug: 'palette/tools/data-elements',
    parentSlug: 'data-elements',
  },

  // ---- Sub-articles: Layout Cleanup ----
  {
    slug: 'auto-align',
    title: 'Auto-Align',
    description: 'Snap selected elements onto a tidy grid.',
    keywords: 'grid tidy straighten arrange snap organise organize',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
  },
  {
    slug: 'auto-layout',
    title: 'Auto Layout',
    description: 'Tidy Up the arrow graph as a flowchart, tree, or mindmap.',
    keywords: 'arrange flowchart tree mindmap tidy up automatic graph',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
  },

  // ============ Search Panel (landing + sub-articles) ============
  {
    slug: 'the-search-panel',
    title: 'The Search Panel',
    description: 'Open the global search, what it covers, and how to navigate the results.',
    keywords: 'find lookup global search everywhere quick open locate',
    category: 'Search Panel',
    categorySlug: 'search-panel',
  },
  {
    slug: 'search-diagrams',
    title: 'Finding Diagrams and Folders',
    description: 'Search across your diagrams, folders, and the diagrams shared with you.',
    keywords: 'find lookup locate files library open',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-teams',
    title: 'Searching Teams',
    description: 'Find teams and their shared folders and diagrams from the search panel.',
    keywords: 'find team shared folders lookup locate',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-tabs-and-elements',
    title: 'Finding Tabs and Elements',
    description: 'Inside a diagram, jump to any tab or element, including text inside table cells.',
    keywords: 'find jump locate text label shape board lookup',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-add-to-canvas',
    title: 'Adding Elements from Search',
    description:
      'Search the palette and drop a shape or icon onto the canvas without leaving search.',
    keywords: 'insert shape icon quick add place drop',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-create-tab',
    title: 'Creating a Tab from Search',
    description: 'Spin up a new tab straight from the search panel with the Create new tab action.',
    keywords: 'new board page quick create add',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'command-palette',
    title: 'The Command Palette (⌘K)',
    description:
      'Press Cmd/Ctrl+K to run any editor command by name: undo, auto layout, export, settings and more.',
    keywords: 'cmd k ctrl k quick actions run commands launcher shortcut',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
];

export function getArticlesByCategory(categorySlug: string): Article[] {
  return articles.filter((a) => a.categorySlug === categorySlug);
}

/**
 * A feature category's landing cards, split into sub-category groups in the
 * order each group first appears in {@link articles}. Used by the category
 * index to render grouped sections (e.g. Palette's Selection Modes / Elements
 * / Palette Settings). A category whose landings have no `group` collapses to
 * a single section with an empty `group` label, so callers can render a plain
 * grid unchanged.
 */
export function getCategoryGroups(categorySlug: string): { group: string; articles: Article[] }[] {
  const items = getArticlesByCategory(categorySlug);
  const groups: { group: string; articles: Article[] }[] = [];
  for (const article of items) {
    const label = article.group ?? '';
    const existing = groups.find((g) => g.group === label);
    if (existing) existing.articles.push(article);
    else groups.push({ group: label, articles: [article] });
  }
  return groups;
}

export function getSubArticles(parentSlug: string): Article[] {
  return articles.filter((a) => a.parentSlug === parentSlug);
}

export function searchArticles(query: string): Article[] {
  const lower = query.toLowerCase();
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(lower) ||
      a.description.toLowerCase().includes(lower) ||
      a.keywords.toLowerCase().includes(lower),
  );
}
