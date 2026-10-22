// Single source for help-centre deep links used by the editor (docs/specs/018-help/contextual-help-links.md).
//
// This map is the live app's one source for help article slugs: surfaces
// reference a symbolic key, never a hand-written `/help/...` URL, so a slug
// change is a one-line edit here. (Search is different: the SearchPanel's
// Help group derives from the full @liveplanner/help-registry catalogue in
// help-search.ts; this map exists for the surfaces that link ONE article.)
//
// Each value is the NESTED slug (the path under /help): usually an
// article's categorySlug/slug (matching its page.mdx path in apps/help),
// but it may also be a category LANDING path (e.g. `palette` points at the
// palette overview page.tsx) when the editor links to a whole section
// rather than one article. A key pointing at a path that resolves to no
// help page is a bug, the same way an unregistered help article is - keep
// these in sync with @liveplanner/help-registry.

import { helpPathTelemetryId } from '@liveplanner/help-registry/telemetry';

export const HELP_ARTICLES = {
  // Sharing
  sharing: 'collaboration/sharing',
  shareLinkExpiry: 'collaboration/sharing/share-link-expiry',
  sharePasswords: 'collaboration/sharing/share-passwords',
  // Palette behaviour
  autoAttachArrows: 'palette/auto-attach-arrows',
  // Of the elements added in docs/specs/009-elements/youtube-video.md and docs/specs/009-elements/mind-node.md, docs/specs/009-elements/lane.md, docs/specs/009-elements/entity.md, docs/specs/009-elements/embed-providers.md, only the embed has a
  // surface that links its article (the link picker, when it is restricted to
  // a URL). Lanes and entities had keys here and no placement, so they were
  // removed; their element tours brought them back, below. The mind map's Edit
  // Outline dialog links its own sub-article from its header, and the mind
  // map's, the flowchart's and the org chart's element tours (docs/specs/007-editor/element-tours.md) link their
  // articles.
  embedElements: 'palette/embed-elements',
  mindMapOutline: 'palette/mind-maps/edit-outline',
  alignmentGuides: 'palette/alignment-guides',
  panelOpacity: 'palette/panel-opacity',
  quickAddOnHover: 'palette/quick-add-on-hover',
  isometricMode: 'selection-modes/isometric-mode',
  // One key per tool panel, so every mode's panel can point at the article
  // that explains it (docs/specs/018-help/contextual-help-links.md). Each of these resolves to a real page — a key
  // pointing at nothing is a bug, the same way an unregistered article is.
  formatPainter: 'selection-modes/format-painter',
  // AI
  aiTools: 'tools/ai/ai-tools',
  connectAiTool: 'account-and-data/connect-ai-mcp',
  // Tabs / import-export
  exportingDiagrams: 'account-and-data/exporting-diagrams',
  apiTokens: 'account-and-data/api-tokens',
  trash: 'account-and-data/trash',
  importTabs: 'tabs/import-tabs',
  tags: 'explorer/tags',
  linkingTabs: 'tabs/linking-tabs',
  // Teams
  teamRolesAndInvites: 'collaboration/teams/roles-and-invites',
  // Canvas / themes
  changingTheBackground: 'canvas/the-canvas/changing-the-background',
  themes: 'canvas/themes',
  changingTheme: 'canvas/themes/changing-theme',
  choosingAFinish: 'canvas/finish',
  customThemes: 'canvas/themes/custom-themes',
  choosingFonts: 'canvas/text-and-fonts/choosing-fonts',
  // Links / activity / comments
  // Plan mode's card types (docs/specs/026-plan/item-types.md).
  planCardTypes: 'canvas/plan-mode/card-types',
  planBoards: 'canvas/plan-mode/boards',
  planCards: 'canvas/plan-mode/cards',
  planSheets: 'canvas/plan-mode/sheets',
  planDashboards: 'canvas/plan-mode/dashboards',
  planForms: 'canvas/plan-mode/forms',
  planTour: 'canvas/plan-mode/plan-tour',
  links: 'canvas/links',
  comments: 'collaboration/comments',
  livePresence: 'collaboration/live-presence',
  assignedActions: 'collaboration/assigned-actions',
  // Explorer / data
  // Standing panels.
  explorerPanel: 'explorer/explorer-panel',
  layers: 'canvas/layers',
  // The Tidy Up popover's tidiers (docs/specs/008-canvas/layout-cleanup.md).
  minimap: 'user-interface/minimap',
  sessionVoting: 'collaboration/session-tools/voting',
  sessionTimer: 'collaboration/session-tools/timer',
  home: 'explorer/home',
  // The Inbox's article keeps the slug it had as Activity, so links already out there keep working.
  inbox: 'explorer/activity',
  recentProjects: 'explorer/recent',
  sharedWithYou: 'explorer/shared-with-you',
  folders: 'explorer/folders',
  defaultFolders: 'explorer/folders/default-folders',
  explorerFilters: 'explorer/filters',
  dataElements: 'palette/tools/data-elements',
  sankeyDiagram: 'palette/build/sankey-diagram',
  // The round-two element tours' closing cards (docs/specs/007-editor/element-tours.md).
  lanes: 'palette/lanes',
  sequenceDiagram: 'palette/sequence-diagrams',
  palette: 'palette',
  // Settings
  powerUserMode: 'user-interface/power-user-mode',
  whatWeCollect: 'privacy-and-security/what-we-collect',
  offlineMode: 'privacy-and-security/offline-mode',
  // Onboarding / empty states
  keyboardShortcuts: 'tips-and-tricks/keyboard-shortcuts',
  guestVsAccount: 'getting-started/guest-vs-account',
  // Load recovery (docs/specs/007-editor/load-recovery.md).
  projectNotLoading: 'troubleshooting/project-not-loading',
} as const;

