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
    articleCount: 7,
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
    articleCount: 8,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: how the Explorer keeps your diagrams, folders, teams, and assets easy to find and manage.',
    articleCount: 13,
    kind: 'feature',
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette: Select, Hand, Eraser, Format Painter, Highlighter, Laser, Spotlight, Avatar, Slide Deck, and Isometric.',
    articleCount: 11,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on the canvas: every element and palette setting explained.',
    articleCount: 24,
    kind: 'feature',
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Master the infinite canvas where diagrams come together: placing, selecting, grouping, linking, annotating, noting, layering, rotating, animating, shadowing, locking, theming, and templating.',
    articleCount: 19,
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
    keywords: 'corner buttons actions settings shortcuts share help github bottom bar cluster',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'settings',
    title: 'Settings',
    description: 'Every preference toggle, what it does, and which device it follows you to.',
    keywords:
      'settings preferences options config configure gear cog toggles minimal panels minimap welcome tour notifications toasts reduce motion animation accessibility ai assistant telemetry anonymous usage events privacy sync account device per device defaults turn off',
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
    keywords:
      'hotkey hotkeys keybinding cheat sheet reference keys bindings number numbers digit digits tool row excalidraw muscle memory single key letter',
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
    slug: 'copy-and-paste',
    title: 'Copy and Paste',
    description: 'Move elements between tabs, diagrams and windows through the system clipboard.',
    keywords:
      'copy paste cut clipboard cmd c cmd v cmd x ctrl c ctrl v ctrl x between diagrams another tab second window screenshot paste image offset reconnect arrows system clipboard',
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
    slug: 'highlighter',
    title: 'Highlighter',
    description: 'Mark up the board with a wide translucent marker in five colours.',
    keywords:
      'highlighter highlight marker mark up markup annotate emphasise emphasize pen draw attention translucent transparent yellow green pink blue orange colour color strength thin medium bold review workshop',
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
    slug: 'avatar-mode',
    title: 'Avatar Mode',
    description: 'Walk a pixel character around the diagram while you talk through it.',
    keywords:
      'walk walking character habbo person figure sprite avatar presentation present tour narrate arrow keys steer jump hop flag wave space male female right-click read-only customise customize panel gender clothing hair size outfit hoodie suit dress ponytail bald tall small',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'walking-together',
    title: 'Walking Together',
    description: "Everyone on a shared diagram sees everyone else's walking character.",
    keywords:
      'multiplayer together shared collaborate collaboration peers others everyone realtime real-time avatars characters names colour color presence',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    parentSlug: 'avatar-mode',
  },
  {
    slug: 'slide-deck',
    title: 'Slide Deck',
    description:
      'Build slides from your diagram and present them full screen, with notes, transitions and auto-advance.',
    keywords:
      'presentation presenting present presentation mode slideshow slide show slides slide deck talk demo walkthrough narrate projector screen share screenshare speaker notes presenter notes script full screen fullscreen next previous advance start deck build slides element set spans tabs',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'building-a-deck',
    title: 'Building a Deck',
    description: 'Edit, hide, reorder and annotate the slides before you present them.',
    keywords:
      'build deck new slide add remove elements selection membership rename duplicate copy slide delete confirm hide hidden slide skip struck through eye reorder drag order presenter notes script speaker notes budget minutes timing per slide pace slide menu ellipsis',
    category: 'Selection Modes',
    categorySlug: 'selection-modes/slide-deck',
    parentSlug: 'slide-deck',
  },
  {
    slug: 'presenting',
    title: 'Presenting',
    description:
      'What a running deck does: framing, transitions, moving through it, and what a click does.',
    keywords:
      'present full screen fullscreen start presenting framing frame fit padding backdrop transition travel slide fade reduce motion advance next previous arrow keys space page down home end escape exit laser spotlight point read only popover note comment action wake lock screen awake announce screen reader shortcuts dead',
    category: 'Selection Modes',
    categorySlug: 'selection-modes/slide-deck',
    parentSlug: 'slide-deck',
  },
  {
    slug: 'presenter-controls',
    title: "The Presenter's Controls",
    description:
      'The strip in the corner of a running deck, and the eleven settings behind its cog.',
    keywords:
      'hud controls strip corner position counter slide name jump to slide list grid notes button popover elapsed time clock budget minutes over amber pacing settings cog transition speed auto advance autoadvance loop click to advance fill screen actual size show position keep controls visible hide pointer cursor kiosk unattended',
    category: 'Selection Modes',
    categorySlug: 'selection-modes/slide-deck',
    parentSlug: 'slide-deck',
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
    keywords:
      'square circle rectangle box diamond triangle ellipse cylinder morph node hexagon trapezoid stadium parallelogram pill speech bubble cloud star document',
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
    title: 'Where each tool lives',
    description: 'A map of the palette categories and which elements are in each.',
    keywords:
      'tools tab category where find text pencil pen table frame chart sticky note image draw write build structure mind node lane timeline components media behaviour collaborate data moved',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'write',
    title: 'Write Elements',
    description:
      'Page, Text, Sticky note and Annotation: the four elements whose content is words.',
    keywords:
      'write writing text words wordy prose page document label caption title heading sticky note post-it annotation marker remark comment copy typing type compose',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'build',
    title: 'Build Elements',
    description: 'Mind nodes, lanes, frames, timelines, and tables: the elements that hold others.',
    keywords:
      'build structure layout container holds frame lane timeline table mind node arrange scaffold group section band track grid organise',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'frames',
    title: 'Frames',
    description: 'A labelled section that draws behind its contents and moves them as one.',
    keywords:
      'frame section container backdrop labelled box region area cluster move together carries contents behind resize outline f key figjam section export slide framing',
    category: 'Palette',
    categorySlug: 'palette/build',
    parentSlug: 'build',
  },
  {
    slug: 'components',
    title: 'Components',
    description: 'Pre-assembled blocks like banners, callouts, and stat rows.',
    keywords: 'banner callout stat block prebuilt widgets cards sections hero header masthead',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'mind-maps',
    title: 'Mind Maps',
    description: 'Tab adds a child, Enter a sibling — build a branch from the keyboard.',
    keywords:
      'mind map mindmap node branch child sibling tab enter keyboard tree hierarchy brainstorm outline',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'collaborate',
    title: 'Collaborate elements',
    description:
      'Comment panels, estimate cards, temperature checks, idea boxes, agendas, decisions and roll calls.',
    keywords:
      'collaborate collaboration comment panel card pin pinned remark note thread reply discuss feedback annotate sticky question estimate estimation planning poker story points fibonacci tshirt t-shirt temperature check fist of five pulse mood vote idea box anonymous brainstorm brainwriting retro retrospective agenda run of show timebox segments decision record adr architecture decision roll call attendance register present room team workshop facilitate facilitation powers of two',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'chairs',
    title: 'Chairs',
    description: 'Furniture for Avatar mode: walk a character in and it sits down.',
    keywords:
      'chair chairs seat seating sit sitting sat furniture avatar character walk stand table room seating plan attendance behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'lanes',
    title: 'Lanes',
    description: 'Titled bands for swimlanes; dragging one carries its contents.',
    keywords: 'lane swimlane swim band row role team process cross-functional container pool track',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'entities',
    title: 'Entities',
    description: 'A title over name / type rows, for class diagrams and data models.',
    keywords:
      'entity class uml er erd record table schema model field attribute method database column',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'embed-elements',
    title: 'Embeds on the canvas',
    description: 'Play a video, or open a Figma file, Google Doc or any website, on the canvas.',
    keywords:
      'embed video youtube vimeo loom figma google docs sheets slides play iframe media link website web page site url address browser frame',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'website',
    title: 'Website embeds',
    description:
      'Frame any web address on the canvas, for anything the named services do not cover.',
    keywords:
      'website embed url address site web page iframe frame browser https link any site blank refused x-frame-options sandbox load embed host label not loading empty open in new tab escape hatch',
    category: 'Palette',
    categorySlug: 'palette/embed-elements',
    parentSlug: 'embed-elements',
  },
  {
    slug: 'behaviour',
    title: 'Behaviour Elements',
    description:
      'Mode buttons, portals, chairs, link cards, session buttons, reveal zones, pickers, and reaction pads.',
    keywords:
      'behaviour behavior interactive button portal session timer vote poll reveal hide cover picker random spinner control mode switch chair seat link card bookmark preview url reaction pad confetti celebrate sparkles hearts applause fireworks emoji burst done check finished ready waiting who progress everyone mark complete',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'devices',
    title: 'Devices',
    description: 'Browser, phone, laptop and other wireframing frames.',
    keywords:
      'browser phone laptop wireframe mockup frame window screen monitor smartwatch watch tablet desktop device',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'icons',
    title: 'Icons',
    description: 'A searchable catalogue of single-colour glyphs.',
    keywords: 'glyph symbol pictogram line art search catalogue catalog theme colour color tint',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Elements',
  },
  {
    slug: 'stickers',
    title: 'Stickers',
    description: 'Die-cut colour emoji and word badges for reactions and status.',
    keywords:
      'emoji sticker badge label approved blocked wip reaction smiley face thumbs up heart fire celebrate party status flag arrow decorate pretty feelings emotion',
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
    description: 'Editing labels and choosing from eleven fonts per element or tab.',
    keywords: 'label typography font family typeface type writing edit',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'follow-along',
    title: 'Following someone',
    description: "Pin your pan, zoom and tab to a collaborator's until you move the canvas.",
    keywords:
      'follow following follow me follow along presenter presentation present audience viewport view camera pan zoom tab sync synchronise synchronize mirror watch spectate lead guide tour walkthrough demo',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Collaboration',
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
    slug: 'timeline',
    title: 'Timeline',
    description: 'The Explorer\u2019s landing view: a day-by-day feed of everything that happened.',
    keywords:
      'feed activity history what happened whats new latest events log stream notifications updates recent changes calendar month view upcoming expiring stacked grouped day',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'recent',
    title: 'Recent Diagrams',
    description: 'The default view: the diagrams you opened or edited most recently.',
    keywords:
      'history last opened latest edited previously hide exclude remove clutter show restore visible folder location where filed unsorted breadcrumb',
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
    description:
      'Your own library: the Unsorted and Favourites buckets, and the folders you create.',
    keywords:
      'personal library your diagrams own files organise organize favourite favorite star starred bookmark pin quick access',
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
    description: 'A shared countdown or stopwatch, live dot-voting, and polls.',
    keywords:
      'timer voting workshop meeting facilitation retro countdown poll polls survey pulse check',
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
    keywords: 'note marker callout tooltip pin footnote comment hover rich text formatting',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'notes',
    title: 'Notes',
    description:
      'Attach a longer written note to any element, formatted and out of sight until opened.',
    keywords:
      'note notes memo remark caveat detail context description rich text formatting bold italic underline heading bullet numbered list link popover badge resources',
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
    slug: 'size',
    title: 'Size',
    description: 'Type an exact width and height, lock the ratio, or reset a stretched shape.',
    keywords:
      'size width height dimensions exact pixels px resize scale bigger smaller aspect ratio lock proportion square stretch squash reset match',
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
    slug: 'shadows',
    title: 'Element Shadows',
    description: 'Lift an element with a drop shadow: five presets plus offset/blur sliders.',
    keywords: 'shadow drop depth elevation blur offset lift float soft hard card 3d shade',
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
    description: 'Straight, curved, and elbow arrows, and passing behind boxes.',
    keywords:
      'straight curved elbow bezier connector line switch kind behind under overlap cross crossing break gap route occlude z-index on top',
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
    slug: 'avoiding-elements',
    title: 'Arrows That Curve Around Things',
    description: 'Why a new arrow lands curved when a straight one would cut through something.',
    keywords:
      'avoid avoidance collision obstacle around through crossing cut bow bend curve automatic automatically why curved detour clearance route routing straighten reroute',
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
    description: 'The Freehand and Shape Pen and the Polygon tool, plus shape recognition.',
    keywords:
      'pencil freehand sketch draw doodle pen scribble ink polygon polyline vertex points outline zone region shape recognition',
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
    slug: 'pages',
    title: 'Pages',
    description: 'A paper-sized surface for the prose a label cannot hold.',
    keywords:
      'page document doc paper sheet a4 prose writing write rich text brief memo report notes longform masthead heading subtitle word processor',
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
    slug: 'portals',
    title: 'Portals',
    description: 'Link two rings of energy and jump — or walk — between them, across tabs too.',
    keywords:
      'portal door teleport jump travel warp link pair navigate shortcut across tabs walk through',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'data-elements',
    title: 'Data and Chart Elements',
    description: 'Progress bars, ratings, pie charts, and timeline rails.',
    keywords:
      'chart progress bar ring rating star pie timeline graphs visualisation visualization donut meter',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'shape-recognition',
    title: 'Shape Recognition',
    description: 'Let the Shape Pen snap rough sketches into clean shapes.',
    keywords: 'shape pen pencil auto detect convert sketch clean up smart drawing snap',
    category: 'Palette',
    categorySlug: 'palette/tools/drawing',
    parentSlug: 'drawing',
  },

  // ---- Sub-articles: Behaviour ----
  {
    slug: 'mode-buttons',
    title: 'Selection Mode Buttons',
    description: 'A button that hands whoever presses it a selection mode.',
    keywords:
      'mode button selection mode switch tool avatar select hand pan laser spotlight eraser format painter isometric highlighter control bar press leave walkthrough read-only',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },
  {
    slug: 'session-buttons',
    title: 'Session Buttons',
    description: 'Start a timer, a dot vote or a poll for the room from the board.',
    keywords:
      'session button timer countdown minutes dot vote dots poll question answers start room facilitation running order agenda clock pause resume reset remove edit access view only',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },
  {
    slug: 'done-checks',
    title: 'Done Checks',
    description: 'Ask the room to say when they have finished, and see who you are waiting on.',
    keywords:
      'done check finished ready waiting who progress everyone mark complete im done not done clear my mark reset everyone silent writing roster room presence flash',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },
  {
    slug: 'reaction-pads',
    title: 'Reaction Pads',
    description: 'A pad the room can press to throw a burst over the board.',
    keywords:
      'reaction pad confetti celebrate sparkles hearts applause clap fireworks emoji burst cheer thanks avatar walk onto ephemeral moment nothing saved',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },
  {
    slug: 'reveal-zones',
    title: 'Reveal Zones',
    description: 'Cover part of the canvas until the room is ready to see it.',
    keywords:
      'reveal zone hide cover conceal spoiler answers estimates blackout double click double tap hide pill reveal for all hide for all not private not secure',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },
  {
    slug: 'pickers',
    title: 'Pickers',
    description: 'Choose at random from the room, or from a list you write.',
    keywords:
      'picker random pick choose spinner wheel raffle draw lottery who demos next volunteer people here a list options shuffle',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },

  // ---- Sub-articles: Collaborate ----
  {
    slug: 'comment-panels',
    title: 'Comment Panels',
    description: 'A whole comment thread, left out on the board.',
    keywords:
      'comment panel thread remark note reply discuss feedback annotate composer resolve reopen badge popover pinned about an element arrow export',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
  },
  {
    slug: 'estimate-cards',
    title: 'Estimate Cards',
    description: 'Planning poker: everyone picks privately, one Reveal shows the lot.',
    keywords:
      'estimate estimation planning poker story points sizing fibonacci tshirt t-shirt shirt powers of two scale reveal spread unanimous clear anchor private pick withdraw',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
  },
  {
    slug: 'temperature-checks',
    title: 'Temperature Checks',
    description: 'A fist-of-five gauge that shows the shape of the room.',
    keywords:
      'temperature check fist of five pulse mood confidence gauge sentiment 1 to 5 blocked enthusiastic average bars shape of the room never hidden',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
  },
  {
    slug: 'idea-boxes',
    title: 'Idea Boxes',
    description: 'Anonymous submissions, held until you open the box.',
    keywords:
      'idea box anonymous anonymity brainstorm brainwriting suggestion submissions count hidden open the box scatter to stickies sticky notes retro pre-mortem safety',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
  },
  {
    slug: 'agendas',
    title: 'Agendas',
    description: 'The run of the session, with minutes against each segment.',
    keywords:
      'agenda run of show running order segments timebox minutes total schedule plan meeting workshop timer remaining struck through reorder',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
  },
  {
    slug: 'decision-records',
    title: 'Decision Records',
    description: 'What was decided, why, when, and whether it still stands.',
    keywords:
      'decision record adr architecture decision record status proposed accepted rejected superseded drivers rationale date why chose choice log',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
  },
  {
    slug: 'roll-calls',
    title: 'Roll Calls',
    description: 'Who was in the room, frozen into the diagram.',
    keywords:
      'roll call attendance register present participants who was here minutes snapshot take roll take again latecomers record',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
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
    slug: 'polls',
    title: 'Polls',
    description: 'Ask the room a question and tally the answers, saving nothing.',
    keywords:
      'poll polls survey question vote pulse check sentiment anonymous ephemeral rating scale yes no abstain multiple choice free text audience presenter',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
  },
  {
    slug: 'voting',
    title: 'Dot Voting',
    description: 'Let everyone vote live, privately if you want, and tally the results.',
    keywords:
      'vote poll tally decide prioritise prioritize dots anonymous private privacy secret blind hide hidden cursors pointers counts totals dot vote',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
  },

  // ---- Sub-articles: Dot Voting ----
  {
    slug: 'casting-dots',
    title: 'Casting Dots',
    description: 'Spending and taking back your dots, and what counts as votable.',
    keywords:
      'cast dot dots vote counter tally pill plus minus retract withdraw budget spend stack votable shapes sticky notes images frames arrows not votable',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
  },
  {
    slug: 'vote-layers',
    title: 'Voting on One Layer',
    description: 'Restrict a vote to one layer so only its elements take dots.',
    keywords:
      'vote layer layers votable layer all layers dimmed ringed restrict scope background frame annotation ideas scaffolding',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
  },
  {
    slug: 'vote-privacy',
    title: 'Private Voting',
    description: 'Hide cursors and hide the running counts for a blind vote.',
    keywords:
      'private privacy secret blind anonymous hide cursors pointers laser hide running counts totals tallies pile on bandwagon switches fixed',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
  },
  {
    slug: 'vote-panel',
    title: 'The Vote Panel',
    description: 'Track how far through a vote the room has got.',
    keywords:
      'vote panel turnout progress dots cast finished waiting pips remaining left rows unnamed anonymous when to end vote',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
  },
  {
    slug: 'vote-results',
    title: 'Vote Results',
    description: 'The shared walkthrough of what won, with the ranked list beside it.',
    keywords:
      'results reveal show results winners ranked list top result walkthrough previous next done highlight amber follow shared focus clear vote',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
  },

  // ---- Sub-articles: Data Elements ----
  {
    slug: 'progress-elements',
    title: 'Progress Bars and Rings',
    description: 'Show a 0–100% value with fill animations.',
    keywords: 'percent percentage gauge meter loading completion donut progress ring progress bar',
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
    keywords: 'graph series csv data plot axis columns trends bar chart line chart',
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
