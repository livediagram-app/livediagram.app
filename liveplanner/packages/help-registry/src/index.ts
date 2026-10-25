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
    title: 'About liveplanner',
    description:
      'Get to know liveplanner: what it is, who it helps, and the ideas behind a free planning space with no trackers.',
    articleCount: 3,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from an empty plan to a shared plan in minutes, with the basics every new user needs.',
    articleCount: 5,
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description:
      'Work faster with the shortcuts, hidden features, and small habits experienced users rely on.',
    articleCount: 2,
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
      'Know exactly how your plans are stored, what we collect, and how to keep shared links safe.',
    articleCount: 4,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the liveplanner REST API from your own scripts or the command line: authentication, worked examples, the CLI and developer tools, errors and limits, and the OpenAPI reference.',
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
      'How liveplanner works on a computer, a tablet, and a phone, and what to expect on each.',
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
  // Feature-guide categories (kind: 'feature'). Rendered under "Editor Guides"
  // on the home page; each has a card-grid index at /help/<slug>/. articleCount
  // counts the feature landings in the category (each landing has its own
  // sub-guides). See docs/specs/018-help/help-app.md.
  {
    slug: 'plan',
    title: 'Plan',
    description:
      'Run the work: boards of cards, sheets with real formulas, forms that fill a board, and dashboards drawn from it all.',
    articleCount: 11,
    kind: 'feature',
    groups: ['Getting Going', 'Boards and Cards', 'Sheets', 'Forms and Dashboards'],
  },
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editor: the title and tab bars, quick controls, settings, themes, undo and redo, zoom, and power user mode.',
    articleCount: 10,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: one library, shared by every liveworkspace app, that keeps your plans, folders and teams easy to find and manage.',
    articleCount: 13,
    kind: 'feature',
    groups: ['Your Library', 'Activity'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a piece of work in one plan: its boards, sheets, forms and dashboards each on a tab, organised and moved between.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, live presence, teams, sharing, and session tools.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description: 'Editor helpers: zen mode, and light and dark appearance.',
    articleCount: 2,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any plan, folder, team, tab or card, and run commands.',
    articleCount: 1,
    kind: 'feature',
  },
];

