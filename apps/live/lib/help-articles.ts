// Single source for help-centre deep links used by the editor (docs/specs/018-help/contextual-help-links.md).
//
// This map is the live app's one source for help article slugs: surfaces
// reference a symbolic key, never a hand-written `/help/...` URL, so a slug
// change is a one-line edit here. (Search is different: the SearchPanel's
// Help group derives from the full @livediagram/help-registry catalogue in
// help-search.ts; this map exists for the surfaces that link ONE article.)
//
// Each value is the NESTED slug (the path under /help): usually an
// article's categorySlug/slug (matching its page.mdx path in apps/help),
// but it may also be a category LANDING path (e.g. `palette` points at the
// palette overview page.tsx) when the editor links to a whole section
// rather than one article. A key pointing at a path that resolves to no
// help page is a bug, the same way an unregistered help article is - keep
// these in sync with @livediagram/help-registry.

import { helpPathTelemetryId } from '@livediagram/help-registry/telemetry';

export const HELP_ARTICLES = {
  // Sharing
  sharing: 'collaboration/sharing',
  shareLinkExpiry: 'collaboration/sharing/share-link-expiry',
  sharePasswords: 'collaboration/sharing/share-passwords',
  // Palette behaviour
  autoAttachArrows: 'palette/auto-attach-arrows',
  // Of the elements added in docs/specs/009-elements/youtube-video.md and docs/specs/009-elements/mind-node.md, docs/specs/009-elements/lane.md, docs/specs/009-elements/entity.md, docs/specs/009-elements/embed-providers.md, only the embed has a
  // surface that links its article (the link picker, when it is restricted to
  // a URL). Mind maps, lanes and entities had keys here and no placement, so
  // they were removed; their articles are still in the help centre.
  embedElements: 'palette/embed-elements',
  alignmentGuides: 'palette/alignment-guides',
  panelOpacity: 'palette/panel-opacity',
  quickStylePanel: 'canvas/quick-style-panel',
  quickAddOnHover: 'palette/quick-add-on-hover',
  isometricMode: 'selection-modes/isometric-mode',
  // One key per tool panel, so every mode's panel can point at the article
  // that explains it (docs/specs/018-help/contextual-help-links.md). Each of these resolves to a real page — a key
  // pointing at nothing is a bug, the same way an unregistered article is.
  avatarMode: 'selection-modes/avatar-mode',
  laser: 'selection-modes/laser',
  spotlight: 'selection-modes/spotlight',
  eraser: 'selection-modes/eraser',
  formatPainter: 'selection-modes/format-painter',
  highlighter: 'selection-modes/highlighter',
  slideDeck: 'selection-modes/slide-deck',
  // AI
  aiTools: 'tools/ai/ai-tools',
  connectAiTool: 'account-and-data/connect-ai-mcp',
  // Tabs / import-export
  exportingDiagrams: 'account-and-data/exporting-diagrams',
  apiTokens: 'account-and-data/api-tokens',
  trash: 'account-and-data/trash',
  googleDrive: 'account-and-data/google-drive',
  importTabs: 'tabs/import-tabs',
  markdownImport: 'tools/markdown-import',
  microsoftWhiteboardImport: 'explorer/microsoft-whiteboard-import',
  drawioImport: 'explorer/drawio-import',
  shapeLibraries: 'explorer/shape-libraries',
  linkingTabs: 'tabs/linking-tabs',
  // Teams
  teamRolesAndInvites: 'collaboration/teams/roles-and-invites',
  // Canvas / themes
  changingTheBackground: 'canvas/the-canvas/changing-the-background',
  themes: 'canvas/themes',
  changingTheme: 'canvas/themes/changing-theme',
  customThemes: 'canvas/themes/custom-themes',
  choosingFonts: 'canvas/text-and-fonts/choosing-fonts',
  // Links / activity / comments
  links: 'canvas/links',
  comments: 'collaboration/comments',
  livePresence: 'collaboration/live-presence',
  assignedActions: 'collaboration/assigned-actions',
  // Explorer / data
  // Standing panels.
  explorerPanel: 'explorer/explorer-panel',
  activityPanel: 'activity-panel/what-it-is',
  layers: 'canvas/layers',
  minimap: 'user-interface/minimap',
  sessionPolls: 'collaboration/session-tools/polls',
  sessionVoting: 'collaboration/session-tools/voting',
  imageGallery: 'explorer/image-gallery',
  timeline: 'explorer/timeline',
  activity: 'explorer/activity',
  recentDocuments: 'explorer/recent',
  sharedWithYou: 'explorer/shared-with-you',
  folders: 'explorer/folders',
  explorerFilters: 'explorer/filters',
  dataElements: 'palette/tools/data-elements',
  palette: 'palette',
  // Settings
  toolbarLayout: 'palette/toolbar-layout',
  powerUserMode: 'user-interface/power-user-mode',
  welcomeTour: 'getting-started/welcome-tour',
  whatWeCollect: 'privacy-and-security/what-we-collect',
  offlineMode: 'privacy-and-security/offline-mode',
  // Onboarding / empty states
  yourFirstDiagram: 'getting-started/your-first-diagram',
  templates: 'canvas/templates',
  drawMode: 'canvas/draw-mode',
  keyboardShortcuts: 'tips-and-tricks/keyboard-shortcuts',
  guestVsAccount: 'getting-started/guest-vs-account',
} as const;

