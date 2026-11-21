// The merged articles of the developers, selection-modes, user-interface, tips-and-tricks and search-panel batch
// (liveworkspace/docs/specs/017-help/help-centre.md): one entry per path, `apps` the apps whose help had the article,
// in registry order. Keywords are the union of the copies'.

import type { Article } from '../../types';

export const articles: Article[] = [
  {
    slug: 'the-search-panel',
    title: 'The Search Panel',
    description: 'Open the global search, what it covers, and how to navigate the results.',
    keywords:
      'find lookup global search everywhere quick open locate settings preferences help articles command palette',
    category: 'Search Panel',
    categorySlug: 'search-panel',
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
    slug: 'command-palette',
    title: 'The Command Palette (⌘K)',
    description:
      'Press Cmd/Ctrl+K to run any editor command by name: undo, auto layout, export, settings and more.',
    keywords: 'cmd k ctrl quick actions run commands launcher shortcut',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
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
    slug: 'search-add-to-canvas',
    title: 'Adding Elements from Search',
    description:
      'Search the palette and drop an element or icon onto the canvas without leaving search.',
    keywords: 'insert shape icon quick add place drop sticky note sticker furniture',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'search-create-tab',
    title: 'Creating a Tab from Search',
    description: 'Spin up a new tab straight from the search panel with the Create New Tab action.',
    keywords: 'new board page quick create add',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'search-documents',
    title: 'Finding Your Work and Folders',
    description:
      'Find your work by name from the editor, and your items and folders from the Explorer page.',
    keywords: 'find lookup locate files library open diagrams document',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
    apps: ['livediagram', 'livedocuments', 'livehuddle'],
    byApp: {
      livediagram: { title: 'Finding Canvases and Folders' },
      livedocuments: { title: 'Finding Documents and Folders' },
      livehuddle: { title: 'Finding Spaces and Folders' },
    },
  },
  {
    slug: 'search-tabs-and-elements',
    title: 'Finding Tabs and Elements',
    description: 'Inside your work, jump to any tab, element or card.',
    keywords:
      'find jump locate text label shape board lookup document tab name card number title open project page',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
    byApp: {
      liveplanner: { title: 'Finding Tabs and Cards' },
    },
  },
  {
    slug: 'search-teams',
    title: 'Searching Teams',
    description:
      'Find the teams you belong to, and where their folders and work turn up in search.',
    keywords: 'find team lookup locate page every app shared folders project document',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'eraser',
    title: 'Eraser',
    description: 'Click or drag across elements to delete them quickly.',
    keywords: 'delete remove rub out erase clear wipe brush size filter drawings arrows sweep tap',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram', 'livedesign'],
  },
  {
    slug: 'format-painter',
    title: 'Format Painter',
    description: "Copy one element's style and paint it onto others.",
    keywords:
      'copy style clone look paste formatting appearance brush selection toolbar paint match',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
    byApp: {
      livehuddle: { category: 'Edit or Walk' },
    },
  },
  {
    slug: 'hand',
    title: 'Hand',
    description: 'Pan the canvas with a plain drag on empty space.',
    keywords: 'pan drag move canvas grab scroll navigate space middle click hand tool',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'laser',
    title: 'Laser Pointer',
    description:
      'A temporary laser trail for drawing attention while presenting, on a call or on a shared screen.',
    keywords: 'presentation highlight trail point attention presenting red pointer pen glow comet',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'select',
    title: 'Select',
    description: 'The default pointer for selecting, moving, and editing elements.',
    keywords:
      'pointer cursor arrow tool default mode click marquee picker shift edit walk toggle switch select build footprints avatar character pan hand space drag trackpad middle delete remove erase eraser backspace selection',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
    byApp: {
      livehuddle: { title: 'Edit and Walk', category: 'Edit or Walk' },
    },
  },
  {
    slug: 'slide-deck',
    title: 'Slide Deck',
    description:
      'Build slides and present them full screen, with notes, transitions and auto-advance.',
    keywords:
      'presentation presenting present mode slideshow slide show slides deck talk demo walkthrough narrate projector screen share screenshare speaker notes presenter script full fullscreen next previous advance start build element set spans tabs contents add to pages one tab at a time',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram', 'livedocuments'],
  },
  {
    slug: 'building-a-deck',
    title: 'Building a Deck',
    description: 'Add, hide, reorder and annotate the slides before you present them.',
    keywords:
      'build deck new slide add remove elements selection membership rename duplicate copy delete confirm hide hidden skip struck through eye reorder drag order presenter notes script speaker budget minutes timing per pace menu ellipsis contents to slides page infographic article in show veil present from here start note cards right click',
    category: 'Selection Modes',
    categorySlug: 'selection-modes/slide-deck',
    parentSlug: 'slide-deck',
    apps: ['livediagram', 'livedocuments'],
  },
  {
    slug: 'presenter-controls',
    title: "The Presenter's Controls",
    description:
      'The strip in the corner of a running deck, and the eleven settings behind its cog.',
    keywords:
      'hud controls strip corner position counter slide name jump to list grid notes button popover elapsed time clock budget minutes over amber pacing settings cog transition speed auto advance autoadvance loop click fill screen actual size show keep visible hide pointer cursor kiosk unattended',
    category: 'Selection Modes',
    categorySlug: 'selection-modes/slide-deck',
    parentSlug: 'slide-deck',
    apps: ['livediagram', 'livedocuments'],
  },
  {
    slug: 'presenting',
    title: 'Presenting',
    description:
      'What a running deck does: framing, transitions, moving through it, and what a click does.',
    keywords:
      'present full screen fullscreen start presenting framing frame fit padding backdrop transition travel slide fade reduce motion advance next previous arrow keys space page down home end escape exit laser spotlight point read only popover note comment action wake lock awake announce reader shortcuts dead',
    category: 'Selection Modes',
    categorySlug: 'selection-modes/slide-deck',
    parentSlug: 'slide-deck',
    apps: ['livediagram', 'livedocuments'],
  },
  {
    slug: 'spotlight',
    title: 'Spotlight',
    description: 'Dim the canvas around a circle of light that follows your cursor.',
    keywords: 'dim focus highlight presentation emphasis attention darken',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'agent-changes',
    title: "Reviewing and Undoing an Agent's Changes",
    description: 'See what an agent or a script changed, and undo it for 30 days',
    keywords:
      'changeset changesets undo revert agent ai mcp cli history review rollback toast kept diff script',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'agent-comments-presence',
    title: 'Comments and Presence for Agents',
    description:
      'Show what your agent is doing, and talk through comment threads where the app has them.',
    keywords:
      'agent comments reply resolve reopen threads presence status focus ring card api cli bot read list script gone 410',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'api-overview',
    title: 'The API',
    description: 'What the REST API is, the base URL, and how to start calling it with a token.',
    keywords:
      'rest api endpoints base url http programmatic developer integrate openapi archive presence comments',
    category: 'Developers',
    categorySlug: 'developers',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: {
      livediagram: { title: 'The livediagram API' },
      liveplanner: { title: 'The liveplanner API' },
      livedocuments: { title: 'The livedocuments API' },
      livedesign: { title: 'The livedesign API' },
      livehuddle: { title: 'The livehuddle API' },
    },
  },
  {
    slug: 'authentication',
    title: 'Authentication',
    description: 'Authenticate API requests with a bearer token, and how that differs from guests.',
    keywords: 'auth bearer token authorize header credentials api key',
    category: 'Developers',
    categorySlug: 'developers',
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
    slug: 'cli',
    title: 'The CLI',
    description:
      'Read, build, edit and discuss your work from a terminal: install, sign in, the commands, and profiles.',
    keywords:
      'cli command line terminal shell npm npx install agent coding script automation device code login sign in token keychain export pull push profile host document project component image gallery share rename',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
    byApp: {
      livediagram: { title: 'The livediagram CLI' },
      liveplanner: { title: 'The liveplanner CLI' },
      livedocuments: { title: 'The livedocuments CLI' },
      livedesign: { title: 'The livedesign CLI' },
    },
  },
  {
    slug: 'errors-and-rate-limits',
    title: 'Errors and Rate Limits',
    description: 'Status codes, the error response shape, rate limits, and token expiry.',
    keywords: 'error 401 403 404 429 throttle limits status codes expiry failed',
    category: 'Developers',
    categorySlug: 'developers',
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
    slug: 'workbenches',
    title: 'Your Work in Your Developer Tools',
    description: 'Work inside a developer tool beside your agent, and talk about what you select.',
    keywords:
      'workbench spinner vs code vscode ide editor embed frame iframe pair pairing selection select agent coding live view developer tool workspace explorer folder whole document project',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
    byApp: {
      livediagram: { title: 'Diagrams in Your Developer Tools' },
      liveplanner: { title: 'liveplanner in Your Developer Tools' },
      livedocuments: { title: 'Documents in Your Developer Tools' },
      livedesign: { title: 'Designs in Your Developer Tools' },
    },
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
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'working-with-documents',
    title: 'Working with Files',
    description: 'Worked examples: list, read, create, and update your files, tabs, and folders.',
    keywords:
      'examples curl crud create update list read api requests diagrams outline view text agent document',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['livediagram', 'livedocuments', 'livehuddle'],
    byApp: {
      livediagram: { title: 'Working with Canvases' },
      livedocuments: { title: 'Working with Documents' },
      livehuddle: { title: 'Working with Spaces' },
    },
  },
  {
    slug: 'edit-operations',
    title: 'Edit Operations Reference',
    description:
      'Every changeset operation, selector, placement and flag, and the lint findings where the app has them.',
    keywords:
      'changeset edit operations ops line form json selector placement flags lint findings vocabulary cli mcp agent',
    category: 'Developers',
    categorySlug: 'developers/working-with-documents',
    parentSlug: 'working-with-documents',
    apps: ['livediagram', 'livedocuments', 'livehuddle'],
  },
  {
    slug: 'images-and-copies',
    title: 'Images, Copies and Libraries',
    description: 'API examples for images, tab pictures, copies and shape libraries.',
    keywords: 'images upload gallery render svg picture png copy duplicate shape libraries api',
    category: 'Developers',
    categorySlug: 'developers/working-with-documents',
    parentSlug: 'working-with-documents',
    apps: ['livediagram', 'livehuddle'],
  },
  {
    slug: 'minimap',
    title: 'Map',
    description:
      'A zoomed-out overview of the canvas in the bottom-left with a box for your view: tap or drag to navigate. Where an app has none, Contents and the page navigator take over.',
    keywords:
      'minimap mini map overview navigate viewport birds eye locate where am i contents pages',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'context-menus',
    title: 'Context Menus',
    description: 'Right-click menus across the editor, each scoped to what you clicked.',
    keywords:
      'right click menu long press options popup categories more appearance resources quick bar save to library',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'toolbar',
    title: 'The Toolbar',
    description: 'The contextual toolbar that appears when you select one or more elements.',
    keywords:
      'selection bar buttons floating contextual duplicate lock delete comment filter export more save to library rotate turn furniture format painter',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'zoom-controls',
    title: 'Zoom Controls',
    description: 'Zoom in and out, fit your work to the screen, and jump to a preset level.',
    keywords: 'zoom in out magnify fit screen percentage scale reset view dock sheet cells',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'tab-bar',
    title: 'The Tab Bar',
    description: 'Switch between tabs, add new ones, and group them into folders.',
    keywords:
      'tabs boards pages switch bottom bar sheets dashboards forms add rename reorder menu project document',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'title-bar',
    title: 'The Top Corners',
    description:
      'There is no bar across the top of the editor: the logo and the menu in the top-left corner, and Share or Copy and your account in the top right.',
    keywords:
      'title bar header top bar corner corners card menu button explorer logo editor mode switch present prototype share share form copy make a copy account sign in sign out design canvas document space plan name rename visibility',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
    byApp: {
      livedocuments: { title: 'The Title Bar' },
      livedesign: { title: 'Share, Copy and Your Account' },
      livehuddle: { title: 'Share, Copy and Your Account' },
    },
  },
  {
    slug: 'quick-controls',
    title: 'Quick Controls',
    description:
      'The always-available Tools (with Search), Settings and appearance controls at the end of the bottom bar, with Get Started while a tour is on offer.',
    keywords:
      'corner buttons actions tools toolbox search settings get started tour receptionist history snapshots webhooks walkthroughs slide deck github bottom bar cluster appearance light dark automations sign in sync plan badge',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'panel-layout',
    title: 'Panel Layout',
    description: 'Where the toolbar and panels sit around the canvas, and how to rearrange them.',
    keywords:
      'ui window dock arrange workspace interface layout move panels chrome corner snap reset position menu button header board header bottom right buttons cluster undo redo trash types board style tools top corners tab bar phone',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'settings',
    title: 'Settings',
    description: 'Every preference toggle, what it does, and which device it follows you to.',
    keywords:
      'settings preferences options config configure gear cog toggles panel opacity toolbar map minimap welcome tour receptionist notifications toasts join leave sounds desktop notifications hide participant cursors proximity ring audio proximity ring reduce motion animation accessibility ai assistant telemetry anonymous usage events privacy sync account device per device defaults turn off keyboard shortcuts hotkeys keybindings ui scale button labels element indicators badges dock position draw default folders where new designs go where new documents go where new spaces go email api tokens trash delete delete account canvas design document space spaces project projects plan plans',
    category: 'User Interface',
    categorySlug: 'user-interface',
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
    slug: 'duplicating-elements',
    title: 'Duplicating Elements',
    description: 'Duplicate in place, copy and paste across tabs, or Shift-drag a copy into place.',
    keywords: 'duplicate copy paste clone repeat shift drag cmd d ctrl d multiply ghost',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'fast-theming',
    title: 'Restyle Your Work Fast',
    description: 'Restyle a whole tab in seconds with themes and presets.',
    keywords: 'restyle recolour recolor colors colours presets quick style scheme',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
    byApp: {
      livediagram: { title: 'Restyle a Diagram Fast' },
      livedocuments: { title: 'Restyle a Document Fast' },
      livedesign: { title: 'Restyle a Design Fast' },
      livehuddle: { title: 'Restyle a Space Fast' },
    },
  },
  {
    slug: 'presenting-well',
    title: 'Walking People Through Your Work',
    description:
      'Show your work on a call with Zen mode, the laser, the spotlight, and follow along or a slide deck.',
    keywords:
      'present presenting presentation demo walkthrough screen share screenshare call meeting zen laser spotlight follow point slideshow fullscreen slides',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
    apps: ['livediagram', 'livedocuments', 'livedesign'],
    byApp: {
      livediagram: { title: 'Presenting from the Canvas' },
      livedocuments: { title: 'Presenting from the Canvas' },
      livedesign: {
        title: 'Presenting from the Canvas',
        description:
          'Show your work on a call with Zen mode, the laser, the spotlight, and follow along.',
      },
    },
  },
  {
    slug: 'format-painter',
    title: 'The Format Painter',
    description: 'Copy the look of one element onto others in two clicks.',
    keywords:
      'copy style paste formatting clone look duplicate appearance brush format panel paint once keep the page background pattern',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'copy-and-paste',
    title: 'Copy and Paste',
    description: 'Move elements between tabs, files and windows through the system clipboard.',
    keywords:
      'copy paste cut clipboard cmd c cmd v cmd x ctrl c ctrl v ctrl x between designs documents diagrams another design another document another tab second window screenshot paste image picture offset reconnect arrows system clipboard canvas space spaces excalidraw',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'command-palette',
    title: 'The Palette',
    description:
      'Pick tools and add shapes, text, icons and more from the palette strip, or run commands from the keyboard.',
    keywords:
      'quick add search elements toolbar strip launcher categories category bar flyout dropdown popular selection mode tiles bands edit walk toggle write rooms seats perks play garden meet travel stickers cmd k ctrl k quick actions run commands shortcut',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
    byApp: {
      liveplanner: { title: 'Run Commands with ⌘K' },
    },
  },
  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'The full shortcut reference and how to toggle shortcuts off.',
    keywords:
      'hotkey hotkeys keybinding cheat sheet reference keys bindings number numbers digit digits tool row excalidraw muscle memory single key letter settings keyboard category draw mode pens shift d disable all',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
];
