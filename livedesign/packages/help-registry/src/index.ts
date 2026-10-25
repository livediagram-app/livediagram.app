// The help-centre article registry (docs/specs/018-help/help-app.md): the single source for the help
// app's search + category/browse listings AND the editor's search-panel "Help"
// group (docs/specs/008-canvas/canvas-and-palette.md + docs/specs/018-help/contextual-help-links.md). It lives in a shared package because the two
// consumers are separate builds: apps/help renders browse/search/breadcrumbs
// from it, and apps/live derives its searchable help catalogue from it
// (lib/help-search.ts), so every article is findable from the canvas without
// hand-maintaining a second list.
//
// Each article carries `keywords`: the words a user would actually type when
// they don't know the article's title ("transparency" for opacity, "hotkey"
// for keyboard shortcuts). Both search surfaces match on them.
//
// The catalogue is this product's; its shapes and the lookups over it (grouping, search) are
// @liveworkspace/help-registry's, bound to it below.

import { createHelpRegistry, type Article, type Category } from '@liveworkspace/help-registry';

export {
  articleHref,
  categoryHref,
  topCategorySlug,
  type Article,
  type Category,
} from '@liveworkspace/help-registry';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livedesign',
    description:
      'Get to know livedesign: what it is, who it helps, and the ideas behind a free, open canvas.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a blank page to a shared design in minutes, with the basics every new user needs.',
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
    articleCount: 9,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your designs are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livedesign REST API from your own scripts or the command line: authentication, worked examples, the CLI and developer tools, errors and limits, and the OpenAPI reference.',
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
      'How livedesign works on a computer, a tablet, and a phone, and what to expect on each.',
    articleCount: 3,
  },
  {
    slug: 'policies',
    title: 'Policies',
    description:
      "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
    articleCount: 1,
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
      'Design logos, wireframes and photos on pages, with backgrounds, presenting and exports.',
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
      'Organise everything you build: one library, shared by every liveworkspace app, that keeps your designs, folders, teams and images easy to find and manage.',
    articleCount: 13,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets and Imports'],
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette: Select, Hand, Eraser, Format Painter, Laser, Spotlight, Slide Deck, and Isometric.',
    articleCount: 8,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on a page: every element and palette setting explained.',
    articleCount: 21,
    kind: 'feature',
    groups: ['Everyday Elements', 'Page Blocks', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Work with what is on your pages: place, select, link, layer, rotate, animate, lock and theme elements, undo changes, and start from templates.',
    articleCount: 25,
    kind: 'feature',
    groups: ['Basics', 'Text and Notes', 'Styling Elements', 'Layers and Locking'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one design: organise, link, and move between tabs of pages.',
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
      'Do more with less effort using the editor helpers: zen mode, light and dark mode, and cleanup.',
    articleCount: 3,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any design, folder, team, tab, or element, and add new elements to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];

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
    description: 'Switch between the tabs in a design, add new ones, and group them into folders.',
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
      'settings preferences options config configure gear cog toggles panel opacity toolbar minimap welcome tour notifications toasts reduce motion animation accessibility telemetry anonymous usage events privacy sync account device per device defaults turn off keyboard shortcuts hotkeys keybindings ui scale element indicators badges dock position draw default folders where new designs go plan email api tokens trash delete',
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
    description: 'Rename the design, see who can see it, preview as a viewer, and Share or Copy.',
    keywords:
      'header top bar design name rename visibility private shared team public local only role pill editing viewing participating owner preview read only share copy make a copy account',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },

  // ---- About ----
  {
    slug: 'what-is-livedesign',
    title: 'What is livedesign?',
    description:
      'An overview of the real-time, multiplayer editor for logos, wireframes and photos.',
    keywords:
      'overview intro introduction about product logos wireframes photos photo editor presenting app',
    category: 'About livedesign',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'who-is-it-for',
    title: 'Who is livedesign For?',
    description: 'The teams and use cases that get the most out of livedesign.',
    keywords: 'audience use cases teams developers designers educators students',
    category: 'About livedesign',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'why-livedesign',
    title: 'Why Use livedesign?',
    description: 'Free, open source, no sign-in wall, real-time collaboration. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livedesign',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'what-is-open-source',
    title: 'What is Open Source?',
    description: 'What open source means, and what livedesign being MIT-licensed gives you.',
    keywords: 'mit license free code github oss public repository',
    category: 'About livedesign',
    categorySlug: 'about',
    parentSlug: 'about',
  },

  // ---- Getting Started ----
  {
    slug: 'your-first-design',
    title: 'Your First Design',
    description: 'From a new design to a first page you can share, in a couple of minutes.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding design page logo wireframe photo picture template location',
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
    slug: 'sharing-your-design',
    title: 'Sharing Your Design',
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
      'quick add search elements toolbar strip launcher categories dropdown popular selection mode tiles bands',
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
    description: 'Move elements between tabs, designs and windows through the system clipboard.',
    keywords:
      'copy paste cut clipboard cmd c cmd v cmd x ctrl c ctrl v ctrl x between designs diagrams another design another tab second window screenshot paste image offset reconnect arrows system clipboard',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'fast-theming',
    title: 'Restyle a Design Fast',
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
      'The liveworkspace guest identity that owns your designs when you are not signed in.',
    keywords:
      'anonymous browser guest id token identity owner without account liveworkspace redirect every app design',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'signing-in',
    title: 'Signing In',
    description: 'Create an account, sign in, and bring your guest designs with you.',
    keywords:
      'login log in sign up register email code google oauth account create migrate avatar initials',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'exporting-designs',
    title: 'Exporting Designs',
    description:
      'Take your pages with you as a PDF, images or a portable file, or embed a live view.',
    keywords:
      'export download png svg pdf logo kit image save picture screenshot json embed backup',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'deleting-your-data',
    title: 'Deleting Your Data',
    description: 'How to delete a design or your whole account, and what each removes.',
    keywords: 'delete remove erase gdpr clear account wipe forget close trash',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'trash',
    title: 'Trash',
    description: 'Deleted designs wait 30 days: restore one, or delete it for good.',
    keywords:
      'trash bin recycle deleted undo undelete restore recover get back permanently empty blank unused automatic automatically clean up cleanup thirty days',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'api-tokens',
    title: 'API Tokens',
    description: 'Create signed-in-only tokens to call the livedesign API from your own scripts.',
    keywords: 'token key programmatic rest scripts secret bearer automation',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'connect-ai-mcp',
    title: 'Connect an AI Tool (MCP)',
    description: 'Connect Claude or any MCP client to find, view, create, and edit your designs.',
    keywords:
      'claude chatgpt cursor model context protocol ai integration assistant llm connector trash restore pages logo wireframe photo read-only',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'ai-clients',
    title: 'Connecting AI Tools',
    description: 'Add livedesign to Claude, Claude Code, Cursor, ChatGPT or any MCP client',
    keywords:
      'mcp connector claude desktop claude code cursor chatgpt oauth bearer token setup remote server url',
    category: 'Account and Data',
    categorySlug: 'account-and-data/connect-ai-mcp',
    parentSlug: 'connect-ai-mcp',
  },
  {
    slug: 'google-drive',
    title: 'Google Drive',
    description: 'Keep a copy of your designs in your own Google Drive, synced both ways.',
    keywords:
      'google drive mirror sync backup copy cloud storage open with livedesign file folders liveworkspace',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
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
    title: 'The livedesign API',
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
    slug: 'working-with-designs',
    title: 'Working with Designs',
    description: 'Worked examples: list, read, create, and update designs, tabs, and folders.',
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
    categorySlug: 'developers/working-with-designs',
    parentSlug: 'working-with-designs',
  },
  {
    slug: 'images-and-pages',
    title: 'Images, Pages and More',
    description: 'API examples for images, pages, renders and copies.',
    keywords: 'images upload pages page logo wireframe photo render svg picture copy duplicate api',
    category: 'Developers',
    categorySlug: 'developers/working-with-designs',
    parentSlug: 'working-with-designs',
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
    title: 'The livedesign CLI',
    description:
      'Read, build, edit and discuss designs from a terminal: install, sign in, the commands, and profiles.',
    keywords:
      'cli command line terminal shell npm npx install agent coding agent script automation device code login sign in token keychain export pull push profile host',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'workbenches',
    title: 'Designs in Your Developer Tools',
    description:
      'Work on a design inside a developer tool beside your agent, and talk about what you select.',
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
    description: 'Where your designs live and how they are handled.',
    keywords: 'storage stored cloudflare security where data location safe',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'offline-mode',
    title: 'Offline Mode',
    description: 'Designs kept only in this browser, and moving them to your account.',
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

  // ---- Troubleshooting ----
  {
    slug: 'design-not-loading',
    title: 'A Design Will Not Load',
    description: 'What to check when a design is blank or stuck loading.',
    keywords:
      'blank stuck loading error broken empty spinner wont open 404 diagram opening taking longer than usual colleague works for others',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'repair-this-browser',
    title: 'Repair This Browser',
    description: 'Clear stuck settings and caches, keeping your designs.',
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
    description: 'Using livedesign on a tablet, and how a keyboard changes what you can do.',
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
    keywords: 'board workspace drawing area infinite surface whiteboard',
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
    slug: 'eraser',
    title: 'Eraser',
    description: 'Click or drag across elements to delete them quickly.',
    keywords: 'delete remove rub out erase clear wipe brush size filter drawings arrows sweep tap',
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
      'tools tab category where find text table chart sticky note image write components media data concepts devices icons stickers search panel slide wireframe logo moved',
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
      'badge badges pill label tag status version new beta count step number numbers numbered disc circle walkthrough order sequence 1 2 3 attach attached corner marker renumber play in order annotate annotation',
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
      'browser phone laptop wireframe mockup frame window screen monitor smartwatch watch tablet foldable fold unfolded desktop device pages',
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
    slug: 'frames',
    title: 'Frames',
    description: 'A labelled section that draws behind its contents and moves them as one.',
    keywords:
      'frame section container backdrop labelled box region area cluster move together carries contents behind resize outline f key figjam section export slide framing nest nested centre quick connect plus fill background',
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
    keywords:
      'polygon outline point by point straight edges shape draw logo vertex vertices close path',
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
    description: 'The palette strip across the top of the canvas, its More and its Search.',
    keywords:
      'toolbar strip top bar excalidraw panel layout floating palette compact menu button explorer more tiles recent recently used order reorder search find element per page kind slide wireframe logo',
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
    description: 'Start a design from a ready-made template instead of a blank page.',
    keywords:
      'template templates starter scaffold quick start prebuilt blank logo blank tab blank illustration empty page artboard wireframe phone tablet website laptop watch app logo design photo edit photo editor picture presentations search find a template start making pages recommended',
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
      'pages page sheet a4 blank page portrait landscape orientation size page size background logo wireframe photo design page kind first page choice navigator next page previous page backgrounds colour color gradient pattern dots grid lines theme dark page name rename duplicate move reorder drag delete add page snap margins margin fit resize scale split into pages contents sidebar find a page lock locked unlock padlock protect freeze read only page lock custom gradient photo background image background picture background photo overlay image overlay wash tint fade upload image title bar layout button background button carry over',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'logo-pages',
    title: 'Logo Pages',
    description:
      'Design a logo on a square artboard with guides, mirror, wordmarks, combined shapes and a logo kit.',
    keywords:
      'logo logos brand branding draw drawing pen bezier path freehand pencil sketch shape pen mark wordmark lettermark monogram icon favicon app icon avatar artboard guides keyline grid safe area symmetry mirror reflect flip radial rotational kaleidoscope four way horizontal vertical axis copies merge combine boolean union unite subtract intersect exclude merge shapes tracking letter spacing kerning arc curved text circle text badge emblem logo kit export png svg ico transparent',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
  },
  {
    slug: 'wireframe-pages',
    title: 'Wireframe Pages',
    description:
      'Wireframe a screen inside a phone, tablet, laptop, desktop, browser or watch frame, from ready-made screens.',
    keywords:
      'wireframe wireframes mockup mock up mockups prototype ui ux screen screens app design device frame phone iphone android mobile tablet ipad laptop desktop monitor browser website web page watch smartwatch status bar dynamic island notch home indicator landscape portrait safe area sign in login onboarding dashboard settings profile checkout pricing chat feed landing page button text field input search switch toggle placeholder',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
  },
  {
    slug: 'photo-pages',
    title: 'Photo Pages',
    description:
      'Edit pictures in a page: layers, masks, brushes, smart selections, healing, adjustments, filters and PSD.',
    keywords:
      'photo photos picture pictures image images photoshop paint net gimp edit editing editor retouch retouching layer layers mask masks blend blending mode opacity group clipping brush pencil eraser background eraser clone stamp heal healing spot heal red eye blemish remove object content aware fill gradient paint bucket fill blur sharpen smudge dodge burn sponge text shape crop straighten rotate flip resize resample image size canvas size select selection marquee lasso magnetic magic wand quick select subject remove background cutout transparent colour range color range feather adjust adjustment levels curves exposure brightness contrast hue saturation vibrance colour balance color balance white balance temperature black and white monochrome photo filter channel mixer selective colour gradient map invert posterize threshold shadows highlights filter filters gaussian motion radial lens tilt shift bokeh unsharp mask noise grain median emboss oil paint pixelate mosaic halftone distort twirl pinch spherize wave ripple polar clouds vignette lens flare clarity dehaze histogram psd png jpeg jpg webp export layers as files',
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
      'pages tour tour walkthrough onboarding intro introduction getting started guide tutorial first time learn pages page name cog page settings layout background add page present presentation logo wireframe show me replay rerun settings accessibility photo photos',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'exporting-pages',
    title: 'Exporting and Presenting Pages',
    description:
      'Every page or one page as a PDF, PNG or SVG, a logo kit or a photo, and presenting your pages.',
    keywords:
      'export download pdf png svg image zip all pages one page import json print printable pages page pages present presentation slide deck from pages deck button hide in slides show in slides notes logo kit photo jpeg webp psd',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'tab-windows',
    title: 'Tab Windows',
    description: 'Another tab, live, fitted inside a page.',
    keywords:
      'tab window windows live view embed mirror show another tab on a page reference up to date stale copy paste sync linked picture choose a tab open',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
  },
  {
    slug: 'using-tabs',
    title: 'Tabs',
    description:
      'Multiple tabs of pages in one design: add, name, reorder, and switch between them.',
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
      'Turn an element into a jump point to another tab, another design, or a web address.',
    keywords: 'jump navigation cross reference hyperlink go to connect boards',
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
    keywords: 'read only protect freeze prevent editing lock board unlock padlock',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'add-to-design',
    title: 'Add a Tab to Another Design',
    description: 'Add the active tab to another design you own; both share the same live tab.',
    keywords: 'reuse share tab sync across designs diagrams move copy live',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'import-tabs',
    title: 'Importing a Tab',
    description:
      'Import a livedesign JSON tab export into a tab by pasting text or picking a file.',
    keywords:
      'import json file files paste upload load restore backup copy clipboard replace tab export round trip',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'export-tabs',
    title: 'Exporting a Tab',
    description: "Export a tab's pages as PDF, PNG or SVG, or as JSON.",
    keywords: 'export download save png svg pdf json image picture pages logo kit',
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
      'Make a shape, text, sticky note, image or table a link to another tab, design or the web.',
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
      "The full-page library every liveworkspace app shares: Designs or All Apps, the sidebar's Overview, Spaces and More, views and search.",
    keywords:
      'library home dashboard files my designs list manage browse sidebar overview spaces more keyboard navigation tree search all apps every app filter canvases liveworkspace duplicate copy design',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'explorer-panel',
    title: 'Explorer Panel',
    description:
      'The compact in-editor Explorer: a rail of sections beside a list, opening designs in place.',
    keywords:
      'sidebar rail switch designs library in editor menu button hamburger popover open explorer every app new share export github',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'list-and-card-views',
    title: 'List, Card and Details Views',
    description:
      'Toggle browse views between preview cards, compact rows and a sortable details table.',
    keywords:
      'card grid view toggle layout rows tiles gallery details table columns sort type comments access size created updated date',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'timeline',
    title: 'Home',
    description:
      'The Explorer\u2019s landing view and the Timeline: what you use most and last, what was shared with you recently, and what happened.',
    keywords:
      'home jump back in within reach most used last used recent see more grid strip return often what happened others teammates summary expand see timeline timeline all activity landing start feed activity history what happened whats new latest events log stream notifications updates recent changes calendar month view upcoming expiring stacked grouped collapse day colour color red amber green deleted preview thumbnail card cards grid menu ellipsis rename move duplicate created updated unread unseen new badge since last visit who did what other people filter local time remove dismiss hide clutter tidy clean up refresh live update revoke token accept decline invite leave team edit theme share',
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
      'activity inbox to do todo tasks my actions assigned to me assigned by me outstanding waiting open threads unresolved comments replies mentions pending work queue what needs me badge count all apps all designs local only offline this browser',
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
      'history last opened latest previously recently opened folder location where filed chip owner hide from recent show in recent exclude remove clutter twelve design',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'shared-with-you',
    title: 'Shared With Me',
    description: 'Items other people have shared with you through a link, collected in one place.',
    keywords:
      'shared with me received from others incoming shares links collaborations remove dismiss role owner design',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'folders',
    title: 'Folders',
    description: 'Group designs into a nestable tree, and move them between folders.',
    keywords: 'organise organize directory nest move tree group files',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'default-folders',
    title: 'Default Folders',
    description: 'Send new designs to a folder you choose instead of My Work.',
    keywords:
      'default folder where new designs go automatic placement file use as default settings designs new design',
    category: 'Explorer',
    categorySlug: 'explorer/folders',
    parentSlug: 'folders',
  },
  {
    slug: 'filters',
    title: 'Search and Filter Designs',
    description:
      'Narrow any design list with words, chips or typed filters like made-by:ai, and share it as a link.',
    keywords:
      'search find filter filters chips pill pills narrow refine query token tokens opens in made by ai generated edited date last week recent people me others owner space team shared folder name subfolders lens results clear design',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'personal-space',
    title: 'My Work and Folders',
    description: 'Your own library: the folders you create, your unfiled items and Favourites.',
    keywords:
      'my designs personal space library my work your designs your diagrams own files root folder organise organize unsorted unfiled made by ai generated favourite favorite star starred bookmark pin quick access',
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
    description: 'Invite members, assign roles, and share designs across a team.',
    keywords: 'workspace organisation organization members invite group company',
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
    description: 'Set livedesign to light, dark, or your device setting, everywhere at once.',
    keywords:
      'night theme appearance dark light system os device switch toggle cycle eyes mode website help header',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'style-presets',
    title: 'Style Presets',
    description: 'One-click colour and line-style variations for shapes and arrows.',
    keywords:
      'preset presets style styles variation variations colour color line style dashed dotted quick look one click restyle',
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
      'finish sketch sketchy hand drawn handdrawn whiteboard rough wobbly hatching professional crisp print clean flexible look style drawing marker felt tip sharpie flip chart bold ink',
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
    slug: 'annotations',
    title: 'Annotations',
    description: 'Drop a marker with a note that readers hover to read.',
    keywords: 'note marker callout tooltip pin footnote comment hover rich text formatting',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Text and Notes',
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
    slug: 'team-shared-designs',
    title: 'Team Shared Designs',
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
    description: 'Guard every share link to a design with one password.',
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
    description: 'Drop a live design into another page, read-only or editable by link role.',
    keywords: 'iframe embed website notion confluence wiki blog integrate',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'live-image',
    title: 'Live Image',
    description: 'Copy an always-current image of a design for READMEs and docs.',
    keywords: 'readme badge always current screenshot png url auto updating',
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
    description: 'Tidy Up the arrow graph as a flowchart, tree, or mindmap.',
    keywords:
      'arrange flowchart tree mindmap tidy up automatic graph preview hover try before greyed out disabled already tidy lanes swimlane route arrows',
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
    slug: 'search-designs',
    title: 'Finding Designs and Folders',
    description: 'Search across your designs, folders, and the designs shared with you.',
    keywords: 'find lookup locate files library open diagrams',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-teams',
    title: 'Searching Teams',
    description: 'Find teams and their shared folders and designs from the search panel.',
    keywords: 'find team shared folders lookup locate',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-tabs-and-elements',
    title: 'Finding Tabs and Elements',
    description: 'Inside a design, jump to any tab or element, including text inside table cells.',
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

// The lookups the help app and the editor's search read, over this catalogue.
export const {
  featureCategories,
  getArticlesByCategory,
  getCategoryGroups,
  getSubArticles,
  searchArticles,
} = createHelpRegistry(categories, articles);
