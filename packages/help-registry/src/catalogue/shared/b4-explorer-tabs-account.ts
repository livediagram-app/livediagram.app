// The merged articles of the explorer, tabs and account batch (liveworkspace/docs/specs/017-help/help-centre.md): one
// entry per path, `apps` the apps whose help had the article, in registry order. Keywords are the union of the copies'.

import type { Article } from '../../types';

export const articles: Article[] = [
  {
    slug: 'phone-notifications',
    title: 'Phone Notifications',
    description:
      'A notification on your device for a mention, an assignment, a reply or a comment, from every app.',
    keywords:
      'phone push mobile notification notifications notify device iphone ipad android install installable app pwa home screen add to turn on mention reply comment action assigned alert web browser',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livediagram', 'livedocuments'],
    byApp: {
      livediagram: { title: 'Phone Notifications and Installing the App' },
    },
  },
  {
    slug: 'google-drive',
    title: 'Google Drive',
    description:
      'Keep a copy of your work, and your work from every liveworkspace app, in your own Google Drive.',
    keywords:
      'google drive mirror sync backup copy cloud storage open with livediagram file folders liveplanner liveworkspace livedocuments livedesign livehuddle',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'api-tokens',
    title: 'API Tokens',
    description:
      'Call the API from your own scripts with a revocable token. A signed-in-only feature for advanced users.',
    keywords: 'token key programmatic rest scripts secret bearer automation',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'ai-keys',
    title: 'Your AI Keys',
    description:
      'Use your own Anthropic or OpenAI key, or your team’s, for every app’s AI features instead of built-in AI.',
    keywords:
      'ai key api key anthropic claude openai gpt chatgpt model provider built-in own key team admin billing encrypted remove replace settings',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'connect-ai-mcp',
    title: 'Connect an AI Tool (MCP)',
    description:
      'Connect the app to Claude or any MCP client to find, view, create, and edit your work from inside your AI tool.',
    keywords:
      'claude chatgpt cursor model context protocol ai integration assistant llm connector trash restore read-only document plan items project pages slides article logo wireframe photo',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'ai-clients',
    title: 'Connecting AI Tools',
    description:
      'Step-by-step setup for connecting the app to Claude, Claude Desktop, Claude Code, Cursor, ChatGPT or any MCP client.',
    keywords:
      'mcp connector claude desktop code cursor chatgpt oauth bearer token setup remote server url',
    category: 'Account and Data',
    categorySlug: 'account-and-data/connect-ai-mcp',
    parentSlug: 'connect-ai-mcp',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'deleting-your-data',
    title: 'Deleting Your Data',
    description:
      'Remove a piece of work or your whole account, and understand how your data is scoped whether you are a guest or signed in.',
    keywords:
      'delete remove erase gdpr clear account wipe forget close trash document project download your data copy before deleting',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'email-notifications',
    title: 'Email Notifications',
    description:
      'Optional emails for signed-in users, and how to control every kind of them in Settings.',
    keywords:
      'emails unsubscribe opt out notification preferences turn off welcome mention comment settings',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'guest-identity',
    title: 'How Guest Identity Works',
    description:
      'The editor works without signing in. Here is how the app knows which work is yours when you are a guest.',
    keywords:
      'anonymous browser id localstorage owner identity without account document guest token liveworkspace redirect every app project design',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'signing-in',
    title: 'Signing In',
    description:
      'An account is optional and free. It keeps your work in sync across devices, and your guest work comes with you.',
    keywords:
      'login log in sign up register email code google oauth account create migrate avatar initials document project guest',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'trash',
    title: 'Trash',
    description:
      'Deleted the wrong one? It waits in the Trash for 30 days, and you can put it back exactly where it was.',
    keywords:
      'trash bin recycle deleted undo undelete restore recover get back permanently empty blank unused automatic automatically clean up cleanup thirty days document delete forever project',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'activity',
    title: 'Inbox',
    description:
      'What is outstanding for you across every app: actions assigned to you or by you, and open comment threads.',
    keywords:
      'activity inbox to do todo tasks my actions assigned me by outstanding waiting open threads unresolved comments replies reply resolve mark done reading pane keyboard pending work queue what needs badge count all diagrams local only offline browser storage canvas agent mentions apps plan plans document documents designs this',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'liveknowledge'],
  },
  {
    slug: 'explorer-page',
    title: 'Explorer Page',
    description:
      "The full-page library every liveworkspace app shares: Canvases or All Apps, the sidebar's Overview, Spaces and More, views and search.",
    keywords:
      'library home dashboard files my documents diagrams list manage browse sidebar overview spaces more keyboard navigation tree canvas walkthroughs search panel ctrl k plans all apps every app filter canvases designs liveworkspace duplicate copy project document design space',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'explorer-panel',
    title: 'Explorer Panel',
    description:
      'Browse your library and open other work from a panel, without leaving the editor.',
    keywords:
      'sidebar overview spaces more tree keyboard switch documents diagrams files library in editor menu button hamburger popover open new share export github canvas rail projects explorer every app plans designs space',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'filters',
    title: 'Search and Filter',
    description:
      'Narrow any list in the Explorer with a few words, a chip, or a typed filter, and share the result as a link.',
    keywords:
      'search find filter filters chips narrow refine query token tokens made by ai generated opens in edited date last week recent people me others owner space team shared unfiled root lens results pages document pill pills template retrospective kanban folder name subfolders clear plan project design kind',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: {
      liveknowledge: { title: 'Search and Filter Knowledgebases' },
      livediagram: { title: 'Search and Filter Canvases' },
      liveplanner: { title: 'Search and Filter Plans' },
      livedocuments: { title: 'Search and Filter Documents' },
      livedesign: { title: 'Search and Filter Designs' },
      livehuddle: { title: 'Search and Filter Spaces' },
    },
  },
  {
    slug: 'folders',
    title: 'Folders',
    description: "Organise a growing library into nested folders, in your own space or a team's.",
    keywords:
      'organise organize directory nest move tree group files document change folder subfolder delete project plan',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'default-folders',
    title: 'Default Folders',
    description: 'Choose where new work lands when you create it without picking a place.',
    keywords:
      'default folder where new documents go automatic placement file whiteboards retrospectives event storming diagrams use as settings document wizard sessions canvas designs design space spaces',
    category: 'Explorer',
    categorySlug: 'explorer/folders',
    parentSlug: 'folders',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle', 'liveknowledge'],
  },
  {
    slug: 'home',
    title: 'Home',
    description:
      'The work you use most and last, and what was shared with you recently, on one page.',
    keywords:
      'home jump back in within reach most used last recent see more grid strip return often shared with you recently landing start history 30 days opened plan new what can make logo wireframe photo a project kit made kits',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'image-gallery',
    title: 'Image Gallery',
    description: 'Every image you have uploaded, with where each is used and how to delete them.',
    keywords: 'uploads pictures photos assets manage delete media guest upload used unused',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Assets and Imports',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle', 'liveknowledge'],
    byApp: {
      livehuddle: { group: 'Assets' },
    },
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
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'personal-space',
    title: 'My Work and Folders',
    description: 'Your own library: the folders you create, and your unfiled canvases at its root.',
    keywords:
      'my documents personal space library work your diagrams own files root folder organise organize unsorted unfiled made by ai generated bookmark pin quick access canvas projects plans designs spaces',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'profile',
    title: 'Your Account',
    description:
      'Your identity card, email-notification switches, and account deletion, in Settings.',
    keywords:
      'account profile settings email delete avatar name preferences identity danger zone menu sign out mentions colour color display time sign-in methods signed in devices reset',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'recent',
    title: 'Recent',
    description:
      'Everything you can open, by when you last opened it, across every folder, team and share.',
    keywords:
      'history last opened latest edited previously hide exclude remove clutter show restore visible folder location where filed root breadcrumb diagrams filter newest twelve document recently chip from recent in project plan owner design',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: {
      livediagram: { title: 'Recent Canvases' },
      livehuddle: { title: 'Recent Spaces' },
    },
  },
  {
    slug: 'shared-with-you',
    title: 'Shared With Me',
    description: 'Canvases other people have shared with you, collected in one place.',
    keywords:
      'shared with me received from others incoming shares collaborations dismiss role owner document links remove project plan design',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Activity',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'team-spaces',
    title: 'Team Spaces',
    description:
      'Each team you belong to is a space in the Explorer sidebar beside My Work, with its folders beneath it.',
    keywords:
      'teams team spaces shared workspace invites membership group new library manage liveworkspace card invite by link accept decline members roles',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'using-tabs',
    title: 'Using Tabs',
    description:
      'One piece of work, many tabs. Tabs let you split a project across several parts, each with its own content, theme, and background.',
    keywords:
      'boards pages multiple sheets add rename reorder switch delete duplicate tab menu new quick start document project tabs making attendance',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'add-to-document',
    title: 'Add a Tab to Another File',
    description:
      'Reuse a tab elsewhere: add the active tab to another of your works, and edits made in either place appear in both.',
    keywords: 'reuse share tab sync across documents diagrams move copy live canvas space spaces',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'livedocuments', 'livehuddle'],
    byApp: {
      livediagram: { title: 'Add a Tab to Another Canvas' },
      livedocuments: { title: 'Add a Tab to Another Document' },
      livehuddle: { title: 'Add a Tab to Another Space' },
    },
  },
  {
    slug: 'connected-files',
    title: 'Connected Files',
    description:
      'Add a tab that opens a file from any liveworkspace app: a plan, a document, a design or another canvas.',
    keywords:
      'connect connected file tab liveplanner livedocuments livedesign livehuddle other app project link share both ways role editor viewer participant remove again livediagram canvas design start a kit kits software product launch team workshop website build folder',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'export-tabs',
    title: 'Exporting a Tab',
    description:
      'Take a tab out of the app: download it as an image, a PDF, a JSON file you can import back, or the other formats its app offers.',
    keywords:
      'export download save png svg pdf gif animated json mermaid markdown excalidraw image picture csv print printer pages powerpoint pptx word docx logo kit photo jpeg webp psd layers vector selectable text searchable',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'import-tabs',
    title: 'Importing into a Tab',
    description:
      'Bring content into a tab from pasted text or a file, and know what an import replaces.',
    keywords:
      'import json mermaid markdown excalidraw drawio visio vsdx lucidchart lucid wrangler toml docker compose yaml terraform tf hcl kubernetes k8s manifest update re-run refresh sources infrastructure architecture cloudflare workers services draw.io diagrams.net mxfile pages file files paste upload load convert migrate png svg image images picture photo gallery placeholder embedded scene copy clipboard ctrl v cmd drag drop whiteboard new document explorer from canvas csv restore backup replace tab export round trip trello asana jira linear board move logo icon vector shapes paths editable undo space spaces',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'linking-tabs',
    title: 'Linking Across Tabs',
    description:
      'Turn an element into a jump point to another tab, another canvas, or a web address.',
    keywords: 'jump navigation cross reference hyperlink go to connect boards document',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'livedesign'],
  },
  {
    slug: 'locking-tabs',
    title: 'Locking a Tab',
    description: 'Protect a finished tab in one step, so it stays exactly as you left it.',
    keywords: 'read only protect freeze prevent editing lock board unlock padlock',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'side-by-side',
    title: 'Side by Side Tabs',
    description:
      'Put two tabs on screen at once, and work on either without losing sight of the other.',
    keywords:
      'split view screen two tabs compare beside next to dual pane panes side-by-side drag tab right edge reference resize divider close',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'tab-cleanup',
    title: 'Cleaning Up a Tab',
    description:
      'Tidy a messy tab in one click: snap everything to a tidy grid, or recompute the whole layout from the arrows between elements.',
    keywords: 'tidy auto layout snap grid arrange organise organize align command palette cleanup',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'tab-folders',
    title: 'Tab Folders',
    description:
      'Once a tab bar grows past a handful of tabs, group the related ones under a named folder that takes up a single chip.',
    keywords: 'group tabs organise organize collapse nest sections fan chip',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
];
