// The help-centre article registry (docs/specs/018-help/help-app.md): the single source for the help
// app's search + category/browse listings AND the editor's search-panel "Help"
// group (docs/specs/008-canvas/canvas-and-palette.md + docs/specs/018-help/contextual-help-links.md). It lives in a shared package because the two
// consumers are separate builds: apps/help renders browse/search/breadcrumbs
// from it, and apps/editor derives its searchable help catalogue from it
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

// The href helpers live in ./hrefs, a module with no data, so a client component that only builds
// links (the help centre's article page and search box) does not bundle the whole catalogue.
export { articleHref, categoryHref } from './hrefs';

/**
 * The top-level category a (possibly nested) `categorySlug` belongs to:
 * `palette/tools/data-elements` → `palette`, `canvas` → `canvas`. Lives here
 * because the nested-path shape is this registry's convention, so anything
 * grouping articles by their top-level category (the help centre's per-category
 * icon and accent fallbacks) reads it from one place rather than re-splitting
 * the string and drifting on what a segment means.
 */
export function topCategorySlug(categorySlug: string): string {
  return categorySlug.split('/')[0] ?? '';
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  articleCount: number;
  /** Feature-guide categories: grouped under "Feature Guides" on the home page,
   *  apart from the support categories (About, Getting Started, ...). */
  kind?: 'feature';
  /** The order this category's card groups appear in on its page (docs/specs/018-help/help-pages.md "Groups").
   *  Names every `group` its articles use; without it, groups appear in first-appearance order. */
  groups?: string[];
}

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livedocuments',
    description:
      'Get to know livedocuments: what it is, who it helps, and the ideas behind a free, open canvas.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a blank page to a shared document in minutes, with the basics every new user needs.',
    articleCount: 7,
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
    articleCount: 8,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your documents are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'self-hosting',
    title: 'Self-Hosting',
    description:
      'Run livedocuments on your own infrastructure, with the full feature set, free and open source.',
    articleCount: 3,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livedocuments REST API from your own scripts or the command line: authentication, worked examples, the CLI and developer tools, errors and limits, and the OpenAPI reference.',
    articleCount: 8,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description:
      'Get unstuck fast with fixes for the most common editor and collaboration problems.',
    articleCount: 6,
  },
  {
    slug: 'supported-devices',
    title: 'Supported Devices',
    description:
      'How livedocuments works on a computer, a tablet, and a phone, and what to expect on each.',
    articleCount: 3,
  },
  {
    slug: 'policies',
    title: 'Policies',
    description:
      'The legal terms for the hosted livedocuments service: the Terms of Service, the full Privacy Policy and how to report a vulnerability.',
    articleCount: 3,
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
  // sub-guides). See docs/specs/018-help/help-app.md.
  {
    slug: 'pages',
    title: 'Pages',
    description:
      'Build documents out of pages: articles, slide decks and infographics, with layouts, backgrounds and exports.',
    articleCount: 7,
    kind: 'feature',
    groups: ['Basics', 'Kinds of Page'],
  },
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editor: the panels, toolbar, context menus, the Map, zoom and tab bars, quick controls, and power user mode.',
    articleCount: 10,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: one library, shared by every liveworkspace app, that keeps your documents, folders, teams and images easy to find and manage.',
    articleCount: 13,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets and Imports'],
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette: Select, Hand, Format Painter, Laser, Spotlight, Slide Deck, and Isometric.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on a page: every element and palette setting explained.',
    articleCount: 20,
    kind: 'feature',
    groups: ['Everyday Elements', 'Page Blocks', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Work with what is on your pages: place, select, link, layer, rotate, animate, lock and theme elements, undo changes, and start from templates.',
    articleCount: 24,
    kind: 'feature',
    groups: ['Basics', 'Text and Notes', 'Styling Elements', 'Layers and Locking'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one document: organise, link, and move between tabs of pages.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, teams and sharing.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: zen mode, light and dark mode, Markdown import, and cleanup.',
    articleCount: 4,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any document, folder, team, tab, or element, and add new elements to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];

// The feature-guide categories (the card grids), derived once here so the
// features page doesn't re-spell the predicate.
export const featureCategories: Category[] = categories.filter((c) => c.kind === 'feature');

export const articles: Article[] = [
  // ---- User Interface ----
  {
    slug: 'panel-layout',
    title: 'Panel Layout',
    description: 'Where the toolbar and panels sit around the canvas, and how to rearrange them.',
    keywords:
      'ui window dock arrange workspace interface layout move panels chrome corner snap reset position menu button',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'toolbar',
    title: 'The Toolbar',
    description: 'The contextual toolbar that appears when you select one or more elements.',
    keywords:
      'selection bar buttons floating contextual duplicate lock delete comment filter export more',
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
    description: 'Zoom in and out, fit the canvas to the screen, and reset to 100%.',
    keywords: 'zoom in out magnify fit screen percentage scale reset view dock',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'minimap',
    title: 'Map',
    description:
      'The bottom-left Map: a zoomed-out overview with a box for your view. Tap or drag to navigate.',
    keywords: 'minimap mini map overview navigate viewport birds eye locate where am i',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'tab-bar',
    title: 'The Tab Bar',
    description:
      'Switch between the tabs in a document, add new ones, and group them into folders.',
    keywords: 'tabs pages switch bottom bar add rename',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'quick-controls',
    title: 'Quick Controls',
    description:
      'The always-available Search, Settings and appearance controls at the end of the bottom bar.',
    keywords:
      'corner buttons actions settings search github bottom bar cluster appearance light dark',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'settings',
    title: 'Settings',
    description: 'Every preference toggle, what it does, and which device it follows you to.',
    keywords:
      'settings preferences options config configure gear cog toggles panel opacity toolbar minimap welcome tour notifications toasts reduce motion animation accessibility telemetry anonymous usage events privacy sync account device per device defaults turn off keyboard shortcuts hotkeys keybindings ui scale element indicators badges dock position draw default folders where new documents go email api tokens trash delete',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },

  {
    slug: 'power-user-mode',
    title: 'Power User Mode',
    description: 'Recommended settings in one switch, and Minimal chrome for a quieter interface.',
    keywords:
      'power user expert advanced pro minimal chrome hide labels captions titles icons only declutter preset recommended settings appearance light dark right-click',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'title-bar',
    title: 'The Title Bar',
    description: 'Rename the document, see who can see it, preview as a viewer, and Share or Copy.',
    keywords:
      'header top bar document name rename visibility private shared team public local only role pill editing viewing participating owner preview read only share copy make a copy account',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },

  // ---- About ----
  {
    slug: 'what-is-livedocuments',
    title: 'What is livedocuments?',
    description:
      'An overview of the real-time, multiplayer editor for articles, decks and infographics.',
    keywords:
      'overview intro introduction about product articles slides deck infographics presenting app',
    category: 'About livedocuments',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'who-is-it-for',
    title: 'Who is livedocuments For?',
    description: 'The teams and use cases that get the most out of livedocuments.',
    keywords: 'audience use cases teams developers designers educators students',
    category: 'About livedocuments',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'why-livedocuments',
    title: 'Why Use livedocuments?',
    description: 'Free, open source, no sign-in wall, real-time collaboration. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livedocuments',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'what-is-open-source',
    title: 'What is Open Source?',
    description: 'What open source means, and what livedocuments being MIT-licensed gives you.',
    keywords: 'mit license free code github oss public repository',
    category: 'About livedocuments',
    categorySlug: 'about',
    parentSlug: 'about',
  },

  // ---- Getting Started ----
  {
    slug: 'your-first-document',
    title: 'Your First Document',
    description: 'From a new document to a first page you can share, in a couple of minutes.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding document page article slide picture template location',
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
    description: 'Drop shapes from the palette onto a page and connect them with arrows.',
    keywords: 'add box connector line create insert place process flow how-to',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'sharing-your-document',
    title: 'Sharing Your Document',
    description: 'Hand a link to anyone and edit together in real time.',
    keywords: 'share link collaborate invite send url realtime together diagram',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'guest-vs-account',
    title: 'Guest vs Account',
    description: 'The editor works without signing in. Here is what an account adds.',
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
      'hotkey hotkeys keybinding cheat sheet reference keys bindings number numbers digit digits tool row excalidraw muscle memory single key letter settings keyboard category disable all',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'command-palette',
    title: 'The Palette',
    description:
      'Pick tools and add shapes, text, icons and more to your pages from the palette strip.',
    keywords:
      'quick add search elements toolbar strip launcher categories category bar flyout selection mode tiles bands',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'format-painter',
    title: 'The Format Painter',
    description: 'Copy the look of one element onto others in two clicks.',
    keywords:
      'copy style paste formatting clone look duplicate appearance brush format panel paint once keep the',
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
    description: 'Move elements between tabs, documents and windows through the system clipboard.',
    keywords:
      'copy paste cut clipboard cmd c cmd v cmd x ctrl c ctrl v ctrl x between documents diagrams another document another tab second window screenshot paste image offset reconnect arrows system clipboard',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'fast-theming',
    title: 'Restyle a Document Fast',
    description: 'Restyle a whole tab of pages in seconds with themes and presets.',
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
    description:
      'The liveworkspace guest identity that owns your documents when you are not signed in.',
    keywords:
      'anonymous browser guest id token identity owner without account liveworkspace redirect every app document',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'signing-in',
    title: 'Signing In',
    description: 'Create an account, sign in, and bring your guest documents with you.',
    keywords:
      'login log in sign up register email code google oauth account create avatar initials guest',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'exporting-documents',
    title: 'Exporting Documents',
    description:
      'Take your pages with you as a PDF, images, a GIF or a portable file, or embed a live view.',
    keywords:
      'export download png svg pdf gif animated image save picture screenshot json embed backup',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'deleting-your-data',
    title: 'Deleting Your Data',
    description: 'How to delete a document or your whole account, and what each removes.',
    keywords: 'delete remove erase gdpr clear account wipe forget close trash',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'trash',
    title: 'Trash',
    description: 'Deleted documents wait 30 days: restore one, or delete it for good.',
    keywords:
      'trash bin recycle deleted undo undelete restore recover get back permanently delete forever empty trash blank unused automatic automatically clean up cleanup thirty days document',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'api-tokens',
    title: 'API Tokens',
    description:
      'Create signed-in-only tokens to call the livedocuments API from your own scripts.',
    keywords: 'token key programmatic rest scripts secret bearer automation',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'connect-ai-mcp',
    title: 'Connect an AI Tool (MCP)',
    description: 'Connect Claude or any MCP client to find, view, create, and edit your documents.',
    keywords:
      'claude chatgpt cursor model context protocol ai integration assistant llm connector trash restore pages slides article read-only',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'ai-clients',
    title: 'Connecting AI Tools',
    description: 'Add livedocuments to Claude, Claude Code, Cursor, ChatGPT or any MCP client',
    keywords:
      'mcp connector claude desktop claude code cursor chatgpt oauth bearer token setup remote server url',
    category: 'Account and Data',
    categorySlug: 'account-and-data/connect-ai-mcp',
    parentSlug: 'connect-ai-mcp',
  },
  {
    slug: 'email-notifications',
    title: 'Email Notifications',
    description: 'The optional emails we send, and how to turn each kind off in Settings.',
    keywords:
      'emails unsubscribe opt out notification preferences turn off welcome mention comment settings',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },

  // ---- Developers ----
  {
    slug: 'api-overview',
    title: 'The livedocuments API',
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
    slug: 'working-with-documents',
    title: 'Working with Documents',
    description: 'Worked examples: list, read, create, and update documents, tabs, and folders.',
    keywords:
      'examples curl crud create update list read api requests diagrams outline view text agent',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'edit-operations',
    title: 'Edit Operations Reference',
    description: 'Every changeset operation, selector, placement, flag and lint finding.',
    keywords:
      'changeset edit operations ops line form json selector placement flags lint findings vocabulary cli mcp agent',
    category: 'Developers',
    categorySlug: 'developers/working-with-documents',
    parentSlug: 'working-with-documents',
  },
  {
    slug: 'images-and-pages',
    title: 'Images, Pages and More',
    description: 'API examples for images, pages and articles, renders and copies.',
    keywords:
      'images upload pages page slides article articles markdown render svg picture copy duplicate api',
    category: 'Developers',
    categorySlug: 'developers/working-with-documents',
    parentSlug: 'working-with-documents',
  },
  {
    slug: 'errors-and-rate-limits',
    title: 'Errors and Rate Limits',
    description: 'Status codes, the error response shape, rate limits, and token expiry.',
    keywords: 'error 401 403 404 429 throttle limits status codes expiry failed',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'cli',
    title: 'The livedocuments CLI',
    description:
      'Read, build, edit and discuss documents from a terminal: install, sign in, the commands, and self-hosting.',
    keywords:
      'cli command line terminal shell npm npx install agent coding agent script automation device code login sign in token keychain export pull push self-host',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'workbenches',
    title: 'Documents in Your Developer Tools',
    description:
      'Work on a document inside a developer tool beside your agent, and talk about what you select.',
    keywords:
      'workbench spinner vs code vscode ide editor embed frame iframe pair pairing selection select agent coding agent live view developer tool workspace explorer folder whole workspace',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'building-a-workbench',
    title: 'Building a Workbench',
    description: 'Pair, frame and message the editor from your own developer tool.',
    keywords:
      'workbench integration postmessage post message iframe frame embed ticket pairing pair handshake hello ack renew selection reference reveal theme ended vs code extension protocol origin',
    category: 'Developers',
    categorySlug: 'developers/workbenches',
    parentSlug: 'workbenches',
  },
  {
    slug: 'agent-changes',
    title: "Reviewing and Undoing an Agent's Changes",
    description: 'See what an AI tool, the CLI or a script changed, and undo it for 30 days',
    keywords:
      'changeset changesets undo revert agent ai mcp cli history review rollback toast kept diff',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'agent-comments-presence',
    title: 'Comments and Presence for Agents',
    description: 'Reply to and resolve comments, and show what your agent is doing.',
    keywords:
      'agent comments reply resolve reopen threads presence status focus ring card comments api cli bot',
    category: 'Developers',
    categorySlug: 'developers',
  },

  // ---- Policies ----
  {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'The terms that govern use of the hosted livedocuments service.',
    keywords: 'tos legal terms conditions agreement rules',
    category: 'Policies',
    categorySlug: 'policies',
    parentSlug: 'policies',
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    description: 'The full privacy policy for the hosted livedocuments service.',
    keywords: 'legal privacy gdpr data protection personal information ai retention security',
    category: 'Policies',
    categorySlug: 'policies',
    parentSlug: 'policies',
  },
  {
    slug: 'report-a-vulnerability',
    title: 'Reporting a Vulnerability',
    description: 'How to report a security issue privately, and our safe-harbour promise.',
    keywords:
      'security vulnerability disclosure bug exploit cve advisory responsible safe harbour harbor pentest researcher hacker report',
    category: 'Policies',
    categorySlug: 'policies',
    parentSlug: 'policies',
  },

  // ---- Privacy and Security ----
  {
    slug: 'data-privacy',
    title: 'Data Privacy',
    description: 'Where your documents live and how they are handled.',
    keywords: 'storage stored cloudflare security where data location safe',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'offline-mode',
    title: 'Offline Mode',
    description: 'Save a document only in this browser, and move it to or from your account.',
    keywords:
      'local only pill this browser private no sync device localstorage disconnect save location clear site data lost guest default start move to account after sign in share upload',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'what-we-collect',
    title: 'What We Collect',
    description: 'The anonymous, first-party telemetry we record, and how to opt out.',
    keywords:
      'privacy telemetry analytics tracking data collect opt out anonymous page views pageviews visits',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'telemetry-dashboard',
    title: 'The Public Telemetry Dashboard',
    description: 'Every view on /telemetry, its date windows, timings and Web Vitals.',
    keywords:
      'telemetry dashboard analytics stats metrics public transparency charts trends timings percentiles p75 median core web vitals lcp inp cls exceptions search anonymous',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security/what-we-collect',
    parentSlug: 'what-we-collect',
  },
  {
    slug: 'share-link-security',
    title: 'Share Link Security',
    description: 'A password and lifetimes for the links you hand out.',
    keywords:
      'password protect expire lock secure links safety access pass expiry extend revoke viewer editor',
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
    description: 'What it takes to run your own livedocuments, and why you might.',
    keywords: 'host yourself own server on premise deploy install run',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },
  {
    slug: 'deploying-livedocuments',
    title: 'Deploying livedocuments',
    description: 'The apps, the Cloudflare stack, and how a deploy runs.',
    keywords:
      'cloudflare workers deploy install setup infrastructure d1 github actions router mcp wrangler',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },
  {
    slug: 'configuration',
    title: 'Configuration and Optional Auth',
    description: 'Environment variables, optional sign-in, and guest-only mode.',
    keywords:
      'env vars environment sign-in accounts setup secrets settings configure resend email mcp telemetry r2',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },
  {
    slug: 'mcp-server',
    title: 'The MCP Server on a Self-Hosted Instance',
    description: 'Set up the MCP server for AI tools on your own deployment.',
    keywords:
      'mcp server worker kv namespace consent base url oauth issuer mcp origin self host ai claude connector',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting/configuration',
    parentSlug: 'configuration',
  },

  // ---- Troubleshooting ----
  {
    slug: 'document-not-loading',
    title: 'A Document Will Not Load',
    description: 'What to check when a document is blank or stuck loading.',
    keywords:
      'blank stuck loading error broken empty spinner wont open 404 diagram opening taking longer than usual colleague works for others',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'repair-this-browser',
    title: 'Repair This Browser',
    description: 'Clear stuck settings and caches, keeping your documents.',
    keywords:
      'reset clear cache cookies local storage stuck loading fix diagnostics support repair browser data',
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
    description: 'How autosave works, what a failed save looks like, and how to recover.',
    keywords:
      'lost work autosave recover restore disappeared gone save history new version reload update',
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
    description: 'Using livedocuments on a tablet, and how a keyboard changes what you can do.',
    keywords: 'ipad touch stylus pen android surface',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },
  {
    slug: 'mobile',
    title: 'Mobile',
    description: 'The touch-friendly editor on a phone, with the toolbar strip and gestures.',
    keywords:
      'phone iphone android touch gestures small screen toolbar dock mobile layout landscape sideways rotate header tabs hide fullscreen',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },

  // ============ Features (landing pages) ============
  {
    slug: 'the-canvas',
    title: 'The Canvas',
    description: 'The infinite canvas, the palette, and adding elements.',
    keywords: 'workspace drawing area infinite surface pages',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  // ---- Selection Modes (own feature category, extracted from Palette) ----
  {
    slug: 'select',
    title: 'Select',
    description: 'The default pointer for selecting, moving, and editing elements.',
    keywords: 'pointer cursor arrow tool default mode click marquee picker shift',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'hand',
    title: 'Hand',
    description: 'Pan the canvas with a plain drag on empty space.',
    keywords: 'pan drag move canvas grab scroll navigate space middle click hand tool',
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
    keywords: 'presentation highlight trail point attention presenting red pointer pen glow comet',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'spotlight',
    title: 'Spotlight',
    description: 'Dim the canvas around a circle of light that follows your cursor.',
    keywords: 'dim focus highlight presentation emphasis attention darken',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'slide-deck',
    title: 'Slide Deck',
    description: 'Turn your pages into a deck: each slide is a page, presented full screen.',
    keywords:
      'presentation presenting present presentation mode slideshow slide show slides slide deck talk demo walkthrough narrate projector screen share screenshare speaker notes presenter notes script full screen fullscreen next previous advance start deck build slides element set spans tabs',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'building-a-deck',
    title: 'Building a Deck',
    description:
      'Everything you do to a deck before you present it: slides, order, hiding and notes.',
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
    description: 'Look at the tab as a tilted 3D scene, orbit it, and export it that way.',
    keywords: '3d tilt perspective iso angle view projection orbit rotate camera export',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
  },
  // ---- Palette landings: Elements ----
  {
    slug: 'shapes',
    title: 'Shapes',
    description: 'Squares, circles, cylinders and more, with morphing and markers.',
    keywords:
      'square circle rectangle box diamond triangle ellipse cylinder morph node hexagon trapezoid stadium parallelogram pill speech bubble cloud star document',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'arrows',
    title: 'Arrows',
    description: 'Connectors of every style, with draggable curve and elbow handles.',
    keywords: 'connector line link edge join relationship pointer flow',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'tools',
    title: 'Where each tool lives',
    description:
      'The palette categories on each kind of page, and what only the search panel adds.',
    keywords:
      'tools tab category where find text table chart sticky note image write components media data concepts devices icons stickers search panel slide article moved',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'write',
    title: 'Write Elements',
    description: 'Text, Sticky note and Pointer note: the elements made of words.',
    keywords:
      'write writing text words wordy label caption title heading sticky note post-it remark comment copy typing type compose pointer note leader',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'sankey-diagram',
    title: 'Sankey Diagram',
    description: 'Show how much moves where: bands as wide as the amount they carry.',
    keywords:
      'sankey flow flows diagram energy budget money income spending funnel conversion journey migration material supply chain band bands width amount quantity nodes split merge sankeymatic alluvial csv paste spreadsheet',
    category: 'Palette',
    categorySlug: 'palette/concept-graphics',
    parentSlug: 'concept-graphics',
  },
  {
    slug: 'components',
    title: 'Components',
    description: 'Cards, badges, step numbers and web components: banners, callouts and more.',
    keywords:
      'banner callout stat row stat rows kpi badge step number block prebuilt widgets cards sections hero header masthead nav navigation website web page process steps pages',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'cards-and-callouts',
    title: 'Cards and Callouts',
    description: 'One node with a title, a meta line, a body, an icon and tags, plus accent edges.',
    keywords:
      'card cards node service component title meta line subtitle body tags chips icon badge tile initial header band callout note tip warning accent edge stripe strip colour color coded side border architecture persona title and caption',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Page Blocks',
  },
  {
    slug: 'badges-and-step-numbers',
    title: 'Badges and Step Numbers',
    description: "Small marks that attach to a node's corner and travel with it.",
    keywords:
      'badge badges pill label tag status version new beta count step number numbers numbered disc circle walkthrough order sequence 1 2 3 attach attached corner marker renumber play in order annotate',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Page Blocks',
  },
  {
    slug: 'pointer-notes',
    title: 'Pointer Notes',
    description: 'A note joined by a line to the one spot it is about.',
    keywords:
      'pointer note notes leader line callout remark comment annotate point spot pin pinned dot tip attach detach follow arrow label caveat',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Page Blocks',
  },
  {
    slug: 'stacks',
    title: 'Stacks',
    description: 'A container that lines up what you drop in, with even gaps.',
    keywords:
      'stack stacks row column grid auto layout autolayout flex flexbox align distribute even gaps spacing padding container list reflow arrange',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Page Blocks',
  },
  {
    slug: 'concept-graphics',
    title: 'Concept Graphics',
    description:
      'Stacks, pyramids, funnels, cycles, hubs, onions, chevrons and timelines that lay out their rows.',
    keywords:
      'concept concepts graphic layer stack layers tiers pyramid triangle hierarchy maslow inverted funnel conversion cycle loop ring flywheel pdca plan do check act smartart rows build pulse flow animation hub and spoke hub spoke satellites ecosystem onion rings concentric core chevron chevrons pipeline value chain stages timeline milestones roadmap',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Page Blocks',
  },
  {
    slug: 'embed-elements',
    title: 'Embeds on the canvas',
    description: 'Play a video, or open a Figma file, Google Doc or any website, on the canvas.',
    keywords:
      'embed video youtube vimeo loom figma google docs sheets slides play iframe media link website web page site url address browser frame pages',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Page Blocks',
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
    slug: 'devices',
    title: 'Devices',
    description: 'Browser, phone, laptop and other wireframing frames.',
    keywords:
      'browser phone laptop mockup mock up frame window screen monitor smartwatch watch tablet foldable fold unfolded desktop device pages',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'icons',
    title: 'Icons',
    description: 'A searchable catalogue of single-colour glyphs.',
    keywords:
      'glyph symbol pictogram line art search catalogue catalog theme colour color tint furniture floor plan weight thin regular bold inline icon in shape',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'stickers',
    title: 'Stickers',
    description: 'Die-cut colour emoji and word badges for reactions and status.',
    keywords:
      'emoji sticker badge label approved blocked wip reaction smiley face thumbs up heart fire celebrate party status flag arrow decorate pretty feelings emotion',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'technology',
    title: 'Technology',
    description:
      'Full-colour AWS, Azure, Cloudflare and infrastructure icons, added from the search panel.',
    keywords:
      'aws azure gcp cloud logos tech stack infrastructure brands kubernetes docker cloudflare firebase postgres database lambda s3 architecture brand',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'drawing',
    title: 'Drawing with the Polygon',
    description: 'Place clean, straight-edged outlines point by point with the Polygon.',
    keywords: 'polygon outline point by point straight edges shape draw vertex vertices close path',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  // ---- Palette landings: Palette Settings ----
  {
    slug: 'auto-attach-arrows',
    title: 'Auto-Attach Arrows',
    description: 'Move an arrow end to the facing side when a move sends it through a shape.',
    keywords: 'reconnect pin snap side anchor quarter corner move connector attach follow',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'alignment-guides',
    title: 'Alignment Guides',
    description: 'Show the guide lines that explain a snap while moving or resizing.',
    keywords:
      'snap lines smart guides distribute align straighten ruler snapping hide off cmd ctrl free',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'panel-opacity',
    title: 'Panel Opacity',
    description: 'Make the panels translucent so the canvas shows through.',
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
    slug: 'toolbar-layout',
    title: 'Toolbar Layout',
    description: 'The palette strip across the top of the canvas, its category bar and its Search.',
    keywords:
      'toolbar strip top bar excalidraw panel layout floating palette compact menu button explorer more tiles recent recently used order reorder search find element per page kind slide article',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Palette Settings',
  },
  {
    slug: 'selecting-and-grouping',
    title: 'Selecting Many Elements',
    description: 'Marquee, multi-select, and the format painter.',
    keywords: 'multi select marquee group ungroup lasso rubber band combine several many',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'text-and-fonts',
    title: 'Text and Fonts',
    description: 'Editing labels and choosing from eleven fonts per element or tab.',
    keywords: 'label typography font family typeface type writing edit size colour color',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Text and Notes',
  },
  {
    slug: 'follow-along',
    title: 'Following Someone',
    description: "Pin your pan, zoom and tab to a collaborator's until you move the canvas.",
    keywords:
      'follow following follow me follow along presenter presentation present audience viewport view camera pan zoom tab sync synchronise synchronize mirror watch spectate lead guide tour walkthrough demo',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'themes',
    title: 'Themes',
    description: 'Restyle a whole tab, including multi-colour themes.',
    keywords: 'color colour scheme restyle recolour recolor appearance style palette',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'templates',
    title: 'Templates',
    description: 'Start a document from a ready-made template instead of a blank page.',
    keywords:
      'template templates starter scaffold quick start prebuilt blank slide deck blank article blank infographic blank tab blank illustration empty slide empty page slide deck group card storyboard floor plan working backwards pr faq project brief event poster year in review resume cv recipe card data story how it works versus social carousel launch keynote quarterly review team welcome workshop kickoff design presentations search find a template start making pages recommended',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'working-with-pages',
    title: 'Working with Pages',
    description:
      'Every tab is a row of pages: add, size, paint, reorder, lock and find them, then export or present.',
    keywords:
      'pages page infographic infographics poster one pager one-pager flyer handout report sheet a4 a3 letter us letter square social post instagram linkedin story stories slide portrait landscape orientation size page size background article articles document page kind first page choice navigator next page previous page backgrounds colour color gradient pattern dots grid lines theme dark page name rename duplicate move reorder drag delete add page snap margins margin fit resize scale split into pages contents sidebar find a page lock locked unlock padlock protect freeze read only page lock custom gradient photo background image background picture background photo overlay image overlay wash tint fade upload image title bar layout button background button tidy up tidy align straighten even spacing widescreen carry over',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'infographic-layouts',
    title: 'Infographic Layouts',
    description:
      'Ninety-two ready-made pages in eight categories, previewed on your page as you hover.',
    keywords:
      'layout layouts template templates page template start from a layout ready made starter preview hover replace title page big number key stats statistics process steps timeline milestones comparison before after chart story top tips quote testimonial team people facts grid checklist event invitation poster layout button replace undo covers posters data explainers cover report cover annual report magazine book cover proposal case study newsletter contents certificate award gig concert research poster academic coming soon movie film exhibition travel workshop hiring job sale discount notice warning motivational kpi dashboard metrics trend market share pie doughnut stat mosaic staircase customer journey project plan gantt decision flow flowchart how-to recipe versus vs pricing price plans tiers swot effort impact matrix quadrant scorecard rating spectrum venn options org chart organisation organization testimonials reviews speakers spotlight employee values idea board brainstorm persona user persona shout-outs kudos thank you social media carousel instagram tip of the day milestone followers behind the scenes countdown product launch giveaway contest welcome onboarding webinar how it works anatomy diagram key concepts cheat sheet shortcuts glossary definitions myths facts fact file lesson summary quiz formula equation explainer education',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
  },
  {
    slug: 'articles',
    title: 'Writing Articles',
    description:
      'Write on pages like a doc: text that flows onto new pages, with pictures, charts and drawings in it.',
    keywords:
      'article articles write writing document doc word google docs page pages text paragraph heading headings title subtitle list bullet numbered todo checklist quote code divider page break flow overflow new page toolbar formatting bold italic underline link colour color highlight align markdown shortcut slash menu paste picture image chart table sticky drawing inline wrap float move drag resize comment comments action actions assign margin note style look font fonts margins page numbers line spacing lined paper notebook convert page element leave pages',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
  },
  {
    slug: 'pages-tour',
    title: 'The Pages Tour',
    description:
      'A short, optional walkthrough for each kind of page, offered the first time you work on one and replayable from Settings or Show Me.',
    keywords:
      'pages tour tour walkthrough onboarding intro introduction getting started guide tutorial first time learn pages page name cog page settings layout background add page slides slide deck add to slides present presentation infographic article show me replay rerun settings accessibility',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'exporting-pages',
    title: 'Exporting and Presenting Pages',
    description: 'Every page or one page as a PDF, images or an animated GIF, and pages as slides.',
    keywords:
      'export download pdf png svg gif animated gif animation moving image loop image zip all pages one page import json print printable pages page pages infographic slides slide deck present presentation add as slide page slide deck from pages',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'tab-windows',
    title: 'Tab Windows',
    description: 'Another tab, live, fitted inside a slide or page.',
    keywords:
      'tab window windows live view embed mirror show another tab diagram on a slide reference up to date stale copy paste sync linked picture choose a tab open',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'slide-pages',
    title: 'Slide Pages',
    description: 'Landscape 16:9 or 4:3 pages with slide layouts, added to the deck in one press.',
    keywords:
      'slide slides deck presentation present powerpoint keynote 16:9 4:3 widescreen classic landscape layouts title slide bullets agenda thank you add to slide deck hide show eye presenter',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
  },
  {
    slug: 'using-tabs',
    title: 'Tabs',
    description:
      'Multiple tabs of pages in one document: add, name, reorder, and switch between them.',
    keywords:
      'tabs pages multiple add rename reorder switch delete duplicate tab menu new tab start making pages',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'tab-folders',
    title: 'Tab Folders',
    description: 'Group related tabs under one named folder chip on the tab bar.',
    keywords: 'group tabs organise organize collapse nest sections fan chip',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'linking-tabs',
    title: 'Linking Across Tabs',
    description:
      'Turn an element into a jump point to another tab, another document, or a web address.',
    keywords: 'jump navigation cross reference hyperlink go to connect',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'side-by-side',
    title: 'Side by Side Tabs',
    description:
      'Drag a tab to the right edge to open it beside the one you are on; the toolbars follow you.',
    keywords:
      'split view split screen two tabs compare beside next to dual pane panes side-by-side drag tab right edge reference resize divider close',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'locking-tabs',
    title: 'Locking a Tab',
    description: "Make a tab's whole canvas read-only so it cannot be changed by accident.",
    keywords: 'read only protect freeze prevent editing lock unlock padlock',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'add-to-document',
    title: 'Add a Tab to Another Document',
    description: 'Add the active tab to another document you own; both share the same live tab.',
    keywords: 'reuse share tab sync across documents diagrams move copy live',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'import-tabs',
    title: 'Importing a Tab',
    description:
      'Import a livedocuments JSON tab export into a tab by pasting text or picking a file.',
    keywords:
      'import json file files paste upload load restore backup copy clipboard replace tab export round trip',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'export-tabs',
    title: 'Exporting a Tab',
    description:
      "Export a tab's pages as PDF, PNG, SVG or GIF, or as JSON; a selection also exports as Markdown.",
    keywords: 'export download save png svg pdf gif animated json markdown image picture pages',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'tab-cleanup',
    title: 'Cleaning Up a Tab',
    description:
      'Tidy a tab from the command palette: snap to a grid, or auto-lay-out from the arrows.',
    keywords: 'tidy auto layout snap grid arrange organise organize align command palette cleanup',
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
    keywords:
      'cursors online who viewing realtime collaborators avatars multiplayer people participants roster room agent agents ai status working focus',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'links',
    title: 'Links',
    description:
      'Make a shape, text, sticky note, image or table a link to another tab, document or the web.',
    keywords:
      'url hyperlink bookmark card website jump navigate external resources add link edit link remove link',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'explorer-page',
    title: 'Explorer Page',
    description:
      "The full-page library every liveworkspace app shares: Documents or All, the sidebar's Overview, Spaces and More, views and search.",
    keywords:
      'library home dashboard files my documents list manage browse sidebar overview spaces more search all apps every app filter canvases designs liveworkspace duplicate copy document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'explorer-panel',
    title: 'Explorer Panel',
    description:
      'The compact in-editor Explorer: a rail of sections beside a list, opening documents in place.',
    keywords:
      'sidebar rail switch documents library in editor menu button hamburger popover open explorer every app new share export',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'list-and-card-views',
    title: 'List, Card and Details Views',
    description: 'Toggle browse views between compact rows, cards and a sortable details table.',
    keywords:
      'card grid view toggle layout rows tiles gallery details table columns sort type comments access size created updated date',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'filters',
    title: 'Search and Filter Documents',
    description:
      'Narrow any document list with words, chips or typed filters like made-by:ai, and share it as a link.',
    keywords:
      'search find filter filters chips narrow refine query token tokens pill pills made by ai generated template edited date last week recent people me others owner space team shared unsorted folder name subfolders lens results clear document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'timeline',
    title: 'Home',
    description:
      'The Explorer’s landing view and the Timeline: what you opened last, what was shared with you recently, and what happened.',
    keywords:
      'home jump back in recent last opened most used see more shared with you recently what happened while away teammates others changes see timeline timeline history feed log who changed edited renamed moved trashed restored shared calendar filter new since last visit unread count remove from timeline hide landing start every app all apps document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'activity',
    title: 'Inbox',
    description:
      'What is outstanding for you across every app: actions assigned to you or by you, and open comment threads.',
    keywords:
      'activity inbox to do todo tasks my actions assigned to me assigned by me outstanding waiting open threads unresolved comments replies mentions pending work queue what needs me badge count all apps document documents',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'recent',
    title: 'Recent',
    description:
      'Everything you can open, by when you last opened it, across every folder, team and share.',
    keywords:
      'history last opened latest previously recently opened folder location where filed chip hide from recent show in recent exclude remove twelve document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'shared-with-you',
    title: 'Shared With Me',
    description: 'Items other people have shared with you through a link, collected in one place.',
    keywords:
      'shared with me received from others incoming shares links collaborations remove dismiss document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'folders',
    title: 'Folders',
    description: 'Group your items into a nestable tree, and move them between folders.',
    keywords:
      'organise organize directory nest move tree group files change folder subfolder delete folder document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'default-folders',
    title: 'Default Folders',
    description: 'Send new documents to a folder you choose instead of My Work.',
    keywords:
      'default folder where new documents go automatic placement file use as default settings documents new document',
    category: 'Explorer',
    categorySlug: 'explorer/folders',
    parentSlug: 'folders',
  },
  {
    slug: 'personal-space',
    title: 'My Work and Folders',
    description:
      'Your own library: the folders you create, your unfiled items, Unsorted and Favourites.',
    keywords:
      'my documents personal space library my work your documents own files root folder organise organize unsorted unfiled made by ai generated favourite favorite star starred bookmark quick access',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'team-spaces',
    title: 'Team Spaces',
    description: 'Each team as a space beside My Work, with its shared folders, and Manage Teams.',
    keywords:
      'teams team spaces shared workspace library manage teams liveworkspace membership group',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'image-gallery',
    title: 'Image Gallery',
    description: 'Every image you have uploaded, with where each is used and how to delete them.',
    keywords: 'uploads pictures photos assets manage delete media guest upload used unused',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Assets and Imports',
  },
  {
    slug: 'profile',
    title: 'Your Account',
    description:
      'Your identity card, email-notification switches, and account deletion, in Settings.',
    keywords:
      'account profile settings email delete avatar name preferences identity danger zone menu sign out mentions',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'teams',
    title: 'Teams',
    description:
      'Your liveworkspace teams, run on liveworkspace.app, and the library every member shares.',
    keywords:
      'workspace organisation organization members invite group company manage teams liveworkspace document',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'sharing',
    title: 'Sharing and Embeds',
    description:
      'Share links at Viewer, Participant or Editor level, a password, lifetimes, embeds and live images.',
    keywords:
      'share link collaborate invite embed read only publish url send viewer participant editor create and copy link turn off',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'zen-mode',
    title: 'Zen Mode',
    description: 'A distraction-free canvas with all the chrome hidden.',
    keywords: 'distraction free fullscreen hide ui focus clean minimal presentation screen share',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    // The slug stays 'dark-mode': it is a public URL, and "dark mode" is still
    // what a reader searches for even though the control is now three-way.
    slug: 'dark-mode',
    title: 'Appearance: Light, Dark, System',
    description: 'Set livedocuments to light, dark, or your device setting, everywhere at once.',
    keywords:
      'night theme appearance dark light system os device switch toggle cycle eyes mode website help header',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'markdown-import',
    title: 'Markdown Import',
    description:
      'Import a Markdown file as an article, or paste Markdown into an article page, and it becomes formatted writing.',
    keywords: 'markdown md file paste article headings lists bullet formatting import text convert',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'style-presets',
    title: 'Style Presets',
    description: 'One-click colour and line-style variations for shapes and arrows.',
    keywords: 'markdown md paste article headings lists bullet formatting import text convert',
    category: 'Palette',
    categorySlug: 'palette/shapes',
    parentSlug: 'shapes',
  },
  {
    slug: 'layout-cleanup',
    title: 'Layout Cleanup',
    description: 'Auto-align to a grid or auto-layout the whole tab, from the command palette.',
    keywords: 'tidy align arrange auto grid organise organize straighten',
    category: 'Tools',
    categorySlug: 'tools',
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
    group: 'Text and Notes',
  },
  {
    slug: 'layer-order',
    title: 'Layer Order and Opacity',
    description: 'Send elements to the front or back layer, and fade them with opacity.',
    keywords:
      'transparency transparent translucent alpha fade see through bring to front send to back stacking z index overlap behind above',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Layers and Locking',
  },
  {
    slug: 'size',
    title: 'Size',
    description: 'Type an exact width and height, lock the ratio, or reset a stretched shape.',
    keywords:
      'size width height dimensions exact pixels px resize scale bigger smaller aspect ratio lock proportion square stretch squash reset match',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'rotation',
    title: 'Rotating Elements',
    description:
      'Snap an element to a preset 45° angle from the right-click menu or search palette.',
    keywords: 'rotate turn angle spin degrees tilt flip orientation',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'animations',
    title: 'Animating Elements',
    description: 'Animate shapes, text, notes, drawings, media, tables, arrows, and icons.',
    keywords:
      'animate animation motion pulse loop effects moving flow wiggle typewriter typing reveal text words cascade highlight underline flutter sticky draw trace ken burns zoom pan photo table rows',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'shadows',
    title: 'Element Shadows',
    description: 'Lift an element with a drop shadow: five presets plus offset/blur sliders.',
    keywords: 'shadow drop depth elevation blur offset lift float soft hard card 3d shade video',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'finish',
    title: 'Choosing a Finish',
    description:
      'Draw a tab or an element Flexible, Professional, hand-drawn Sketch or bold Marker.',
    keywords:
      'finish sketch sketchy hand drawn handdrawn rough wobbly hatching professional crisp print clean flexible look style drawing marker felt tip sharpie flip chart bold ink',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'quick-style-panel',
    title: 'Quick Style Panel',
    description: 'Restyle a selection in one click; the next shape of that kind remembers it.',
    keywords:
      'quick style panel colour color stroke background fill width thickness dashed dotted flowing animated arrow align alignment icon remember memory next shape clear styles reset format custom swatch override picker hex brand highlighter highlight marker corners ink turn off disable settings',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'locking',
    title: 'Locking Elements',
    description: 'Protect an element from accidental moves, resizes, and deletion.',
    keywords: 'lock protect freeze prevent editing pin fixed immovable',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Layers and Locking',
  },
  {
    slug: 'element-indicators',
    title: 'Element Indicators',
    description:
      'The small icons that show an element has a link, a note, an action or comments, and how to set them to Top, Footer or Off.',
    keywords:
      'indicators indicator badges badge icons markers chip pip status metadata link note action comment comments count top footer off hide hidden tidy map settings editor color colour',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'undo',
    title: 'Undo',
    description: 'Step back your most recent change, with a keyboard shortcut and a button.',
    keywords:
      'ctrl z cmd z revert back mistake reverse cancel history 500 steps collaborator escape',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'redo',
    title: 'Redo',
    description: 'Re-apply a change you just undid.',
    keywords: 'ctrl y cmd shift z repeat restore forward again history',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'snapping',
    title: 'Alignment & Snapping',
    description:
      'Drag or resize to snap elements into line and match sizes; hold Cmd/Ctrl to place freely.',
    keywords:
      'snap align guides grid free placement override precise position resize size match equal spacing distribute alignment',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'colours-borders-opacity',
    title: 'Colours, Borders and Opacity',
    description:
      'Recolour text, background and border, style borders and corners, and fade elements.',
    keywords:
      'colour color fill background border outline stroke text colour ink reset to theme picker swatch custom colour hex eyedropper pipette strength thickness pattern dashed dotted radius corners rounded pill circle opacity transparency fade see-through',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },

  {
    slug: 'layers',
    title: 'Layers',
    description: 'Split a tab into stacking layers you can hide, lock, rename, and restack.',
    keywords: 'photoshop stack hide lock organise organize panel z order',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Layers and Locking',
  },
  {
    slug: 'layers-visibility-and-locking',
    title: 'Hiding, Locking, and Dimming Layers',
    description: 'Hide, lock, dim, or solo a whole layer, and preview one on hover.',
    keywords: 'show visibility solo preview toggle eye protect',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Layers and Locking',
    parentSlug: 'layers',
  },
  {
    slug: 'layers-organising',
    title: 'Organising and Merging Layers',
    description: 'Rename, restack, merge, clear, and move elements between layers.',
    keywords: 'organize rename reorder merge move clear manage',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Layers and Locking',
    parentSlug: 'layers',
  },
  // ---- Sub-articles: Canvas ----
  {
    slug: 'adding-elements',
    title: 'Adding Elements',
    description: 'Add elements from the palette or a single key, with a tap or drawn to size.',
    keywords: 'place insert drop create add double click new draw to size tap shortcut keyboard',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },
  {
    slug: 'pan-and-zoom',
    title: 'Panning and Zooming',
    description: 'Move around the infinite canvas and fit the view.',
    keywords:
      'navigate move scroll magnify fit view wheel pinch hand trackpad middle mouse space zoom in out percent',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },
  {
    slug: 'changing-the-background',
    title: 'Changing the Canvas Background',
    description: 'Pick a canvas pattern and colours in the Tab Style dialog.',
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
    description: 'Snap an arrow endpoint onto another arrow to branch or join a line.',
    keywords: 'sequence join connect endpoint attach branch',
    category: 'Palette',
    categorySlug: 'palette/arrows',
    parentSlug: 'arrows',
  },

  // ---- Sub-articles: Tools ----
  {
    slug: 'images',
    title: 'Images',
    description: 'Add images to the canvas by uploading, from your gallery, or by searching.',
    keywords:
      'picture photo upload png jpg insert logo screenshot search find stock free openverse creative commons licence license credit attribution',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'tables',
    title: 'Tables',
    description: 'An editable grid of cells for tabular content on the canvas.',
    keywords:
      'grid cells rows columns spreadsheet matrix data preset presets look looks style banded zebra striped header band recolour recolor',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'sticky-notes',
    title: 'Sticky Notes',
    description: 'A coloured note card for short annotations and brainstorm items.',
    keywords: 'postit post it note card brainstorm memo colored sticky colour color presets amber',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },
  {
    slug: 'code-blocks',
    title: 'Code Blocks',
    description: 'A monospace card with syntax-highlighted code snippets, in eight colour schemes.',
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
    description: 'Charts, legends, progress bars and rings, ratings, and timeline rails.',
    keywords:
      'chart progress bar ring rating star pie timeline graphs visualisation visualization donut meter',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },

  // ---- Sub-articles: Behaviour ----

  // ---- Sub-articles: Collaborate ----

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
  {
    slug: 'formatting-label-text',
    title: 'Formatting Label Text',
    description: 'Bold, headings, lists, alignment and per-word colour in a label, plus padding.',
    keywords:
      'bold italic underline strikethrough heading paragraph bullet numbered list block type alignment align vertical centre text colour word colour rich text toolbar padding font size format label',
    category: 'Canvas',
    categorySlug: 'canvas/text-and-fonts',
    parentSlug: 'text-and-fonts',
  },

  // ---- Sub-articles: Themes ----
  {
    slug: 'changing-theme',
    title: 'Changing the Theme',
    description: 'Open the Tab Style dialog and browse themes by category.',
    keywords:
      'apply browse switch restyle colours colors dialog pick paintbrush look feel looks finish filter flexible professional sketch marker spectrum mashup random surprise shuffle dice billboard patchwork coffeehouse schematic flipchart sketchbook greenboard picnic mural field notes aurora seasonal holiday christmas halloween easter new year snowflakes',
    category: 'Canvas',
    categorySlug: 'canvas/themes',
    parentSlug: 'themes',
  },
  {
    slug: 'multicolour-themes',
    title: 'Multicolour Themes',
    description: 'Tint each branch of a hierarchy its own hue.',
    keywords: 'multicolor rainbow branch hue tint colorful colourful',
    category: 'Canvas',
    categorySlug: 'canvas/themes',
    parentSlug: 'themes',
  },

  // ---- Sub-articles: Links ----

  // ---- Sub-articles: Teams ----
  {
    slug: 'roles-and-invites',
    title: 'Roles and Invites',
    description: 'Admin and Member roles, and inviting people by email.',
    keywords:
      'admin member permission email invite add people access decline reject rejected reminder expire expired',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },
  {
    slug: 'team-shared-documents',
    title: 'Team Shared Documents',
    description: 'A per-team folder tree every member can manage.',
    keywords: 'shared library folder team files workspace common diagrams',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },

  // ---- Sub-articles: Sharing ----
  {
    slug: 'share-passwords',
    title: 'Share Passwords',
    description: 'Guard every share link to a document with one password.',
    keywords: 'protect lock secure gate private restrict access remember',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'one-tab',
    title: 'Sharing One Tab',
    description: 'Scope a share link to one tab; the rest stays private.',
    keywords: 'single tab scope restrict part only page subset private hide limit share link',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'share-link-expiry',
    title: 'Share Link Expiry',
    description: 'Give a share link a lifetime so it stops working later.',
    keywords:
      'expire time limit temporary duration deadline revoke extend expired forever week month',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'embeds',
    title: 'Embeds',
    description: 'Drop a live document into another page, read-only or editable by link role.',
    keywords: 'iframe embed website notion confluence wiki blog integrate',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'live-image',
    title: 'Live Image',
    description:
      'An always-current image of a document, made from a share link, for READMEs and docs.',
    keywords: 'readme badge always current screenshot png url auto updating document',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },

  // ---- Sub-articles: Session Tools ----

  // ---- Sub-articles: Dot Voting ----

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
    description:
      'Column and bar charts from label and value rows, and line, area and scatter charts from a grid or a CSV import, each switchable to any chart type.',
    keywords:
      'graph series csv data plot axis columns trends bar chart line chart column chart area chart scatter chart scatter plot xy doughnut donut chart type',
    category: 'Palette',
    categorySlug: 'palette/tools/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'legend',
    title: 'Legend',
    description: 'A key of colour-coded rows to explain what your colours mean.',
    keywords: 'key colour code swatch label caption guide chart key colour key color key',
    category: 'Palette',
    categorySlug: 'palette/tools/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'timeline-rail',
    title: 'Timeline',
    description:
      'Milestones along a line, each with when and what, for roadmaps, plans and histories.',
    keywords:
      'timeline rail roadmap milestones dates when quarter sprint plan project phases schedule history journey concept',
    category: 'Palette',
    categorySlug: 'palette/concept-graphics',
    parentSlug: 'concept-graphics',
  },

  // ---- Sub-articles: Layout Cleanup ----
  {
    slug: 'auto-align',
    title: 'Auto-Align',
    description: 'Snap every element on the tab onto a 10 px grid.',
    keywords: 'grid tidy straighten arrange snap organise organize',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
  },
  {
    slug: 'auto-layout',
    title: 'Auto Layout',
    description: 'Tidy up the arrow graph in layers, as a tree, or radially.',
    keywords:
      'arrange layered flowchart tree radial mindmap tidy up automatic graph preview hover try before greyed out disabled already tidy route arrows',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
  },

  // ============ Search Panel (landing + sub-articles) ============
  {
    slug: 'the-search-panel',
    title: 'The Search Panel',
    description: 'Open the global search, what it covers, and how to navigate the results.',
    keywords:
      'find lookup global search everywhere quick open locate settings preferences help articles command palette',
    category: 'Search Panel',
    categorySlug: 'search-panel',
  },
  {
    slug: 'search-documents',
    title: 'Finding Documents',
    description: 'Search your documents by name, and where to search folders and shared items.',
    keywords: 'find lookup locate files library open document',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-teams',
    title: 'Searching Teams',
    description: 'Find the teams you belong to and open their libraries from the search panel.',
    keywords: 'find team shared folders lookup locate document',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-tabs-and-elements',
    title: 'Finding Tabs and Elements',
    description:
      'Inside a document, jump to any tab or element, including text inside table cells.',
    keywords: 'find jump locate text label shape page lookup',
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
    keywords: 'new page quick create add',
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
 * category's `groups` order, else the order each group first appears in {@link articles}. Used by the category
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
  // A category may fix its groups' order; a group it does not name keeps its place after the named ones.
  const order = categories.find((c) => c.slug === categorySlug)?.groups ?? [];
  const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : order.length);
  return groups.sort((a, b) => rank(a.group) - rank(b.group));
}

export function getSubArticles(parentSlug: string): Article[] {
  return articles.filter((a) => a.parentSlug === parentSlug);
}

/**
 * The articles matching `query` (case-insensitive, on title, description and keywords), best first: a title that
 * starts with the query, then a title with a word starting with it, then a title containing it, then a match in
 * the description, then one in the keywords alone, then (for a query of several words) an article holding every
 * word somewhere across the three, those with more of the words in the title first: "export png" finds Exporting
 * Diagrams. Registry order breaks ties.
 */
export function searchArticles(query: string): Article[] {
  const lower = query.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  // Ranks 5 and up: every word found across the three fields, fewer of them outside the title ranking higher.
  const rank = (a: Article): number => {
    const title = a.title.toLowerCase();
    if (title.startsWith(lower)) return 0;
    if (title.includes(` ${lower}`)) return 1;
    if (title.includes(lower)) return 2;
    if (a.description.toLowerCase().includes(lower)) return 3;
    if (a.keywords.toLowerCase().includes(lower)) return 4;
    if (words.length < 2) return -1;
    const hay = `${title} ${a.description} ${a.keywords}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return -1;
    return 5 + words.filter((w) => !title.includes(w)).length;
  };
  return articles
    .map((a) => ({ a, r: rank(a) }))
    .filter(({ r }) => r >= 0)
    .sort((x, y) => x.r - y.r)
    .map(({ a }) => a);
}
