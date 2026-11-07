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
    title: 'About livehuddle',
    description:
      'Get to know livehuddle: a free, open-source place where a team meets in a Space, and who it is for.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a new Space to a team meeting in it in minutes, with the basics every new user needs.',
    articleCount: 6,
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
      'Stay in control of your work: how guest access, signing in, syncing, exporting, deletion, API tokens, the Google Drive mirror, and email notifications work.',
    articleCount: 8,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your spaces are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livehuddle REST API from your own scripts: authentication, worked examples, errors and limits, and the OpenAPI reference.',
    articleCount: 6,
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
      'How livehuddle works on a computer, a tablet, and a phone, and what to expect on each.',
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
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editor: the panels, toolbar, context menus, the Map, zoom and tab bars, and quick controls.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: how the Explorer keeps your spaces, folders, teams, and assets easy to find and manage.',
    articleCount: 13,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets'],
  },
  {
    slug: 'selection-modes',
    title: 'Edit or Walk',
    description:
      'The Edit | Walk toggle at the start of the palette: build the board, or walk it as your character, and the Format Painter.',
    articleCount: 4,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on the canvas: every element and palette setting explained.',
    articleCount: 15,
    kind: 'feature',
    groups: ['Everyday Elements', 'Meeting Kits', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Master the infinite canvas: place, select, link, add notes to, rotate, animate, lock and theme elements, undo changes, and start from templates.',
    articleCount: 19,
    kind: 'feature',
    groups: ['Basics', 'Text and Notes', 'Styling Elements'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one canvas: organise, link, and move between multiple boards with tabs.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, calls, teams, sharing, and session tools.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: light and dark mode, and cleanup.',
    articleCount: 2,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any canvas, folder, team, tab, or element, and add new elements to the canvas.',
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
    description: 'Switch between the boards in a space, add new ones, and group them into folders.',
    keywords: 'tabs boards pages switch bottom bar sheets add rename document',
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
      'settings preferences options config configure gear cog toggles panel opacity toolbar minimap welcome tour notifications toasts reduce motion animation accessibility ai assistant telemetry anonymous usage events privacy sync account device per device defaults turn off keyboard shortcuts hotkeys keybindings ui scale element indicators badges dock position draw default folders where new documents go email api tokens trash delete canvas space spaces',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },

  {
    slug: 'title-bar',
    title: 'The Title Bar',
    description: 'Rename the canvas, see who can see it, preview as a viewer, and Share or Copy.',
    keywords:
      'header top bar document name rename visibility private shared team public local only role pill editing viewing participating owner preview read only share copy make a copy account canvas untitled auto name automatic name named after first label site switcher logo',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },

  // ---- About ----
  {
    slug: 'what-is-livehuddle',
    title: 'What is livehuddle?',
    description:
      'An overview of livehuddle, the shared Spaces a team walks into as characters to meet.',
    keywords:
      'overview intro introduction about product meet meeting virtual office space avatar app',
    category: 'About livehuddle',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'who-is-it-for',
    title: 'Who is livehuddle For?',
    description: 'The teams, hosts and communities that get the most out of meeting in a Space.',
    keywords: 'audience use cases teams remote hybrid stand-up all-hands community events hosts',
    category: 'About livehuddle',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'why-livehuddle',
    title: 'Why Use livehuddle?',
    description: 'Free, open source, no sign-in wall, and everyone in the room live. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livehuddle',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'what-is-open-source',
    title: 'What is Open Source?',
    description: 'What open source means, and what livehuddle being MIT-licensed gives you.',
    keywords: 'mit license free code github oss public repository',
    category: 'About livehuddle',
    categorySlug: 'about',
    parentSlug: 'about',
  },

  // ---- Getting Started ----
  {
    slug: 'your-first-space',
    title: 'Your First Space',
    description: 'Open a Space, walk in as your character, say hello and invite your team.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding wizard document template location canvas space spaces',
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
    slug: 'sharing-your-document',
    title: 'Sharing Your Space',
    description: 'Hand a link to anyone and meet in the same Space in real time.',
    keywords: 'share link collaborate invite send url realtime together meet space document',
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
      'hotkey hotkeys keybinding cheat sheet reference keys bindings number numbers digit digits tool row excalidraw muscle memory single key letter settings keyboard category disable all',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'command-palette',
    title: 'The Palette',
    description:
      'Switch between Edit and Walk and add sticky notes, text, rooms and more from the palette strip.',
    keywords:
      'quick add search elements toolbar strip launcher categories dropdown popular edit walk toggle tiles bands',
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
    description: 'Move elements between tabs, spaces and windows through the system clipboard.',
    keywords:
      'copy paste cut clipboard cmd c cmd v cmd x ctrl c ctrl v ctrl x between documents diagrams another document another tab second window screenshot paste image offset reconnect arrows system clipboard canvas space spaces',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'fast-theming',
    title: 'Restyle a Board Fast',
    description: 'Restyle an entire board in seconds with themes and presets.',
    keywords: 'restyle recolour recolor colors colours presets scheme',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },

  // ---- Account and Data ----
  {
    slug: 'guest-identity',
    title: 'How Guest Identity Works',
    description: 'The per-browser id that owns your spaces when you are not signed in.',
    keywords: 'anonymous browser id localstorage owner identity without account document',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'signing-in',
    title: 'Signing In',
    description: 'Create an account, sign in, and migrate your guest spaces.',
    keywords:
      'login log in sign up register email code google oauth account create migrate avatar initials document',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'exporting-spaces',
    title: 'Exporting Spaces',
    description: 'Get a tab out as an image, a PDF or a portable file, or embed a live view.',
    keywords:
      'export download png svg pdf image save picture screenshot json markdown embed backup',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'deleting-your-data',
    title: 'Deleting Your Data',
    description: 'How to delete a space or your whole account, and what each removes.',
    keywords: 'delete remove erase gdpr clear account wipe forget close trash document',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'trash',
    title: 'Trash',
    description: 'Deleted spaces wait 30 days: restore one, or delete it for good.',
    keywords:
      'trash bin recycle deleted undo undelete restore recover get back permanently empty blank unused automatic automatically clean up cleanup thirty days document',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'api-tokens',
    title: 'API Tokens',
    description: 'Create signed-in-only tokens to call the livehuddle API from your own scripts.',
    keywords: 'token key programmatic rest scripts secret bearer automation',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },

  {
    slug: 'google-drive',
    title: 'Google Drive',
    description: 'Sync My Work to your own Google Drive, both ways.',
    keywords:
      'google drive mirror sync backup copy cloud storage open with livehuddle file folders',
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
    title: 'The livehuddle API',
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
    title: 'Working with Spaces',
    description: 'Worked examples: list, read, create, and update spaces, tabs, and folders.',
    keywords:
      'examples curl crud create update list read api requests diagrams outline view text agent document',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'edit-operations',
    title: 'Edit Operations Reference',
    description: 'Every changeset operation, selector, placement, flag and lint finding.',
    keywords:
      'changeset edit operations ops line form json selector placement flags lint findings vocabulary agent',
    category: 'Developers',
    categorySlug: 'developers/working-with-documents',
    parentSlug: 'working-with-documents',
  },
  {
    slug: 'images-and-copies',
    title: 'Images, Copies and Libraries',
    description: 'API examples for images, tab pictures, copies and shape libraries.',
    keywords: 'images upload gallery render svg picture png copy duplicate shape libraries api',
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
    slug: 'agent-changes',
    title: "Reviewing and Undoing an Agent's Changes",
    description: 'See what an agent or a script changed, and undo it for 30 days',
    keywords:
      'changeset changesets undo revert agent ai script history review rollback toast kept diff',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'agent-comments-presence',
    title: 'Comments and Presence for Agents',
    description: 'Reply to and resolve comments, and show what your agent is doing.',
    keywords:
      'agent comments reply resolve reopen threads presence status focus ring card comments api script bot',
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
    description: 'Where your spaces live and how they are handled.',
    keywords: 'storage stored cloudflare security where data location safe document',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'offline-mode',
    title: 'Offline Mode',
    description: 'Save a space only in this browser, and move it to or from your account.',
    keywords:
      'local only pill this browser private no sync device localstorage disconnect save location clear site data lost guest default start move to account after sign in share upload document',
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
    description: 'Passwords and expiry for the links you hand out.',
    keywords:
      'password protect expire lock secure links safety access pass expiry extend revoke participant editor',
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
    slug: 'document-not-loading',
    title: 'A Space Will Not Load',
    description: 'What to check when a space is blank or stuck loading.',
    keywords:
      'blank stuck loading error broken empty spinner wont open 404 diagram opening taking longer than usual colleague works for others document',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'repair-this-browser',
    title: 'Repair This Browser',
    description: 'Clear stuck settings and caches, keeping your spaces.',
    keywords:
      'reset clear cache cookies local storage stuck loading fix diagnostics support repair browser data document',
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
    description: 'Using livehuddle on a tablet, and how a keyboard changes what you can do.',
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
  // ---- Edit or Walk (the selection-modes category: the palette's Edit | Walk toggle) ----
  {
    slug: 'select',
    title: 'Edit and Walk',
    description:
      'The Edit | Walk toggle: select and build in Edit, walk as your character in Walk.',
    keywords:
      'edit walk toggle switch pointer cursor arrow select default mode click marquee shift build footprints avatar character pan hand space drag trackpad middle click delete remove erase eraser backspace selection mode tool picker',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'format-painter',
    title: 'Format Painter',
    description: "Copy one element's style from the selection toolbar and paint it onto others.",
    keywords:
      'copy style clone look paste formatting appearance brush selection toolbar paint match',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'avatar-mode',
    title: 'Avatar Mode',
    description: 'Walk a pixel character around the canvas while you talk through it.',
    keywords:
      'walk walking character habbo person figure sprite avatar presentation present tour narrate arrow keys steer jump hop flag wave space male female right-click read-only customise customize panel gender clothing hair size outfit hoodie suit dress ponytail bald tall small speech bubble message say talk chat enter send words float avatar button status available focusing busy meeting away headphones do not disturb need help question lunch sandwich angry steam ears celebrating party hat confetti thinking thought bubble sick ice pack mood change tab switch tab leave avatar mode',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes',
  },
  {
    slug: 'avatar-tour',
    title: 'The Avatar Tour',
    description:
      'A short, optional walkthrough of Avatar mode, offered the first time you walk as an avatar and replayable from Settings.',
    keywords:
      'avatar tour walkthrough onboarding intro introduction getting started guide tutorial first time learn character walk dress outfit hair behaviour reactions speech bubble message say talk chat push shove replay rerun settings',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes/avatar-mode',
    parentSlug: 'avatar-mode',
  },
  {
    slug: 'walking-together',
    title: 'Walking Together',
    description: "Everyone on a shared space sees everyone else's walking character.",
    keywords:
      'multiplayer together shared collaborate collaboration peers others everyone realtime real-time avatars characters names colour color presence document',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes',
    parentSlug: 'avatar-mode',
  },
  // ---- Palette landings: Elements ----
  {
    slug: 'tools',
    title: 'Where each tool lives',
    description: 'A map of the palette categories and which elements are in each.',
    keywords:
      'tools tab category categories where find text sticky note portal chair room meeting table walk in sticker write travel seating rooms amenities navigate selection mode moved',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'write',
    title: 'Write Elements',
    description: 'Text and Sticky note: the elements made of words.',
    keywords:
      'write writing text words wordy prose label caption title heading sticky note post-it remark copy typing type compose',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
  },
  {
    slug: 'chairs',
    title: 'Chairs',
    description: 'Chairs, desks and sofas for Avatar mode: walk a character in and it sits down.',
    keywords:
      'chair chairs seat seating sit sitting sat furniture avatar character walk stand table room seating plan attendance behaviour navigate facing up desk desks computer monitor screen office workstation sofa sofas couch settee loveseat two seater',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'fences',
    title: 'Fences',
    description: 'A barrier for Avatar mode: characters cannot walk through a fence.',
    keywords:
      'fence fences barrier wall block blocked keep out enclosure boundary pen gate avatar character walk collision no entry area navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'avatar-pads',
    title: 'Avatar Pads',
    description: 'Where everyone starts in Avatar mode: characters beam in on the pad.',
    keywords:
      'avatar pad pads spawn start starting point entrance arrive arrival teleport teleporter beam lobby welcome where do people appear avatar character walk navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'directory',
    title: 'Directory',
    description: 'Every room in the space and who is in each, with Walk There and Go.',
    keywords:
      'directory kiosk lobby board map wayfinding rooms room list who is where people find someone go to walk there jump travel floor tab avatar navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'elevator',
    title: 'Elevator',
    description: "A lift between a space's tabs: pick a floor and step out of its Elevator.",
    keywords:
      'elevator lift floor floors level levels tab tabs building up down ride travel go between tabs portal automatic avatar navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'screen',
    title: 'Screen',
    description:
      'A wall screen that shows a screen share from someone in its room, or a video link.',
    keywords:
      'screen tv television monitor display wall screen share sharing presentation present video youtube vimeo loom meeting room open large call avatar behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'room-sign',
    title: 'Room Sign',
    description: "A sign by a room's door: Free, In Use or Do Not Disturb, with a Knock button.",
    keywords:
      'room sign door sign plaque free busy in use occupied engaged vacant do not disturb knock knocking let in not now meeting room office pod avatar behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'virtual-office',
    title: 'Virtual Office',
    description:
      'Rooms of any shape, room types, corridors, sliding, revolving and locked doors, a stage, an office pod, a meeting table, bean bags and a reading nook, a bar, a garden, a recreation corner, a vending machine, a kitchenette, a restroom, a printer, a copier, lockers, a coat rack, a notice board, world clocks, a calendar wall, a suggestion box, a team photo wall, a signpost, stage curtains and a podium, a phone booth, a nap pod, a reception desk with a bell, hot desks, standing desks, a treadmill, a weight bench, an office dog, pillars and columns, a swimming pool, a car park, a bike rack, plants, shelves, drinks and rugs for Avatar mode.',
    keywords:
      'virtual office room rooms room types presets boardroom open plan lounge corridor corridors hallway hall junction crossroads sliding door revolving door double door locked door padlock persian kilim runner doormat striped rug round rug room builder custom shape l-shaped 45 degree angle draw walls corners door doors doorway stage platform office pod booth meeting table conference plant bookshelf books water cooler coffee machine drink cup rug carpet kitchen lounge reception bar stool drinks cabinet fridge juice soda garden tree outdoor plant path stepping stones grass lawn turf picket fence bench picnic table hammock umbrella parasol fountain pond campfire fireplace fire notice board cork pin note notes world clock time zone timezone jukebox music radio stream ping pong ping-pong table tennis pool table snooker billiards foosball table football darts dartboard vending machine snacks printer copier photocopier lockers coat rack coat hook umbrella stand kitchenette kitchen counter sink fridge refrigerator microwave kettle restroom toilet bathroom washroom wc cubicle washbasin basin mirror hand dryer stage curtains drapes podium lectern pillar column swimming pool car park parking bike rack bicycle bean bag beanbag reading nook armchair lamp breakout arcade game recreation phone booth call busy nap pod sleep rest focus reception front desk bell ring welcome hot desk hotdesk standing desk treadmill gym weight bench workout break pet dog pet bed pat calendar wall planner month dates suggestion box ideas anonymous feedback signpost sign post arrows directions team photo wall photos portraits frames team avatar walk sit navigate',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
  },
  {
    slug: 'behaviour',
    title: 'Meeting Elements',
    description:
      'The elements a Space is built from: the Travel, Seats, Rooms and Perks pieces people walk round, Bring Focus and the Avatar button.',
    keywords:
      'behaviour behavior behaviours behaviors interactive button portal mode switch walk in chair seat desk sofa couch fence barrier link card bookmark bring focus look here attention gather meeting travel seating rooms amenities navigate selection mode',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
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
  // ---- Palette landings: Palette Settings ----
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
    slug: 'toolbar-layout',
    title: 'Toolbar Layout',
    description: 'The palette strip across the top of the canvas, its More and its Search.',
    keywords:
      'toolbar strip top bar excalidraw panel layout floating palette compact menu button explorer more tiles recent recently used order reorder search find element',
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
    description: 'Start a Space from Blank Space or one of the ten ready-made Spaces.',
    keywords:
      'virtual office office rooms coworking cowork team pod all hands town hall auditorium starter prebuilt scaffold quick start new wizard blank space blank slate meetings virtual spaces',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Basics',
  },
  {
    slug: 'using-tabs',
    title: 'Tabs',
    description: 'Multiple tabs in one canvas: add, name, reorder, and switch between them.',
    keywords:
      'boards pages multiple sheets add rename reorder switch delete duplicate tab menu new tab quick start document',
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
      'Turn an element into a jump point to another tab, another space, or a web address.',
    keywords: 'jump navigation cross reference hyperlink go to connect boards document',
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
    slug: 'add-to-document',
    title: 'Add a Tab to Another Space',
    description: 'Add the active tab to another space you own; both share the same live tab.',
    keywords: 'reuse share tab sync across documents diagrams move copy live canvas space spaces',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'import-tabs',
    title: 'Importing a Tab',
    description:
      'Import a livehuddle tab export (JSON), pasted or picked as a file, into the active tab to restore a backup or move a tab between spaces.',
    keywords:
      'import json file files paste upload load restore backup move tab export image images picture photo gallery placeholder replace undo space spaces',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'export-tabs',
    title: 'Exporting a Tab',
    description:
      'Export the active tab or a selection as JSON, a Markdown outline, PNG, SVG, or PDF: copy the text formats or set image options.',
    keywords: 'export download save png svg pdf gif animated json markdown image picture',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'tab-cleanup',
    title: 'Cleaning Up a Tab',
    description: 'Tidy a tab in one press: snap its notes and pictures onto a tidy grid.',
    keywords: 'tidy auto layout snap grid arrange organise organize align command palette cleanup',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'comments',
    title: 'Comments',
    description: 'Leave threaded comments on the canvas and resolve them.',
    keywords:
      'thread feedback reply resolve discussion note annotate mention reaction reactions react emoji thumbs up like heart hooray eyes laugh',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'facilitator',
    title: 'Facilitator',
    description: 'Give one person Bring Focus and the room for a live meeting.',
    keywords:
      'facilitator workshop host run the room session lead moderator driver baton timer poll control handover take over step down chair meeting workshop',
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
    slug: 'proximity-audio',
    title: 'Proximity Audio',
    description: 'Talk with the people your character is near, and see who is talking further off.',
    keywords:
      'audio voice call calls talk talking speak speaker microphone mic mute unmute listen listen in join audio leave proximity nearby earshot hearing headphones equaliser equalizer bars walk over muted blocked nobody near huddle raise hand lower hand let speak stage do not disturb dnd',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'cameras-and-screen-sharing',
    title: 'Cameras and Screen Sharing',
    description: 'Turn on your camera or share a screen in a bubble above your character.',
    keywords:
      'camera video webcam face screen share sharing present presenting window tab bubble maximise maximize restore stop sharing video paused call calls',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'links',
    title: 'Links',
    description: 'Link elements across tabs, spaces or URLs, and follow them.',
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
      "The full-page library every liveworkspace app shares: Spaces or All Apps, the sidebar's Overview, Spaces and More, views and search.",
    keywords:
      'library home dashboard files my documents my diagrams list manage browse sidebar overview spaces more keyboard navigation tree canvas space spaces',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'explorer-panel',
    title: 'Explorer Panel',
    description:
      'The compact in-editor Explorer: a rail of sections beside a list, opening spaces in place.',
    keywords:
      'sidebar overview spaces more tree keyboard switch documents diagrams files library in editor menu button hamburger popover open more menu new share export github canvas space spaces',
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
      'card grid view toggle thumbnail preview snapshot layout rows tiles gallery details table columns sort type mode comments access permission size objects created updated date',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'timeline',
    title: 'Home',
    description:
      'The Explorer\u2019s landing view and the Timeline: what you use most and last, and what happened.',
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
      'activity inbox to do todo tasks my actions assigned to me assigned by me outstanding waiting open threads unresolved comments replies pending work queue what needs me badge count cross document all documents cross diagram all diagrams local only offline this browser canvas space spaces',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'recent',
    title: 'Recent Spaces',
    description:
      'Everything you can open, by when you last opened it, across every folder, team and share.',
    keywords:
      'history last opened latest edited previously hide exclude remove clutter show restore visible folder location where filed root breadcrumb diagrams filter newest twelve document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'shared-with-you',
    title: 'Shared With Me',
    description: 'Spaces other people have shared with you, collected in one place.',
    keywords:
      'shared with me received from others incoming shares collaborations dismiss role owner document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'folders',
    title: 'Folders',
    description: 'Group spaces into a nestable tree, and move them between folders.',
    keywords: 'organise organize directory nest move tree group files document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'default-folders',
    title: 'Default Folders',
    description: 'Choose the folder new spaces land in automatically.',
    keywords:
      'default folder where new documents go automatic placement file use as default settings documents new space wizard canvas space spaces',
    category: 'Explorer',
    categorySlug: 'explorer/folders',
    parentSlug: 'folders',
  },
  {
    slug: 'filters',
    title: 'Search and Filter Spaces',
    description:
      'Narrow any canvas list with words, chips or typed filters like made-by:ai, and share it as a link.',
    keywords:
      'search find filter filters chips narrow refine query token tokens made by ai generated opens in kind template edited date last week recent people me others owner space team shared unfiled root lens results pages document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'personal-space',
    title: 'My Work and Folders',
    description: 'Your own library: the folders you create, and your unfiled spaces at its root.',
    keywords:
      'my documents personal space library my work your documents your diagrams own files root folder organise organize unsorted unfiled made by ai generated favourite favorite star starred bookmark pin quick access canvas space spaces',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'team-spaces',
    title: 'Team Spaces',
    description: 'Each team as a space beside My Work, its shared folders, and your invites.',
    keywords: 'teams team spaces shared workspace invites membership group new team',
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
    group: 'Assets',
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
    description: 'Invite members, assign roles, and share spaces across a team.',
    keywords: 'workspace organisation organization members invite group company document',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'sharing',
    title: 'Sharing and Embeds',
    description: 'Share links, passwords, expiry, embeds, and live images.',
    keywords:
      'share link collaborate invite embed read only publish url send pass role participant editor legacy viewer',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    // The slug stays 'dark-mode': it is a public URL, and "dark mode" is still
    // what a reader searches for even though the control is now three-way.
    slug: 'dark-mode',
    title: 'Appearance: Light, Dark, System',
    description: 'Set livehuddle to light, dark, or your device setting, everywhere at once.',
    keywords:
      'night theme appearance dark light system os device switch toggle cycle eyes mode website help header',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'session-tools',
    title: 'Session Tools',
    description: 'A shared Timer or Stopwatch in the room, for running a meeting to time.',
    keywords: 'timer meeting facilitation countdown stopwatch timebox clock room piece',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'layout-cleanup',
    title: 'Layout Cleanup',
    description: 'Tidy Up: snap notes and pictures onto the grid in one press.',
    keywords: 'tidy up align arrange auto grid organise organize straighten neat auto layout broom',
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
    description: 'Animate sticky notes, text, link cards, pictures and icons.',
    keywords:
      'animate animation motion pulse loop effects moving flow wiggle typewriter typing reveal text words cascade highlight underline flutter sticky draw trace ken burns zoom pan photo table rows',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'shadows',
    title: 'Element Shadows',
    description:
      'Lift an element with a drop shadow: None or four presets, plus offset/blur sliders.',
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
    slug: 'locking',
    title: 'Locking Elements',
    description: 'Protect an element from accidental moves, resizes, and deletion.',
    keywords: 'lock protect freeze prevent editing pin fixed immovable',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Styling Elements',
  },
  {
    slug: 'element-indicators',
    title: 'Element Indicators',
    description:
      'The small icons that show an element has a link, a note, an action or comments, and how to set them to Top, Footer or Off.',
    keywords:
      'indicators indicator badges badge icons markers chip pip status metadata link note action comment comments count top footer off hide hidden settings editor color colour',
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
    description: 'Lay the Space on a floor and pick its colour in the Tab Style dialog.',
    keywords:
      'backdrop floor floors carpet carpet tiles wood parquet tiles marble terrazzo concrete decking paving cobbles grass sand mud colour color strength dark',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },

  // ---- Sub-articles: Tools ----
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
    slug: 'portals',
    title: 'Portals',
    description: 'Link two rings of energy and jump, or walk, between them, across tabs too.',
    keywords:
      'portal door teleport jump travel warp link pair navigate shortcut across tabs walk through',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
  },

  // ---- Sub-articles: Behaviour ----
  {
    slug: 'bring-focus',
    title: 'Bring Focus',
    description: 'Ask everyone else in the room to come and look at one spot.',
    keywords:
      'bring focus look here attention everyone jump navigate gather point show presenter workshop big board find lost viewport zoom same view',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },
  {
    slug: 'mode-buttons',
    title: 'Selection Mode Buttons',
    description: 'A button that walks whoever presses it into Avatar mode.',
    keywords:
      'mode button selection mode avatar button walk in switch press leave walkthrough read-only travel',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
  },

  // ---- Sub-articles: Virtual Office ----
  {
    slug: 'stage',
    title: 'Stage',
    description: 'A platform whoever stands on is heard by everyone on the tab, for an all-hands.',
    keywords:
      'stage platform podium all-hands all hands town hall keynote presenter presenting speaker speak talk heard everyone broadcast audience raise hand who can speak editors participants show cameras video call calls audio',
    category: 'Palette',
    categorySlug: 'palette/virtual-office',
    parentSlug: 'virtual-office',
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
      'apply browse switch restyle colours colors dialog pick paintbrush look feel looks finish filter flexible professional sketch marker spectrum mashup random surprise shuffle dice billboard patchwork coffeehouse schematic flipchart sketchbook greenboard picnic mural field notes aurora seasonal holiday christmas halloween easter new year snowflakes apply to all tabs every tab all tabs same style match tabs consistent',
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
    title: 'Team Shared Spaces',
    description: 'A per-team folder tree every member can manage.',
    keywords: 'shared library folder team files workspace common diagrams document',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },

  // ---- Sub-articles: Sharing ----
  {
    slug: 'finding-community-documents',
    title: 'Finding Spaces in the Community',
    description:
      'Search the Community by words, #tags, category and sort, then make a space your own.',
    keywords:
      'community gallery browse search find filter hashtag tag tags sort most loved most copied newest category inspiration examples like heart copy duplicate report flag my shares mine own popular popularity stats hidden document',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'community',
    title: 'Sharing to the Community',
    description: 'Publish a space to the public gallery for others to view and copy.',
    keywords:
      'community gallery public publish showcase inspiration examples share document proud like likes copy copies tags category report moderation discover browse canvas explorer share from explorer',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'share-passwords',
    title: 'Share Passwords',
    description: 'Gate view or edit access behind a password.',
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
    description: 'Drop a live canvas into another page, read-only or editable by link role.',
    keywords: 'iframe embed website notion confluence wiki blog integrate document',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'live-image',
    title: 'Live Image',
    description: 'Copy an always-current image of a space for READMEs and docs.',
    keywords: 'readme badge always current screenshot png url auto updating document',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },

  // ---- Sub-articles: Session Tools ----
  {
    slug: 'timer',
    title: 'Timer and Stopwatch',
    description: 'A countdown or a stopwatch you place in a room, run by everyone together.',
    keywords:
      'timer countdown stopwatch timebox clock minutes workshop chime alarm meeting palette piece place room start pause reset',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
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
    title: 'Finding Spaces and Folders',
    description: 'Search across your spaces, folders, and the spaces shared with you.',
    keywords: 'find lookup locate files library open diagrams document',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-teams',
    title: 'Searching Teams',
    description: 'Find teams and their shared folders and spaces from the search panel.',
    keywords: 'find team shared folders lookup locate document',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-tabs-and-elements',
    title: 'Finding Tabs and Elements',
    description: 'Inside a space, jump to any tab or element, including text inside table cells.',
    keywords: 'find jump locate text label shape board lookup document',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-add-to-canvas',
    title: 'Adding Elements from Search',
    description:
      'Search the palette and drop a sticky note or icon onto the canvas without leaving search.',
    keywords: 'insert sticky note icon sticker furniture quick add place drop',
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
