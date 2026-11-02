/** Feature slug → accent colour (hex). The home + features grid and the
 *  MDX <Feature> cards tint each feature with a distinct hue so the index
 *  reads as a colourful catalogue, the same way the Manager Toolkit help
 *  centre does. liveplanner's own brand is violet (docs/specs/004-interface-design/color-scheme.md); these hues
 *  are drawn from a cool, on-brand palette (sky / indigo / teal / violet /
 *  emerald / amber / rose) so cards stay coherent with the product. */
export const FEATURE_ENTITY_HEX: Record<string, string> = {
  'planning-basics': '#7c3aed',
  'panel-layout': '#6366f1',
  'zoom-controls': '#6366f1',
  'tab-bar': '#6366f1',
  'quick-controls': '#6366f1',
  themes: '#d946ef',
  items: '#7c3aed',
  boards: '#4f46e5',
  cards: '#0d9488',
  'card-types': '#0891b2',
  'select-cards': '#4338ca',
  'card-activity': '#be185d',
  'plan-tour': '#0284c7',
  dashboards: '#0ea5e9',
  forms: '#7c3aed',
  sheets: '#16a34a',
  'sheet-functions': '#059669',
  'using-tabs': '#3b82f6',
  comments: '#f59e0b',
  'live-presence': '#06b6d4',
  'explorer-page': '#64748b',
  'explorer-panel': '#64748b',
  teams: '#a855f7',
  sharing: '#0284c7',
  'zen-mode': '#475569',
  'session-tools': '#f43f5e',
  'locking-tabs': '#64748b',
  'side-by-side': '#0ea5e9',
  about: '#0891b2',
  settings: '#475569',
  'power-user-mode': '#0f766e',
  // Canvas sub-article guides
  'changing-theme': '#d946ef',
  undo: '#0ea5e9',
  redo: '#06b6d4',
  tools: '#14b8a6',
  timer: '#f43f5e',
  voting: '#ef4444',
  'roles-and-invites': '#a855f7',
  'team-shared-projects': '#0ea5e9',
  'share-passwords': '#475569',
  'share-link-expiry': '#f59e0b',
  'one-tab': '#14b8a6',
  embeds: '#6366f1',
  'live-image': '#0ea5e9',
  // Collaboration → Voting
  'casting-dots': '#ef4444',
  'vote-privacy': '#64748b',
  'vote-panel': '#0891b2',
  'vote-results': '#f59e0b',
  // Palette → Data elements
  'list-and-card-views': '#0ea5e9',
  home: '#8b5cf6',
  activity: '#f43f5e',
  timeline: '#d97706',
  folders: '#f59e0b',
  filters: '#6366f1',
  profile: '#0891b2',
  recent: '#0ea5e9',
  'shared-with-you': '#10b981',
  'personal-space': '#f59e0b',
  'team-spaces': '#a855f7',
  'tab-folders': '#3b82f6',
  'add-to-project': '#6366f1',
  'import-tabs': '#0891b2',
  tags: '#e11d48',
  'export-tabs': '#0284c7',
  'command-palette': '#6366f1',
  'search-projects': '#0ea5e9',
  'search-teams': '#a855f7',
  'search-tabs-and-elements': '#3b82f6',
  'search-create-tab': '#14b8a6',
  'the-search-panel': '#6366f1',
  'dark-mode': '#475569',
  'title-bar': '#6366f1',
  visualisations: '#6366f1',
};

/** Top-level feature category → accent hue, the fallback for a landing with no
 *  hue of its own.
 *
 *  Same reason as FEATURE_CATEGORY_ICONS: two thirds of the feature cards had
 *  no entry above, so they all took FEATURE_FALLBACK_HEX and the index read as
 *  a wall of identical grey tiles. One distinct hue per category at least
 *  groups them, so scanning a mixed grid tells you what family a card is in.
 *  Each is drawn from a hue the category's own features already use (User
 *  Interface was uniformly indigo; Palette mostly pink; Collaboration amber),
 *  so this continues the existing scheme rather than introducing a second one.
 */
export const FEATURE_CATEGORY_HEX: Record<string, string> = {
  plan: '#7c3aed',
  'user-interface': '#6366f1',
  tabs: '#3b82f6',
  explorer: '#64748b',
  collaboration: '#f59e0b',
  tools: '#475569',
  'search-panel': '#0891b2',
};
