// Single source for help-centre deep links used by the editor (docs/specs/018-help/contextual-help-links.md).
//
// This map is the editor app's one source for help article slugs: surfaces
// reference a symbolic key, never a hand-written `/help/...` URL, so a slug
// change is a one-line edit here. (Search is different: the SearchPanel's
// Help group derives from the full @livehuddle/help-registry catalogue in
// help-search.ts; this map exists for the surfaces that link ONE article.)
//
// Each value is the NESTED slug (the path under /help): usually an
// article's categorySlug/slug (matching its page.mdx path in apps/help),
// but it may also be a category LANDING path (e.g. `palette` points at the
// palette overview page.tsx) when the editor links to a whole section
// rather than one article. A key pointing at a path that resolves to no
// help page is a bug, the same way an unregistered help article is - keep
// these in sync with @livehuddle/help-registry.

import { COMMUNITY_HELP } from '@livehuddle/help-registry/community';
import { helpPathTelemetryId } from '@livehuddle/help-registry/telemetry';

export const HELP_ARTICLES = {
  // Sharing
  sharing: 'collaboration/sharing',
  shareLinkExpiry: 'collaboration/sharing/share-link-expiry',
  sharePasswords: 'collaboration/sharing/share-passwords',
  // The Community's own help map holds the path (the public sites link it too).
  community: COMMUNITY_HELP.sharing.path,
  // Palette behaviour
  // The diagram tools left livehuddle (Work Tracker #423 part 3, docs/specs/002-project-scope/not-in-livehuddle.md):
  // their articles went, but a stored element of a leaving kind still draws and its surfaces still link, so these keys
  // land on the nearest article that stays (the router redirects the old addresses the same way).
  embedElements: 'palette/tools/images',
  alignmentGuides: 'palette/alignment-guides',
  panelOpacity: 'palette/panel-opacity',
  // One key per tool panel, so every mode's panel can point at the article
  // that explains it (docs/specs/018-help/contextual-help-links.md). Each of these resolves to a real page — a key
  // pointing at nothing is a bug, the same way an unregistered article is.
  avatarMode: 'selection-modes/avatar-mode',
  eraser: 'selection-modes/eraser',
  formatPainter: 'selection-modes/format-painter',
  // AI
  connectAiTool: 'account-and-data/connect-ai-mcp',
  // Tabs / import-export
  exportingSpaces: 'account-and-data/exporting-spaces',
  apiTokens: 'account-and-data/api-tokens',
  trash: 'account-and-data/trash',
  importTabs: 'tabs/import-tabs',
  linkingTabs: 'tabs/linking-tabs',
  // Canvas / themes
  changingTheBackground: 'canvas/the-canvas/changing-the-background',
  changingTheme: 'canvas/themes/changing-theme',
  choosingAFinish: 'canvas/finish',
  choosingFonts: 'canvas/text-and-fonts/choosing-fonts',
  // Links / activity / comments
  avatarTour: 'selection-modes/avatar-mode/avatar-tour',
  links: 'canvas/links',
  comments: 'collaboration/comments',
  livePresence: 'collaboration/live-presence',
  // The call strip's `?` (CallClusterButton); the article links on to Cameras and Screen Sharing.
  proximityAudio: 'collaboration/proximity-audio',
  assignedActions: 'collaboration/assigned-actions',
  // Explorer / data
  // Standing panels.
  explorerPanel: 'explorer/explorer-panel',
  // The Tidy Up popover's tidiers (docs/specs/008-canvas/layout-cleanup.md).
  layoutCleanup: 'tools/layout-cleanup',
  minimap: 'user-interface/minimap',
  sessionTimer: 'collaboration/session-tools/timer',
  imageGallery: 'explorer/image-gallery',
  timeline: 'explorer/timeline',
  // The Inbox's article keeps the slug it had as Activity, so links already out there keep working.
  inbox: 'explorer/activity',
  sharedWithYou: 'explorer/shared-with-you',
  folders: 'explorer/folders',
  defaultFolders: 'explorer/folders/default-folders',
  explorerFilters: 'explorer/filters',
  // Home and the Timeline share an article.
  home: 'explorer/timeline',
  // The shared Explorer's other views, each its page header's Help (lib/explorer-host.ts explorerHelpHref).
  myWork: 'explorer/my-work',
  recent: 'explorer/recent',
  teamSpaces: 'explorer/team-spaces',
  explorerPage: 'explorer/explorer-page',
  dataElements: 'palette/tools',
  // The round-two element tours' closing cards (docs/specs/007-editor/element-tours.md). All but the portal's are
  // leaving kinds, so they land on the Virtual Office, whose Rooms mark out an area of a Space.
  stacks: 'palette/virtual-office',
  lanes: 'palette/virtual-office',
  boundaries: 'palette/virtual-office',
  diagramKeys: 'palette/virtual-office',
  portals: 'palette/tools/portals',
  timelineRail: 'palette/virtual-office',
  palette: 'palette',
  // Settings
  whatWeCollect: 'privacy-and-security/what-we-collect',
  offlineMode: 'privacy-and-security/offline-mode',
  // Onboarding / empty states
  yourFirstSpace: 'getting-started/your-first-space',
  templates: 'canvas/templates',
  keyboardShortcuts: 'tips-and-tricks/keyboard-shortcuts',
  guestVsAccount: 'getting-started/guest-vs-account',
  // Load recovery (docs/specs/007-editor/load-recovery.md).
  documentNotLoading: 'troubleshooting/document-not-loading',
} as const;