export type HelpArticleKey = keyof typeof HELP_ARTICLES;

// The hover card every help link shows for an article unless a surface passes
// its own (docs/specs/018-help/contextual-help-links.md): a "Learn about …" title naming the thing the reader is
// looking at, and one line saying what the article will do for them. One
// table, so a panel, a dialog header and a settings row that all point at
// the same article say the same thing, and a `?` never falls back to a bare
// "Learn more" that tells the reader nothing about where it goes.
export const HELP_LINK_COPY: Record<HelpArticleKey, { title: string; description: string }> = {
  sharing: {
    title: 'Learn about sharing',
    description: 'Roles, live collaboration, and how share links work.',
  },
  shareLinkExpiry: {
    title: 'Learn about link expiry',
    description: 'How long a share link lasts and where expired links go.',
  },
  sharePasswords: {
    title: 'Learn about share passwords',
    description: 'How the optional password gate protects every link.',
  },
  autoAttachArrows: {
    title: 'Learn about auto-attach arrows',
    description: 'How arrows re-pin to shapes as they move.',
  },
  embedElements: {
    title: 'Learn about embeds',
    description: 'Which services can be embedded, and how they load.',
  },
  alignmentGuides: {
    title: 'Learn about alignment guides',
    description: 'How snap lines help you line elements up.',
  },
  panelOpacity: {
    title: 'Learn about panel opacity',
    description: 'Make the floating panels translucent so the canvas shows through.',
  },
  quickStylePanel: {
    title: 'Learn about the quick style panel',
    description: 'One-click colours and lines, and how the next shape remembers them.',
  },
  quickAddOnHover: {
    title: 'Learn about quick-add on hover',
    description: 'Open the element + menu by hovering instead of clicking.',
  },
  isometricMode: {
    title: 'Learn about the isometric view',
    description: 'How the isometric projection works and when to use it.',
  },
  avatarMode: {
    title: 'Learn about Avatar mode',
    description: 'Tips for walking the canvas as an avatar and leading a session.',
  },
  laser: {
    title: 'Learn about the Laser',
    description: 'Tips for pointing things out to the room without touching the document.',
  },
  spotlight: {
    title: 'Learn about the Spotlight',
    description: 'Tips for dimming everything but the part you are talking about.',
  },
  eraser: {
    title: 'Learn about the Eraser',
    description: 'Tips for rubbing out sketches and elements without selecting them first.',
  },
  formatPainter: {
    title: 'Learn about the Format Painter',
    description: "Tips for copying one element's look onto others.",
  },
  highlighter: {
    title: 'Learn about the Highlighter',
    description: 'Tips for marking up the canvas with translucent strokes.',
  },
  slideDeck: {
    title: 'Learn about the Slide Deck',
    description: 'Tips for building and presenting slides from your document.',
  },
  aiTools: {
    title: 'Learn about the AI tools',
    description: 'What the Ask and Clean modes do, and how to get the most from them.',
  },
  connectAiTool: {
    title: 'Learn about connecting AI tools',
    description: 'Drive your documents from Claude, Cursor, and other AI tools over MCP.',
  },
  exportingDiagrams: {
    title: 'Learn about exporting',
    description: 'What each export format is for and how to use it.',
  },
  apiTokens: {
    title: 'Learn about API tokens',
    description: 'Create tokens to call the livediagram API from your own scripts.',
  },
  trash: {
    title: 'Learn about the Trash',
    description: 'How long deleted documents wait, and how to restore one.',
  },
  googleDrive: {
    title: 'Learn about Google Drive sync',
    description: 'What is copied to Drive, how often, and what travels back.',
  },
  importTabs: {
    title: 'Learn about importing tabs',
    description: 'What you can import and how it replaces the tab.',
  },
  microsoftWhiteboardImport: {
    title: 'Learn about Microsoft Whiteboard import',
    description: 'What a board export is and how each board becomes a document.',
  },
  shapeLibraries: {
    title: 'Learn about shape libraries',
    description: 'How libraries are made, placed from My shapes, and managed.',
  },
  drawioImport: {
    title: 'Learn about draw.io import',
    description: 'Which files it reads and how each diagram becomes a document.',
  },
  markdownImport: {
    title: 'Learn about Markdown import',
    description: 'How headings and lists become a themed tree diagram.',
  },
  linkingTabs: {
    title: 'Learn about linking tabs',
    description: 'How linking to another tab works.',
  },
  teamRolesAndInvites: {
    title: 'Learn about teams',
    description: 'Admin and Member roles, and how invites work.',
  },
  changingTheBackground: {
    title: 'Learn about the canvas',
    description: 'Tips for the background, patterns and the canvas behind what you draw.',
  },
  themes: { title: 'Learn about themes', description: 'How themes restyle a whole tab.' },
  changingTheme: {
    title: 'Learn about changing the theme',
    description: "Tips for restyling a tab's colours in one go.",
  },
  customThemes: {
    title: 'Learn about custom themes',
    description: 'Build your own palette and reuse it across documents.',
  },
  choosingFonts: {
    title: 'Learn about fonts',
    description: 'Tips for choosing a typeface and text size for a tab.',
  },
  links: {
    title: 'Learn about links',
    description: 'Linking elements to tabs, documents, and web addresses.',
  },
  comments: {
    title: 'Learn about comments',
    description: 'Tips and tricks for discussing a document right on the canvas.',
  },
  assignedActions: {
    title: 'Learn about assigned actions',
    description: 'Assign work on an element to yourself or a teammate and track it until done.',
  },
  explorerPanel: {
    title: 'Learn about the Explorer',
    description: 'Tips and tricks to help you get the most out of the Explorer.',
  },
  activityPanel: {
    title: 'Learn about the Activity panel',
    description: 'Tips for reading, filtering and reverting the change log.',
  },
  layers: {
    title: 'Learn about layers',
    description: 'Tips and tricks for stacking, hiding and locking parts of a tab.',
  },
  minimap: {
    title: 'Learn about the Map',
    description: 'Tips for finding your way around a big canvas.',
  },
  sessionPolls: {
    title: 'Learn about polls',
    description: 'Tips for asking the room a question and sharing the results.',
  },
  sessionVoting: {
    title: 'Learn about voting',
    description: 'Tips for running a quick vote across the elements on the canvas.',
  },
  imageGallery: {
    title: 'Learn about the Image Gallery',
    description: 'How uploaded images are stored and reused across documents.',
  },
  timeline: {
    title: 'Learn about Home',
    description: 'Everything that has happened across your documents, teams and account.',
  },
  activity: {
    title: 'Learn about Activity',
    description: 'Open actions assigned to you or by you, and comment threads you are in.',
  },
  recentDocuments: {
    title: 'Learn about Recent',
    description: 'Your most recently opened documents, personal and team, in one list.',
  },
  sharedWithYou: {
    title: 'Learn about Shared with me',
    description: 'Documents other people have shared with you, collected here.',
  },
  folders: {
    title: 'Learn about folders',
    description: 'Tips for organising documents into a nestable tree of folders.',
  },
  explorerFilters: {
    title: 'Learn about search and filters',
    description: 'Narrow any list with words, chips or typed filters like made-by:ai.',
  },
  dataElements: {
    title: 'Learn about data elements',
    description: 'Charts and data-driven elements, and how to edit their data.',
  },
  palette: {
    title: 'Learn about the Palette',
    description: 'Tips and tricks to help you get the most out of the Palette.',
  },
  toolbarLayout: {
    title: 'Learn about the toolbar layout',
    description: 'The palette as one strip across the top of the canvas.',
  },
  powerUserMode: {
    title: 'Learn about power user mode',
    description: 'The recommended settings it applies, and Minimal chrome.',
  },
  welcomeTour: {
    title: 'Learn about the Welcome Tour',
    description: 'What the tour covers and how replaying works.',
  },
  whatWeCollect: {
    title: 'Learn about what we collect',
    description: "Exactly which anonymous events are sent, and what isn't.",
  },
  offlineMode: {
    title: 'Learn about Offline Mode',
    description: 'Documents saved only in this browser, and how to sync them.',
  },
  yourFirstDiagram: {
    title: 'Learn about your first diagram',
    description: 'A short walkthrough of building your first diagram.',
  },
  templates: {
    title: 'Learn about templates',
    description: 'How templates give you a themed starting point.',
  },
  drawMode: {
    title: 'Learn about Draw mode',
    description: 'Switching modes, the dock, its pens and shapes, and where it sits.',
  },
  livePresence: {
    title: 'Learn about live presence',
    description: 'Who is in the document, where they are, and following them.',
  },
  keyboardShortcuts: {
    title: 'Learn about keyboard shortcuts',
    description: 'The full shortcut reference and tips for faster editing.',
  },
  guestVsAccount: {
    title: 'Learn about guest vs account',
    description: 'What changes when you sign in, and what stays the same.',
  },
};

/** Absolute in-app path to a help article, opened in a new tab. */
export function helpArticleHref(key: HelpArticleKey): string {
  return `/help/${HELP_ARTICLES[key]}/`;
}

/**
 * The article's telemetry id, used as the `type` on a help-link click
 * (`UI·Opened`). The full nested slug contains slashes, which
 * TELEMETRY_TYPE_PATTERN rejects; the registry's per-article id (docs/specs/017-telemetry/telemetry.md) is
 * a bounded token that, unlike the bare leaf segment, is unique per article
 * and matches what the help centre itself reports for the same page.
 */
export function helpArticleTelemetryId(key: HelpArticleKey): string {
  return helpPathTelemetryId(HELP_ARTICLES[key]);
}