export type HelpArticleKey = keyof typeof HELP_ARTICLES;

// The hover card every help link shows for an article unless a surface passes
// its own (docs/specs/018-help/contextual-help-links.md): a "Learn about …" title naming the thing the reader is
// looking at, and one line saying what the article will do for them. One
// table, so a panel, a dialog header and a settings row that all point at
// the same article say the same thing, and a `?` never falls back to a bare
// "Learn more" that tells the reader nothing about where it goes.
export const HELP_LINK_COPY: Record<HelpArticleKey, { title: string; description: string }> = {
  planCardTypes: {
    title: 'Learn about card types',
    description: 'Add your own kinds of card, with the fields each one holds.',
  },
  planBoards: {
    title: 'Learn about boards',
    description: 'Columns, swimlanes, widgets, and the cards each board takes.',
  },
  planCards: {
    title: 'Learn about cards',
    description: 'Open a card, fill it in, and archive, trash or present it.',
  },
  planSheets: {
    title: 'Learn about sheets',
    description: 'Cells, formulas, charts, setup and settings.',
  },
  planDashboards: {
    title: 'Learn about dashboards',
    description: 'Rows of slots, what a slot can show, and arranging them.',
  },
  planForms: {
    title: 'Learn about forms',
    description: 'Questions, where answers go, publishing and responses.',
  },

  planTour: {
    title: 'Learn about the Plan Tour',
    description: 'What the tour shows you and how replaying works.',
  },
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
    description: 'Make the panels translucent so the canvas shows through.',
  },
  quickAddOnHover: {
    title: 'Learn about quick-add on hover',
    description: 'Open the element + menu by hovering instead of clicking.',
  },
  isometricMode: {
    title: 'Learn about the isometric view',
    description: 'How the isometric projection works and when to use it.',
  },
  formatPainter: {
    title: 'Learn about the Format Painter',
    description: "Tips for copying one element's look onto others.",
  },
  aiTools: {
    title: 'Learn about the AI tools',
    description: 'What the Ask and Clean modes do, and how to get the most from them.',
  },
  connectAiTool: {
    title: 'Learn about connecting AI tools',
    description: 'Drive your projects from Claude, Cursor, and other AI tools over MCP.',
  },
  exportingDiagrams: {
    title: 'Learn about exporting',
    description: 'What each export format is for and how to use it.',
  },
  apiTokens: {
    title: 'Learn about API tokens',
    description: 'Create tokens to call the liveplanner API from your own scripts.',
  },
  trash: {
    title: 'Learn about the Trash',
    description: 'How long deleted projects wait, and how to restore one.',
  },
  importTabs: {
    title: 'Learn about importing tabs',
    description: 'What you can import and how it replaces the tab.',
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
    description: 'Build your own palette and reuse it across projects.',
  },
  choosingAFinish: {
    title: 'Learn about finishes',
    description: 'Drawing a tab crisp and print-ready, sketched by hand, or in bold marker.',
  },
  choosingFonts: {
    title: 'Learn about fonts',
    description: 'Tips for choosing a typeface and text size for a tab.',
  },
  links: {
    title: 'Learn about links',
    description: 'Linking elements to tabs, projects, and web addresses.',
  },
  comments: {
    title: 'Learn about comments',
    description: 'Tips and tricks for discussing a project right on the canvas.',
  },
  assignedActions: {
    title: 'Learn about assigned actions',
    description: 'Assign work on an element to yourself or a teammate and track it until done.',
  },
  explorerPanel: {
    title: 'Learn about the Explorer',
    description: 'Tips and tricks to help you get the most out of the Explorer.',
  },
  layers: {
    title: 'Learn about layers',
    description: 'Tips and tricks for stacking, hiding and locking parts of a tab.',
  },
  mindMapOutline: {
    title: 'Learn about editing an outline',
    description: 'Rewrite a mind map as an indented list and save it back in one go.',
  },
  minimap: {
    title: 'Learn about the Map',
    description: 'Tips for finding your way around a big canvas.',
  },
  sessionVoting: {
    title: 'Learn about voting',
    description: 'Tips for running a quick vote across the elements on the canvas.',
  },
  sessionTimer: {
    title: 'Learn about the timer',
    description: 'Tips for keeping a session to time with a countdown or a stopwatch.',
  },
  home: {
    title: 'Learn about Home',
    description: 'Jump Back In, and what others did while you were away.',
  },
  inbox: {
    title: 'Learn about the Inbox',
    description: 'Open actions assigned to you or by you, and comment threads you are in.',
  },
  recentProjects: {
    title: 'Learn about Recent',
    description: 'Your most recently opened projects, personal and team, in one list.',
  },
  tags: {
    title: 'Learn about tags',
    description: 'Coloured labels that group related projects across folders and teams.',
  },
  sharedWithYou: {
    title: 'Learn about Shared With Me',
    description: 'Projects other people have shared with you, collected here.',
  },
  folders: {
    title: 'Learn about folders',
    description: 'Tips for organising projects into a nestable tree of folders.',
  },
  defaultFolders: {
    title: 'Learn about default folders',
    description: 'Where new projects land when you pick no place.',
  },
  explorerFilters: {
    title: 'Learn about search and filters',
    description: 'Narrow any list with words, chips or typed filters like made-by:ai.',
  },
  dataElements: {
    title: 'Learn about data elements',
    description: 'Charts and data-driven elements, and how to edit their data.',
  },
  sankeyDiagram: {
    title: 'Learn about Sankey diagrams',
    description: 'Writing flows, reading the bands, and styling nodes and labels.',
  },
  lanes: {
    title: 'Learn about lanes',
    description: 'Swimlanes: title gutters, seams, and columns as well as rows.',
  },
  sequenceDiagram: {
    title: 'Learn about sequence diagrams',
    description: 'Writing participants and messages, and the three kinds of arrow.',
  },
  palette: {
    title: 'Learn about the Palette',
    description: 'Tips and tricks to help you get the most out of the Palette.',
  },
  powerUserMode: {
    title: 'Learn about power user mode',
    description: 'The recommended settings it applies, and Minimal chrome.',
  },
  whatWeCollect: {
    title: 'Learn about what we collect',
    description: "Exactly which anonymous events are sent, and what isn't.",
  },
  offlineMode: {
    title: 'Learn about Offline Mode',
    description: 'Projects saved only in this browser, and how to sync them.',
  },
  livePresence: {
    title: 'Learn about live presence',
    description: 'Who is in the project, where they are, and following them.',
  },
  keyboardShortcuts: {
    title: 'Learn about keyboard shortcuts',
    description: 'The full shortcut reference and tips for faster editing.',
  },
  guestVsAccount: {
    title: 'Learn about guest vs account',
    description: 'What changes when you sign in, and what stays the same.',
  },
  projectNotLoading: {
    title: 'Learn about loading problems',
    description: 'Steps to try when a project will not open.',
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