export const articles: Article[] = [
  {
    slug: 'panel-layout',
    title: 'Panel Layout',
    description:
      'Where the header, board header, bottom-right buttons and tab bar sit around your work.',
    keywords:
      'ui window layout interface chrome header board header menu button bottom right buttons cluster undo redo trash new find types style tab bar phone',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'zoom-controls',
    title: 'Zoom Controls',
    description: "Make a Sheet's cells larger or smaller, step by step or to a preset level.",
    keywords: 'zoom in out magnify sheet cells percentage scale reset view',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'tab-bar',
    title: 'The Tab Bar',
    description: 'Switch between the tabs of a plan, add new ones, and group them into folders.',
    keywords:
      'tabs switch bottom bar boards sheets dashboards forms add rename reorder menu project',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'quick-controls',
    title: 'Quick Controls',
    description:
      'The always-available Search, Settings and appearance controls at the end of the bottom bar.',
    keywords: 'corner buttons actions settings search bottom bar cluster appearance light dark',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'settings',
    title: 'Settings',
    description: 'Every preference toggle, what it does, and which device it follows you to.',
    keywords:
      'settings preferences options config configure gear cog toggles panel opacity toolbar minimap welcome tour notifications toasts reduce motion animation accessibility telemetry anonymous usage events privacy sync account device per device defaults turn off keyboard shortcuts hotkeys keybindings ui scale element indicators badges dock position draw default folders where new projects go plan email api tokens trash delete plans',
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
    description: 'Rename the plan, see who can see it, preview as a viewer, and Share or Copy.',
    keywords:
      'header top bar project name rename visibility private shared team public local only role pill editing viewing participating owner preview read only share copy make a copy account plan',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'what-is-liveplanner',
    title: 'What is liveplanner?',
    description:
      'An overview of the free, real-time planner: boards, sheets, forms and dashboards in one plan.',
    keywords:
      'overview intro introduction about product planner planning boards kanban sheets forms dashboards app project',
    category: 'About liveplanner',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'who-is-it-for',
    title: 'Who is liveplanner For?',
    description: 'The teams and use cases that get the most out of liveplanner.',
    keywords:
      'audience use cases teams software product project managers retros hiring planning plan',
    category: 'About liveplanner',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'why-liveplanner',
    title: 'Why Use liveplanner?',
    description: 'Free, no trackers, no sign-in wall, real-time collaboration. Here is why.',
    keywords:
      'benefits reasons comparison alternatives features advantages free privacy no trackers',
    category: 'About liveplanner',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'your-first-project',
    title: 'Your First Plan',
    description:
      'Start a plan, pick a board, sheet, form or dashboard, add your first cards, and share it.',
    keywords:
      'start begin new project first board kanban sheet form dashboard start planning template card cards tutorial walkthrough beginner quick start plan',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'sharing-your-project',
    title: 'Sharing Your Plan',
    description: 'Hand a link to anyone and edit together in real time.',
    keywords: 'share link collaborate invite send url realtime together project plan',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'guest-vs-account',
    title: 'Guest vs Account',
    description: 'liveplanner works without signing in. Here is what an account adds.',
    keywords: 'sign in sign up anonymous login register benefits sync account',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'keyboard-essentials',
    title: 'Keyboard Essentials',
    description: 'The handful of shortcuts that make planning fast, on boards and sheets.',
    keywords: 'shortcuts hotkeys keys undo redo search zen board cards sheet cells essential',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'accessibility',
    title: 'Accessibility and Keyboard Navigation',
    description:
      'Work boards and sheets from the keyboard, with changes announced to screen readers.',
    keywords: 'a11y screen reader focus tab navigation aria assistive accessible',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'The full shortcut reference and how to toggle shortcuts off.',
    keywords:
      'hotkey hotkeys keybinding cheat sheet reference keys bindings muscle memory single key letter settings keyboard category disable all',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'command-palette',
    title: 'Run Commands with ⌘K',
    description:
      'Press Cmd/Ctrl+K and type what you want to do: add or rename a tab, export, share, open settings or Zen mode.',
    keywords: 'cmd k ctrl k quick actions run commands launcher shortcut search',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'guest-identity',
    title: 'How Guest Identity Works',
    description:
      'The liveworkspace guest identity that owns your plans when you are not signed in.',
    keywords:
      'anonymous browser guest id token identity owner without account liveworkspace redirect every app project',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'signing-in',
    title: 'Signing In',
    description: 'Create an account, sign in, and bring your guest plans with you.',
    keywords:
      'login log in sign up register email code google oauth account create migrate avatar initials project',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'deleting-your-data',
    title: 'Deleting Your Data',
    description: 'How to delete a plan or your whole account, and what each removes.',
    keywords: 'delete remove erase gdpr clear account wipe forget close trash project',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'trash',
    title: 'Trash',
    description: 'Deleted plans wait 30 days: restore one, or delete it for good.',
    keywords:
      'trash bin recycle deleted undelete restore recover get back permanently delete forever empty trash thirty days project',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'api-tokens',
    title: 'API Tokens',
    description: 'Create signed-in-only tokens to call the liveplanner API from your own scripts.',
    keywords: 'token key programmatic rest scripts secret bearer automation',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'connect-ai-mcp',
    title: 'Connect an AI Tool (MCP)',
    description: 'Connect Claude or any MCP client to find, view, create, and edit your plans.',
    keywords:
      'claude chatgpt cursor model context protocol ai integration assistant llm connector trash restore plan items read-only project',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'ai-clients',
    title: 'Connecting AI Tools',
    description: 'Add liveplanner to Claude, Claude Code, Cursor, ChatGPT or any MCP client',
    keywords:
      'mcp connector claude desktop claude code cursor chatgpt oauth bearer token setup remote server url',
    category: 'Account and Data',
    categorySlug: 'account-and-data/connect-ai-mcp',
    parentSlug: 'connect-ai-mcp',
  },
  {
    slug: 'google-drive',
    title: 'Google Drive',
    description: 'Keep a copy of your plans in your own Google Drive, synced both ways.',
    keywords:
      'google drive mirror sync backup copy cloud storage open with liveplanner file folders liveworkspace',
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
  {
    slug: 'api-overview',
    title: 'The liveplanner API',
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
    slug: 'working-with-projects',
    title: 'Working with Plans',
    description: 'Worked examples: list, read, create, and update plans, tabs, and folders.',
    keywords:
      'examples curl crud create update list read api requests templates boards outline view text agent project',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'edit-operations',
    title: 'Edit Operations Reference',
    description:
      'Every changeset operation and selector, whole-tab replaces, results and refusals.',
    keywords:
      'changeset edit operations ops line form json selector replace template dashboard test base revision vocabulary cli mcp agent',
    category: 'Developers',
    categorySlug: 'developers/working-with-projects',
    parentSlug: 'working-with-projects',
  },
  {
    slug: 'plan-sheets-images',
    title: 'Plan Items, Sheets and More',
    description: 'API examples for Plan cards, card types, Sheets, forms, copies and themes.',
    keywords:
      'items cards plan board card types sheets cells spreadsheet forms form link render svg copy themes api',
    category: 'Developers',
    categorySlug: 'developers/working-with-projects',
    parentSlug: 'working-with-projects',
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
    title: 'The liveplanner CLI',
    description:
      'Read, build, edit and discuss plans from a terminal: install, sign in, the commands, and profiles.',
    keywords:
      'cli command line terminal shell npm npx install agent coding agent script automation device code login sign in token keychain export pull push profile project',
    category: 'Developers',
    categorySlug: 'developers',
  },
  {
    slug: 'workbenches',
    title: 'liveplanner in Your Developer Tools',
    description:
      'Work in a plan inside a developer tool beside your agent, and talk about what you select.',
    keywords:
      'workbench spinner vs code vscode ide editor embed frame iframe pair pairing selection select agent coding agent live view developer tool workspace explorer folder whole workspace project',
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
  {
    slug: 'data-privacy',
    title: 'Data Privacy',
    description: 'Where your plans live and how they are handled.',
    keywords: 'storage stored cloudflare security where data location safe project',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'offline-mode',
    title: 'Offline Mode',
    description: 'Plans kept only in this browser, and moving them to your account.',
    keywords:
      'local only pill this browser private no sync device localstorage disconnect save location clear site data lost guest default start move to account after sign in share upload project',
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
    slug: 'project-not-loading',
    title: 'A Plan Will Not Load',
    description: 'What to check when a plan is blank or stuck loading.',
    keywords:
      'blank stuck loading error broken empty spinner wont open 404 diagram opening taking longer than usual colleague works for others project',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'repair-this-browser',
    title: 'Repair This Browser',
    description: 'Clear stuck settings and caches, keeping your plans.',
    keywords:
      'reset clear cache cookies local storage stuck loading fix diagnostics support repair browser data project',
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
  {
    slug: 'desktop',
    title: 'Desktop',
    description:
      'The full editor on a computer, with every board, sheet, form and dashboard, shortcuts and right-click menus.',
    keywords: 'computer pc mac windows laptop mouse full editor',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },
  {
    slug: 'tablet',
    title: 'Tablet',
    description: 'Using liveplanner on a tablet, and how a keyboard changes what you can do.',
    keywords: 'ipad touch android surface tablet keyboard',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },
  {
    slug: 'mobile',
    title: 'Mobile',
    description:
      'The touch-friendly editor on a phone: boards a column at a time, stacked dashboards, and gestures.',
    keywords:
      'phone iphone android touch gestures small screen mobile layout landscape sideways rotate header tabs hide fullscreen',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
  },
  {
    slug: 'themes',
    title: 'Themes',
    description: 'Restyle a whole tab with a theme.',
    keywords: 'color colour scheme restyle recolour recolor appearance style palette',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'planning-basics',
    title: 'Planning Basics',
    description:
      'How planning works: a plan of Board, Sheet, Dashboard and Form tabs, Start Planning, cards you move together, and Plan templates.',
    keywords:
      'planning board boards kanban scrum sprint agile retro retrospective roadmap now next later bug triage weekly planner jira trello asana linear backlog to do in progress done column columns swimlane swimlanes rows wip limit work in progress card cards ticket tickets task tasks story stories issue issues drag drop move card assign label priority estimate story points vote voting dot vote hide writing private reveal facilitator set up board settings plan card keyboard shift arrow undo templates project planner gantt daily standup bug tracker okrs key results product launch feedback board budget planner timesheet contact list task tracker spreadsheet templates hiring onboarding tabs dashboard trash archive flag finder types view only phone',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Getting Going',
  },
  {
    slug: 'items',
    title: 'Items',
    description:
      'The tasks, bugs, notes and ideas boards show: numbered, typed, live, kept offline and in copies.',
    keywords:
      'item items ticket tickets task story bug epic note idea action risk issue record records field fields custom field status assignee owner priority label labels tag tags estimate points due date deadline checklist subtasks parent epic votes number key id #12 database store offline sync duplicate copy export drive api mcp agent automation script limit 2000',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
  },
  {
    slug: 'boards',
    title: 'Boards',
    description:
      'Plan boards: pick one, set up its columns, swimlanes and widgets, and what cards it takes.',
    keywords:
      'board boards plan board kanban sprint retro roadmap bug triage week weekly all cards archive blank column columns swimlane swimlanes rows wip limit width done counts as done widget widgets completion filter people points priorities unassigned top voted stale card size minimal compact detailed new cards card types move handle grip start with a board reveal hide writing votes left vote budget planner csv import csv download csv spreadsheet export cards',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
  },
  {
    slug: 'cards',
    title: 'Cards',
    description:
      'Plan cards: add, open and fill one in, child cards, comments, flags, find any card, and archive or trash it.',
    keywords:
      'card cards ticket tickets plan card add card open card panel modal details tab tabs description rich text bullet list numbered list labels checklist steps parent open parent assignee team members comments comment thread resolve mention trash restore empty trash archive duplicate card size flag flagged child breadcrumb trail find search finder not on a board',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
  },
  {
    slug: 'card-types',
    title: 'Card Types',
    description: 'Your own kinds of card on Plan boards: name, colour, glyph and custom fields.',
    keywords:
      'card type types item type types custom type kind kinds category ticket type issue type template fields custom field fields property properties attribute column choice dropdown select option options checkbox tick link url number date text long text show on card colour color glyph icon reorder delete restore built-in tabs details new cards can be limits',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
  },
  {
    slug: 'plan-tour',
    title: 'The Plan Tour',
    description:
      'A guided walkthrough of your own board or sheet, offered once and replayable from Settings.',
    keywords:
      'plan tour tour walkthrough onboarding intro introduction show me around getting started guide tutorial example board example cards example sheet first time learn kanban board cards spreadsheet spreadsheets sheet sheets formulas replay rerun settings accessibility',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Getting Going',
  },
  {
    slug: 'forms',
    title: 'Forms',
    description:
      'A form anyone can fill in from a link, each response a card on your board: questions, where answers go, publishing and closing.',
    keywords:
      'form forms survey surveys questionnaire google forms typeform intake submission submissions responses response respondents rsvp feedback bug report contact job application public link share link publish questions question answers mapping fields card type board column close limit report anonymous',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Forms and Dashboards',
  },
  {
    slug: 'dashboards',
    title: 'Dashboards',
    description:
      'A Plan tab of rows and slots: boards, sheets, metrics, charts and notes side by side, live, arranged by dragging.',
    keywords:
      'dashboard dashboards overview report summary page layout rows row slots slot grid tiles widgets metrics metric kpi kpis chart charts board boards sheet sheets tabs at a glance status home portal add to slot settings cog background tint clear dashboard start over sheet chart change chart sheet figure column summary trend move swap resize arrange drag rearrange',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Forms and Dashboards',
  },
  {
    slug: 'sheets',
    title: 'Sheets',
    description:
      'A spreadsheet tab: setup and templates, cells, formulas, formatting, dropdowns, checkboxes, conditional formatting, sort, filter, find, charts, card tables and CSV.',
    keywords:
      'sheet sheets spreadsheet spreadsheets excel google sheets workbook table grid cell cells row rows column columns formula formulas function functions sum average reference references a1 range ranges number format currency percent date bold italic border borders merge merged freeze frozen sort sorting filter filtering find replace csv tsv import export download upload paste copy fill handle series autofill maximise maximize full screen restore spill setup chart charts bar line pie card table cards linked save focus fill tab templates template budget invoice expense report expenses loan calculator mortgage sales pipeline inventory stock guest list rsvp grade book habit tracker timesheet contacts tracker cell size compact roomy dropdown drop down select picklist pick list list chip chips checkbox check box tick box tickbox validation data validation rule rules conditional formatting conditional format highlight colour scale color scale heat map paint format format painter custom number format format code',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Sheets',
  },
  {
    slug: 'sheet-functions',
    title: 'Sheet Functions',
    description: 'Every function a Sheet formula can use, with its arguments and an example.',
    keywords:
      'sheet functions function list formulas formula reference spreadsheet functions excel functions sum average count countif sumif vlookup xlookup index match if iferror concat text date today now round filter sort unique sequence pmt npv cardcount cardsum cards plan cards errors div/0 n/a name ref value spill',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Sheets',
  },
  {
    slug: 'visualisations',
    title: 'Charts of Your Cards',
    description: 'Visualisation tabs: a Gantt chart, calendars and more, live from every card.',
    keywords:
      'visualisation visualisations visualization chart charts graph gantt gantt chart timeline roadmap due calendar start calendar calendar cards by field workload priority by status priority matrix card search filter filters swimlanes swimlane lanes row order reorder drag to reorder sort by date chart settings cog card types group by statuses maximise maximize view restore view dashboard slot status breakdown',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Forms and Dashboards',
  },
  {
    slug: 'using-tabs',
    title: 'Tabs',
    description: 'Multiple boards in one plan: add, name, reorder, and switch between them.',
    keywords:
      'boards pages multiple sheets add rename reorder switch delete duplicate tab menu new tab quick start project',
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
    slug: 'add-to-project',
    title: 'Add a Tab to Another Plan',
    description: 'Add the active tab to another plan you own; both share the same live tab.',
    keywords: 'reuse share tab sync across projects diagrams move copy live plans',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'import-tabs',
    title: 'Importing a Tab',
    description:
      'Import a liveplanner tab exported as JSON into the active tab, by pasting it or picking the file.',
    keywords:
      'import json file files paste upload load restore backup copy clipboard replace tab export round trip',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'export-tabs',
    title: 'Exporting a Tab',
    description:
      'Export the active tab or a selection as JSON, Markdown, CSV, PNG, SVG, or PDF: copy the text formats or set image options.',
    keywords: 'export download save png svg pdf json markdown csv image picture',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'comments',
    title: 'Comments',
    description: 'Comment on cards and Sheet cells, and resolve threads.',
    keywords: 'thread feedback reply resolve discussion note annotate mention',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'live-presence',
    title: 'Live Presence',
    description:
      'Who is on which tab, the card each person has open, their cells on a Sheet, and agents at work.',
    keywords:
      'cursors online who viewing realtime collaborators avatars multiplayer people participants roster room agent agents ai status working focus',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'explorer-page',
    title: 'Explorer Page',
    description:
      "The full-page library every liveworkspace app shares: Plans or All Apps, the sidebar's Overview, Spaces and More, views and search.",
    keywords:
      'library home dashboard files my plans list manage browse sidebar overview spaces more search all apps every app filter canvases designs liveworkspace duplicate copy plans project',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'explorer-panel',
    title: 'Explorer Panel',
    description:
      'The compact in-editor Explorer: a rail of sections beside a list, opening plans in place.',
    keywords:
      'sidebar rail switch projects library in editor menu button hamburger popover open explorer every app new share export plans',
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
    slug: 'filters',
    title: 'Search and Filter Plans',
    description:
      'Narrow any plan list with words, chips or typed filters like made-by:ai, and share it as a link.',
    keywords:
      'search find filter filters chips narrow refine query token tokens pill pills made by ai generated template retrospective kanban edited date last week recent people me others owner space team shared folder name subfolders lens results clear plan project',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'home',
    title: 'Home',
    description:
      'The Explorer’s landing view: what you opened last, what was shared with you recently, and what happened.',
    keywords:
      'home jump back in recent last opened most used see more shared with you recently what happened while away teammates others changes see timeline landing start plan',
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
      'activity inbox to do todo tasks my actions assigned to me assigned by me outstanding waiting open threads unresolved comments replies mentions pending work queue what needs me badge count all apps plan plans',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'timeline',
    title: 'Timeline',
    description:
      'What happened to your plans and your teams’, day by day: made, updated, renamed, moved, trashed and shared.',
    keywords:
      'timeline history what happened changes feed log audit who changed edited renamed moved trashed restored shared favourited calendar filter new since last visit unread count remove from timeline hide menu rename upcoming link team activity every app all apps plan plans',
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
      'history last opened latest previously recently opened folder location where filed chip hide from recent show in recent exclude remove twelve project plan',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'shared-with-you',
    title: 'Shared With Me',
    description: 'Items other people have shared with you through a link, collected in one place.',
    keywords:
      'shared with me received from others incoming shares links collaborations remove dismiss project plan',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
  },
  {
    slug: 'folders',
    title: 'Folders',
    description: 'Group your items into a nestable tree, and move them between folders.',
    keywords:
      'organise organize directory nest move tree group files change folder subfolder delete folder project plan',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
  },
  {
    slug: 'personal-space',
    title: 'My Work and Folders',
    description: 'Your own library: the folders you create, your unfiled items and Favourites.',
    keywords:
      'my projects personal space library my work your plans own files root folder organise organize unsorted unfiled favourite favorite star starred bookmark quick access plans',
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
      'workspace organisation organization members invite group company manage teams liveworkspace project',
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
    description: 'Hide the header, tab bar and corner buttons to focus on your work.',
    keywords: 'distraction free fullscreen hide ui focus clean minimal presentation screen share',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    // The slug stays 'dark-mode': it is a public URL, and "dark mode" is still
    // what a reader searches for even though the control is now three-way.
    slug: 'dark-mode',
    title: 'Appearance: Light, Dark, System',
    description: 'Set liveplanner to light, dark, or your device setting, everywhere at once.',
    keywords:
      'night theme appearance dark light system os device switch toggle cycle eyes mode website help header',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'session-tools',
    title: 'Session Tools',
    description:
      'A shared countdown or stopwatch and live dot-voting on cards, for retros and other sessions.',
    keywords:
      'timer voting workshop meeting facilitation retro countdown stopwatch dots picker random temperature fist of five',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'undo',
    title: 'Undo',
    description: 'Step back your most recent change, with a keyboard shortcut and a button.',
    keywords: 'ctrl z cmd z revert back mistake reverse cancel history 500 steps collaborator',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'redo',
    title: 'Redo',
    description: 'Re-apply a change you just undid.',
    keywords: 'ctrl y cmd shift z repeat restore forward again history',
    category: 'User Interface',
    categorySlug: 'user-interface',
  },
  {
    slug: 'changing-theme',
    title: 'Changing the Theme',
    description: 'Open the Tab Style dialog from Style and pick a look or a theme.',
    keywords:
      'apply browse switch restyle colours colors dialog pick paintbrush look feel looks finish filter flexible professional sketch marker spectrum mashup random surprise shuffle dice billboard patchwork coffeehouse schematic flipchart sketchbook greenboard picnic mural field notes aurora seasonal holiday christmas halloween easter new year snowflakes',
    category: 'User Interface',
    categorySlug: 'user-interface/themes',
    parentSlug: 'themes',
  },
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
    slug: 'team-shared-projects',
    title: 'Team Shared Plans',
    description: 'A per-team folder tree every member can manage.',
    keywords: 'shared library folder team files workspace common diagrams project',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },
  {
    slug: 'share-passwords',
    title: 'Share Passwords',
    description: 'Guard every share link to a plan with one password.',
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
    description: 'Drop a live plan into another page, read-only or editable by link role.',
    keywords: 'iframe embed website notion confluence wiki blog integrate project',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'live-image',
    title: 'Live Image',
    description: 'An always-current image of a plan, made from a share link, for READMEs and docs.',
    keywords: 'readme badge always current screenshot png url auto updating project',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
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
    description: 'Let everyone vote live on cards, privately if you want, and tally the results.',
    keywords:
      'vote tally decide prioritise prioritize dots anonymous private privacy secret blind hide hidden cursors pointers counts totals dot vote',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
  },
  {
    slug: 'casting-dots',
    title: 'Casting Dots',
    description: 'Spending and taking back your dots on cards during a vote.',
    keywords:
      'cast dot dots vote counter tally pill plus minus retract withdraw budget spend stack votable cards board',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
  },
  {
    slug: 'vote-privacy',
    title: 'Private Voting',
    description: 'Hide cursors and hide the running counts for a blind vote.',
    keywords:
      'private privacy secret blind anonymous hide cursors pointers hide running counts totals tallies pile on bandwagon switches fixed',
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
    description: 'The shared walkthrough of which cards won, with the ranked list beside it.',
    keywords:
      'results reveal show results winners ranked list top result walkthrough previous next done highlight amber follow shared focus clear vote',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
  },
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
    slug: 'search-projects',
    title: 'Finding Plans',
    description: 'Search your plans by name, and where to search folders and shared items.',
    keywords: 'find lookup locate files library open diagrams project',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-teams',
    title: 'Searching Teams',
    description: 'Find the teams you belong to and open their libraries from the search panel.',
    keywords: 'find team shared folders lookup locate project',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-tabs-and-elements',
    title: 'Finding Tabs and Cards',
    description:
      'Inside a plan, jump to any tab or board by name, and open a card by its number or title.',
    keywords: 'find jump locate tab name card number board title lookup open card project',
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
      'Press Cmd/Ctrl+K to run an editor command by name: create or rename a tab, undo, export, import, settings and more.',
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
