// Single source for help-centre deep links used by the editor (docs/specs/018-help/contextual-help-links.md).
//
// This map is the live app's one source for help article slugs: surfaces
// reference a symbolic key, never a hand-written `/help/...` URL, so a slug
// change is a one-line edit here. (Search is different: the SearchPanel's
// Help group derives from the full @livedesign/help-registry catalogue in
// help-search.ts; this map exists for the surfaces that link ONE article.)
//
// Each value is the NESTED slug (the path under /help): usually an
// article's categorySlug/slug (matching its page.mdx path in apps/help),
// but it may also be a category LANDING path (e.g. `palette` points at the
// palette overview page.tsx) when the editor links to a whole section
// rather than one article. A key pointing at a path that resolves to no
// help page is a bug, the same way an unregistered help article is - keep
// these in sync with @livedesign/help-registry.

import { helpPathTelemetryId } from '@livedesign/help-registry/telemetry';

export const HELP_ARTICLES = {
  // Sharing
  sharing: 'collaboration/sharing',
  shareLinkExpiry: 'collaboration/sharing/share-link-expiry',
  sharePasswords: 'collaboration/sharing/share-passwords',
  // Palette behaviour
  autoAttachArrows: 'palette/auto-attach-arrows',
  // The embed's article is linked from the link picker, when it is restricted to a URL
  // (docs/specs/009-elements/embed-providers.md).
  embedElements: 'palette/embed-elements',
  alignmentGuides: 'palette/alignment-guides',
  panelOpacity: 'palette/panel-opacity',
  quickAddOnHover: 'palette/quick-add-on-hover',
  isometricMode: 'selection-modes/isometric-mode',
  // One key per tool panel, so every mode's panel can point at the article
  // that explains it (docs/specs/018-help/contextual-help-links.md). Each of these resolves to a real page — a key
  // pointing at nothing is a bug, the same way an unregistered article is.
  laser: 'selection-modes/laser',
  spotlight: 'selection-modes/spotlight',
  eraser: 'selection-modes/eraser',
  formatPainter: 'selection-modes/format-painter',
  slideDeck: 'selection-modes/slide-deck',
  // AI
  connectAiTool: 'account-and-data/connect-ai-mcp',
  // Tabs / import-export
  exportingDiagrams: 'account-and-data/exporting-designs',
  apiTokens: 'account-and-data/api-tokens',
  trash: 'account-and-data/trash',
  importTabs: 'tabs/import-tabs',
  linkingTabs: 'tabs/linking-tabs',
  // Teams
  // Canvas / themes
  changingTheBackground: 'canvas/the-canvas/changing-the-background',
  changingTheme: 'canvas/themes/changing-theme',
  choosingAFinish: 'canvas/finish',
  choosingFonts: 'canvas/text-and-fonts/choosing-fonts',
  // Links / activity / comments
  pagesTour: 'pages/pages-tour',
  links: 'canvas/links',
  comments: 'collaboration/comments',
  livePresence: 'collaboration/live-presence',
  assignedActions: 'collaboration/assigned-actions',
  // Explorer / data
  // Standing panels.
  explorerPanel: 'explorer/explorer-panel',
  layers: 'canvas/layers',
  minimap: 'user-interface/minimap',
  timeline: 'explorer/timeline',
  // The Inbox's article keeps the slug it had as Activity, so links already out there keep working.
  inbox: 'explorer/activity',
  recentDesigns: 'explorer/recent',
  sharedWithYou: 'explorer/shared-with-you',
  folders: 'explorer/folders',
  defaultFolders: 'explorer/folders/default-folders',
  explorerFilters: 'explorer/filters',
  // The shared Explorer's other views, each its page header's Help (lib/explorer-host.ts explorerHelpHref).
  myWork: 'explorer/my-work',
  teamSpaces: 'explorer/team-spaces',
  explorerPage: 'explorer/explorer-page',
  dataElements: 'palette/tools/data-elements',
  sankeyDiagram: 'palette/concept-graphics/sankey-diagram',
  // The round-two element tours' closing cards (docs/specs/007-editor/element-tours.md).
  stacks: 'palette/stacks',
  tabWindows: 'pages/tab-windows',
  conceptGraphics: 'palette/concept-graphics',
  palette: 'palette',
  // Settings
  powerUserMode: 'user-interface/power-user-mode',
  whatWeCollect: 'privacy-and-security/what-we-collect',
  offlineMode: 'privacy-and-security/offline-mode',
  // Onboarding / empty states
  templates: 'canvas/templates',
  logoPages: 'pages/logo-pages',
  wireframePages: 'pages/wireframe-pages',
  photoPages: 'pages/photo-pages',
  // Each page kind's Show Me links its own article (docs/specs/007-editor/pages-tour.md).
  keyboardShortcuts: 'tips-and-tricks/keyboard-shortcuts',
  guestVsAccount: 'getting-started/guest-vs-account',
  // Load recovery (docs/specs/007-editor/load-recovery.md).
  designNotLoading: 'troubleshooting/design-not-loading',
} as const;