export type HelpArticleKey = keyof typeof HELP_ARTICLES;

// The hover card every help link shows for an article unless a surface passes
// its own (docs/specs/018-help/contextual-help-links.md): a "Learn about …" title naming the thing the reader is
// looking at, and one line saying what the article will do for them. One
// table, so a panel, a dialog header and a settings row that all point at
// the same article say the same thing, and a `?` never falls back to a bare
// "Learn more" that tells the reader nothing about where it goes.
export const HELP_LINK_COPY: Record<HelpArticleKey, { title: string; description: string }> = {
  avatarTour: {
    title: 'Learn about the Avatar Tour',
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
  community: {
    title: 'Learn about the Community',
    description: 'Sharing a space publicly, and how people find and copy it.',
  },
  embedElements: {
    title: 'Learn about images',
    description: 'Uploading, searching for and reusing pictures.',
  },
  alignmentGuides: {
    title: 'Learn about alignment guides',
    description: 'How snap lines help you line elements up.',
  },
  panelOpacity: {
    title: 'Learn about panel opacity',
    description: 'Make the panels translucent so the canvas shows through.',
  },
  avatarMode: {
    title: 'Learn about Avatar mode',
    description: 'Tips for walking the canvas as an avatar and leading a session.',
  },
  eraser: {
    title: 'Learn about the Eraser',
    description: 'Tips for rubbing out sketches and elements without selecting them first.',
  },
  formatPainter: {
    title: 'Learn about the Format Painter',
    description: "Tips for copying one element's look onto others.",
  },
  connectAiTool: {
    title: 'Learn about connecting AI tools',
    description: 'Drive your spaces from Claude, Cursor, and other AI tools over MCP.',
  },
  exportingSpaces: {
    title: 'Learn about exporting',
    description: 'What each export format is for and how to use it.',
  },
  apiTokens: {
    title: 'Learn about API tokens',
    description: 'Create tokens to call the livehuddle API from your own scripts.',
  },
  trash: {
    title: 'Learn about the Trash',
    description: 'How long deleted spaces wait, and how to restore one.',
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
    description: 'Linking elements to tabs, spaces, and web addresses.',
  },
  comments: {
    title: 'Learn about comments',
    description: 'Tips and tricks for discussing your work right on the canvas.',
  },
  assignedActions: {
    title: 'Learn about assigned actions',
    description: 'Assign work on an element to yourself or a teammate and track it until done.',
  },
  explorerPanel: {
    title: 'Learn about the Explorer',
    description: 'Tips and tricks to help you get the most out of the Explorer.',
  },
  layoutCleanup: {
    title: 'Learn about tidying a layout',
    description:
      'Tips for laying a diagram out in one press, and choosing the style that suits it.',
  },
  minimap: {
    title: 'Learn about the Map',
    description: 'Tips for finding your way around a big canvas.',
  },
  sessionTimer: {
    title: 'Learn about the timer',
    description: 'Tips for keeping a session to time with a countdown or a stopwatch.',
  },
  imageGallery: {
    title: 'Learn about the Image Gallery',
    description: 'How uploaded images are stored and reused across spaces.',
  },
  timeline: {
    title: 'Learn about Home and the Timeline',
    description: 'Jump Back In, what others did while you were away, and your own Timeline.',
  },
  inbox: {
    title: 'Learn about the Inbox',
    description: 'Open actions assigned to you or by you, and comment threads you are in.',
  },
  sharedWithYou: {
    title: 'Learn about Shared With Me',
    description: 'Spaces other people have shared with you, collected here.',
  },
  folders: {
    title: 'Learn about folders',
    description: 'Tips for organising spaces into a nestable tree of folders.',
  },
  defaultFolders: {
    title: 'Learn about default folders',
    description: 'Where new diagrams, whiteboards and boards land when you pick no place.',
  },
  explorerFilters: {
    title: 'Learn about search and filters',
    description: 'Narrow any list with words, chips or typed filters like made-by:ai.',
  },
  home: {
    title: 'Learn about Home and the Timeline',
    description: 'Jump Back In, what others did while you were away, and your own Timeline.',
  },
  myWork: {
    title: 'Learn about My Work',
    description: 'Your own spaces and folders, in one place.',
  },
  recent: {
    title: 'Learn about Recent',
    description: 'Your most recently opened spaces, personal and team, in one list.',
  },
  teamSpaces: {
    title: 'Learn about team spaces',
    description: 'A team’s shared library of spaces and folders.',
  },
  explorerPage: {
    title: 'Learn about the Explorer',
    description: 'The library every liveworkspace app shares: sections, views and search.',
  },
  dataElements: {
    title: 'Learn about the palette',
    description: 'Where each element lives, category by category.',
  },
  stacks: {
    title: 'Learn about frames',
    description: 'Labelled sections that carry what sits inside them.',
  },
  lanes: {
    title: 'Learn about frames',
    description: 'Labelled sections that carry what sits inside them.',
  },
  boundaries: {
    title: 'Learn about frames',
    description: 'Labelled sections that carry what sits inside them.',
  },
  diagramKeys: {
    title: 'Learn about frames',
    description: 'Labelled sections that carry what sits inside them.',
  },
  portals: {
    title: 'Learn about portals',
    description: 'Linked rings that take you across the canvas or to another tab.',
  },
  timelineRail: {
    title: 'Learn about frames',
    description: 'Labelled sections that carry what sits inside them.',
  },
  palette: {
    title: 'Learn about the Palette',
    description: 'Tips and tricks to help you get the most out of the Palette.',
  },
  whatWeCollect: {
    title: 'Learn about what we collect',
    description: "Exactly which anonymous events are sent, and what isn't.",
  },
  offlineMode: {
    title: 'Learn about Offline Mode',
    description: 'Spaces saved only in this browser, and how to sync them.',
  },
  yourFirstSpace: {
    title: 'Learn about your first Space',
    description: 'A short walkthrough of opening your first Space and meeting in it.',
  },
  templates: {
    title: 'Learn about templates',
    description: 'How templates give you a themed starting point.',
  },
  livePresence: {
    title: 'Learn about live presence',
    description: 'Who is in the canvas, where they are, and following them.',
  },
  proximityAudio: {
    title: 'Learn about calls',
    description: 'Talking with the people near you, your microphone, cameras and screen sharing.',
  },
  keyboardShortcuts: {
    title: 'Learn about keyboard shortcuts',
    description: 'The full shortcut reference and tips for faster editing.',
  },
  guestVsAccount: {
    title: 'Learn about guest vs account',
    description: 'What changes when you sign in, and what stays the same.',
  },
  documentNotLoading: {
    title: 'Learn about loading problems',
    description: 'Steps to try when a space will not open.',
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
