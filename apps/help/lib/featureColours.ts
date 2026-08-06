import { topCategorySlug } from '@livediagram/help-registry';

/** Feature slug → accent colour (hex). The home + features grid and the
 *  MDX <Feature> cards tint each feature with a distinct hue so the index
 *  reads as a colourful catalogue, the same way the Manager Toolkit help
 *  centre does. livediagram's own brand is sky-blue (spec/01); these hues
 *  are drawn from a cool, on-brand palette (sky / indigo / teal / violet /
 *  emerald / amber / rose) so cards stay coherent with the product. */
export const FEATURE_ENTITY_HEX: Record<string, string> = {
  'panel-layout': '#6366f1',
  toolbar: '#6366f1',
  'context-menus': '#6366f1',
  'zoom-controls': '#6366f1',
  'tab-bar': '#6366f1',
  'quick-controls': '#6366f1',
  'the-canvas': '#0ea5e9',
  drawing: '#f97316',
  'selecting-and-grouping': '#8b5cf6',
  'text-and-fonts': '#0891b2',
  themes: '#d946ef',
  templates: '#14b8a6',
  'using-tabs': '#3b82f6',
  comments: '#f59e0b',
  'live-presence': '#06b6d4',
  links: '#10b981',
  images: '#ec4899',
  'explorer-page': '#64748b',
  'explorer-panel': '#64748b',
  teams: '#a855f7',
  sharing: '#0284c7',
  'zen-mode': '#475569',
  ai: '#7c3aed',
  'markdown-import': '#0d9488',
  history: '#94a3b8',
  'session-tools': '#f43f5e',
  // Canvas sub-article guides
  'adding-elements': '#22c55e',
  'pan-and-zoom': '#0891b2',
  'changing-the-background': '#64748b',
  'changing-theme': '#d946ef',
  'multicolour-themes': '#ec4899',
  'custom-themes': '#a855f7',
  'multi-select': '#8b5cf6',
  groups: '#6366f1',
  'link-cards': '#10b981',
  'choosing-fonts': '#0284c7',
  // Activity Panel category
  'what-it-is': '#94a3b8',
  'how-it-works': '#64748b',
  undo: '#0ea5e9',
  redo: '#06b6d4',
  'reverting-changes': '#f43f5e',
  'data-elements': '#22c55e',
  'style-presets': '#e11d48',
  'layout-cleanup': '#2563eb',
  annotations: '#eab308',
  // Palette → Selection Modes
  highlighter: '#eab308',
  'avatar-mode': '#ec4899',
  'walking-together': '#a855f7',
  'slide-deck': '#0ea5e9',
  select: '#0ea5e9',
  hand: '#0891b2',
  eraser: '#f43f5e',
  'format-painter': '#8b5cf6',
  laser: '#ef4444',
  spotlight: '#f59e0b',
  'isometric-mode': '#9333ea',
  // Palette → Elements
  write: '#0891b2',
  build: '#22c55e',
  'mind-maps': '#8b5cf6',
  collaborate: '#f59e0b',
  chairs: '#a855f7',
  lanes: '#3b82f6',
  entities: '#0284c7',
  'embed-elements': '#e11d48',
  behaviour: '#7c3aed',
  stickers: '#f43f5e',
  shapes: '#6366f1',
  arrows: '#3b82f6',
  tools: '#14b8a6',
  components: '#d946ef',
  devices: '#0284c7',
  icons: '#ec4899',
  technology: '#0ea5e9',
  // Collaboration → Sharing guides
  'share-passwords': '#475569',
  'share-link-expiry': '#f59e0b',
  embeds: '#6366f1',
  'live-image': '#0ea5e9',
  // Collaboration → Voting
  'casting-dots': '#ef4444',
  'vote-layers': '#6366f1',
  'vote-privacy': '#64748b',
  'vote-panel': '#0891b2',
  'vote-results': '#f59e0b',
  // Palette → Data elements
  'progress-elements': '#0ea5e9',
  rating: '#f59e0b',
  'pie-chart': '#ec4899',
  'bar-and-line-charts': '#6366f1',
  'timeline-rail': '#14b8a6',
  // Palette → Behaviour elements
  'mode-buttons': '#7c3aed',
  'session-buttons': '#f43f5e',
  'done-checks': '#22c55e',
  'reaction-pads': '#ec4899',
  'reveal-zones': '#0891b2',
  pickers: '#f59e0b',
  // Palette → Tools elements
  tables: '#0ea5e9',
  pages: '#64748b',
  'sticky-notes': '#eab308',
  'code-blocks': '#475569',
  checklists: '#22c55e',
  portals: '#8b5cf6',
  // Palette → Arrow guides
  'arrow-styles': '#3b82f6',
  'curve-and-elbow-handles': '#8b5cf6',
  'avoiding-elements': '#0891b2',
  'arrow-to-arrow': '#14b8a6',
  // Palette → Collaborate elements
  'comment-panels': '#f59e0b',
  'estimate-cards': '#8b5cf6',
  'temperature-checks': '#ef4444',
  'idea-boxes': '#eab308',
  agendas: '#0891b2',
  'decision-records': '#14b8a6',
  'roll-calls': '#a855f7',
  // Canvas guides
  'follow-along': '#06b6d4',
  notes: '#eab308',
  layers: '#6366f1',
  'layers-visibility-and-locking': '#64748b',
  'layers-organising': '#3b82f6',
  'layer-order': '#2563eb',
  size: '#0284c7',
  rotation: '#7c3aed',
  animations: '#f43f5e',
  shadows: '#475569',
  locking: '#94a3b8',
  snapping: '#22c55e',
  // Palette → Palette Settings
  favourites: '#eab308',
  'panel-opacity': '#64748b',
  'quick-add-on-hover': '#10b981',
  'auto-attach-arrows': '#10b981',
  'alignment-guides': '#22c55e',
  'minimal-panels': '#64748b',
  'reset-palette-position': '#475569',
  // Explorer section guides
  'list-and-card-views': '#0ea5e9',
  timeline: '#8b5cf6',
  folders: '#f59e0b',
  unsorted: '#94a3b8',
  profile: '#0891b2',
  recent: '#0ea5e9',
  'shared-with-you': '#10b981',
  'my-work': '#f59e0b',
  'team-spaces': '#a855f7',
  'image-gallery': '#ec4899',
  'themes-library': '#d946ef',
  'tab-folders': '#3b82f6',
  'linking-tabs': '#10b981',
  'add-to-diagram': '#6366f1',
  'import-tabs': '#0891b2',
  'export-tabs': '#0284c7',
  'tab-cleanup': '#2563eb',
  // Search Panel guides
  'command-palette': '#6366f1',
  'search-diagrams': '#0ea5e9',
  'search-teams': '#a855f7',
  'search-tabs-and-elements': '#3b82f6',
  'search-add-to-canvas': '#22c55e',
  'search-create-tab': '#14b8a6',
  'the-search-panel': '#6366f1',
  'dark-mode': '#475569',
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
  'user-interface': '#6366f1',
  canvas: '#0ea5e9',
  palette: '#ec4899',
  tabs: '#3b82f6',
  explorer: '#64748b',
  collaboration: '#f59e0b',
  tools: '#475569',
  'search-panel': '#0891b2',
  'selection-modes': '#8b5cf6',
  'activity-panel': '#14b8a6',
};

/** Default colour used when no slug match is found. */
export const FEATURE_FALLBACK_HEX = '#64748b';

/** The accent for a feature card: the feature's own hue, else its top-level
 *  category's, else the neutral fallback. Mirrors `featureIcon` so a card's
 *  colour and glyph always resolve at the same level of specificity — a
 *  bespoke glyph with a category hue (or the reverse) looked like a mistake. */
export function featureColour(slug: string, categorySlug?: string): string {
  return (
    FEATURE_ENTITY_HEX[slug] ??
    FEATURE_CATEGORY_HEX[topCategorySlug(categorySlug ?? '')] ??
    FEATURE_FALLBACK_HEX
  );
}
