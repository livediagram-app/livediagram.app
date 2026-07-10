// Single source for help-centre deep links used by the editor (spec/56).
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

export const HELP_ARTICLES = {
  // Sharing
  sharing: 'collaboration/sharing',
  shareLinkExpiry: 'collaboration/sharing/share-link-expiry',
  sharePasswords: 'collaboration/sharing/share-passwords',
  // Palette behaviour
  autoAttachArrows: 'palette/auto-attach-arrows',
  alignmentGuides: 'palette/alignment-guides',
  panelOpacity: 'palette/panel-opacity',
  quickAddOnHover: 'palette/quick-add-on-hover',
  isometricMode: 'selection-modes/isometric-mode',
  // AI
  aiTools: 'tools/ai/ai-tools',
  connectAiTool: 'account-and-data/connect-ai-mcp',
  // Tabs / import-export
  exportingDiagrams: 'account-and-data/exporting-diagrams',
  apiTokens: 'account-and-data/api-tokens',
  importTabs: 'tabs/import-tabs',
  markdownImport: 'tools/markdown-import',
  linkingTabs: 'tabs/linking-tabs',
  // Teams
  teamRolesAndInvites: 'collaboration/teams/roles-and-invites',
  // Canvas / themes
  changingTheBackground: 'canvas/the-canvas/changing-the-background',
  themes: 'canvas/themes',
  changingTheme: 'canvas/themes/changing-theme',
  customThemes: 'canvas/themes/custom-themes',
  // Links / activity / comments
  links: 'canvas/links',
  revertingChanges: 'activity-panel/reverting-changes',
  comments: 'collaboration/comments',
  assignedActions: 'collaboration/assigned-actions',
  // Explorer / data
  explorerPanel: 'explorer/explorer-panel',
  imageGallery: 'explorer/image-gallery',
  recentDiagrams: 'explorer/recent',
  sharedWithYou: 'explorer/shared-with-you',
  folders: 'explorer/folders',
  unsorted: 'explorer/unsorted',
  dataElements: 'palette/tools/data-elements',
  palette: 'palette',
  // Settings
  minimalPanels: 'palette/minimal-panels',
  whatWeCollect: 'privacy-and-security/what-we-collect',
  offlineMode: 'privacy-and-security/offline-mode',
  // Onboarding / empty states
  yourFirstDiagram: 'getting-started/your-first-diagram',
  templates: 'canvas/templates',
  keyboardShortcuts: 'tips-and-tricks/keyboard-shortcuts',
  guestVsAccount: 'getting-started/guest-vs-account',
} as const;

export type HelpArticleKey = keyof typeof HELP_ARTICLES;

/** Absolute in-app path to a help article, opened in a new tab. */
export function helpArticleHref(key: HelpArticleKey): string {
  return `/help/${HELP_ARTICLES[key]}/`;
}

/**
 * The article's leaf slug, used as the telemetry `type` on a help-link
 * click. The full nested slug contains slashes, which TELEMETRY_TYPE_PATTERN
 * rejects; the leaf (e.g. `share-link-expiry`) is a safe, bounded token.
 */
export function helpArticleLeaf(key: HelpArticleKey): string {
  const slug = HELP_ARTICLES[key];
  return slug.slice(slug.lastIndexOf('/') + 1);
}