export type HelpArticleKey = keyof typeof HELP_ARTICLES;

// The hover card every help link shows for an article unless a surface passes
// its own (docs/specs/018-help/contextual-help-links.md): a "Learn about …" title naming the thing the reader is
// looking at, and one line saying what the article will do for them. One
// table, so a panel, a dialog header and a settings row that all point at
// the same article say the same thing, and a `?` never falls back to a bare
// "Learn more" that tells the reader nothing about where it goes.
export const HELP_LINK_COPY: Record<HelpArticleKey, { title: string; description: string }> = {
  pagesTour: {
    title: 'Learn about the Pages Tour',
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
  laser: {
    title: 'Learn about the Laser',
    description: 'Tips for pointing things out to the room without touching the design.',
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
  slideDeck: {
    title: 'Learn about the Slide Deck',
    description: 'Tips for building and presenting slides from your design.',
  },
  connectAiTool: {
    title: 'Learn about connecting AI tools',
    description: 'Drive your designs from Claude, Cursor, and other AI tools over MCP.',
  },
  exportingDiagrams: {
    title: 'Learn about exporting',
    description: 'What each export format is for and how to use it.',
  },
  apiTokens: {
    title: 'Learn about API tokens',
    description: 'Create tokens to call the livedesign API from your own scripts.',
  },
  trash: {
    title: 'Learn about the Trash',
    description: 'How long deleted designs wait, and how to restore one.',
  },
  importTabs: {
    title: 'Learn about importing tabs',
    description: 'What you can import and how it replaces the tab.',
  },
  linkingTabs: {
    title: 'Learn about linking tabs',
    description: 'How linking to another tab works.',
  },
  changingTheBackground: {
    title: 'Learn about the canvas',
    description: 'Tips for the background, patterns and the canvas behind what you draw.',
  },
  changingTheme: {
    title: 'Learn about changing the theme',
    description: "Tips for restyling a tab's colours in one go.",
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
    description: 'Linking elements to tabs, designs, and web addresses.',
  },
  comments: {
    title: 'Learn about comments',
    description: 'Tips and tricks for discussing a design right on the canvas.',
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
  minimap: {
    title: 'Learn about the Map',
    description: 'Tips for finding your way around a big canvas.',
  },
  timeline: {
    title: 'Learn about Home and the Timeline',
    description: 'Jump Back In, what others did while you were away, and your own Timeline.',
  },
  inbox: {
    title: 'Learn about the Inbox',
    description: 'Open actions assigned to you or by you, and comment threads you are in.',
  },
  recentDesigns: {
    title: 'Learn about Recent',
    description: 'Your most recently opened designs, personal and team, in one list.',
  },
  sharedWithYou: {
    title: 'Learn about Shared With Me',
    description: 'Designs other people have shared with you, collected here.',
  },
  folders: {
    title: 'Learn about folders',
    description: 'Tips for organising designs into a nestable tree of folders.',
  },
  myWork: {
    title: 'Learn about My Work',
    description: 'Every design you made, in folders or none.',
  },
  teamSpaces: {
    title: 'Learn about team spaces',
    description: 'The designs and folders a team shares.',
  },
  explorerPage: {
    title: 'Learn about the Explorer',
    description: 'Find, open and organise every design.',
  },
  defaultFolders: {
    title: 'Learn about default folders',
    description: 'Where new designs land when you pick no place.',
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
  stacks: {
    title: 'Learn about stacks',
    description: 'Rows, columns and grids that lay out what you drop in them.',
  },
  tabWindows: {
    title: 'Learn about tab windows',
    description: 'Show another tab live on a slide, and keep it up to date.',
  },
  conceptGraphics: {
    title: 'Learn about concept graphics',
    description:
      'Stacks, pyramids, funnels, cycles, hubs, onions and chevrons, and editing their rows.',
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
    description: 'Designs saved only in this browser, and how to sync them.',
  },
  templates: {
    title: 'Learn about templates',
    description: 'How templates give you a themed starting point.',
  },
  logoPages: {
    title: 'Learn about logo pages',
    description: 'Guides, mirror drawing, wordmarks, combining shapes and the logo kit.',
  },
  wireframePages: {
    title: 'Learn about wireframe pages',
    description: 'Device frames, ready-made screens, the Elements palette and mockup export.',
  },
  photoPages: {
    title: 'Learn about photo pages',
    description: 'Layers, brushes, selections, adjustments, filters and photo export.',
  },

  livePresence: {
    title: 'Learn about live presence',
    description: 'Who is in the design, where they are, and following them.',
  },
  keyboardShortcuts: {
    title: 'Learn about keyboard shortcuts',
    description: 'The full shortcut reference and tips for faster editing.',
  },
  guestVsAccount: {
    title: 'Learn about guest vs account',
    description: 'What changes when you sign in, and what stays the same.',
  },
  designNotLoading: {
    title: 'Learn about loading problems',
    description: 'Steps to try when a design will not open.',
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
