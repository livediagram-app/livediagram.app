/** Feature slug → accent colour (hex). The home + features grid and the
 *  MDX <Feature> cards tint each feature with a distinct hue so the index
 *  reads as a colourful catalogue, the same way the Manager Toolkit help
 *  centre does. livediagram's own brand is sky-blue (spec/01); these hues
 *  are drawn from a cool, on-brand palette (sky / indigo / teal / violet /
 *  emerald / amber / rose) so cards stay coherent with the product. */
export const FEATURE_ENTITY_HEX: Record<string, string> = {
  'the-canvas': '#0ea5e9',
  'shapes-and-arrows': '#6366f1',
  drawing: '#f97316',
  'selecting-and-grouping': '#8b5cf6',
  'text-and-fonts': '#0891b2',
  themes: '#d946ef',
  templates: '#14b8a6',
  'using-tabs': '#3b82f6',
  comments: '#f59e0b',
  links: '#10b981',
  images: '#ec4899',
  'the-explorer': '#64748b',
  teams: '#a855f7',
  sharing: '#0284c7',
  'zen-mode': '#475569',
  ai: '#7c3aed',
  'markdown-import': '#0d9488',
  history: '#94a3b8',
  'session-tools': '#f43f5e',
  'data-elements': '#22c55e',
  'style-presets': '#e11d48',
  'layout-cleanup': '#2563eb',
  isometric: '#9333ea',
  annotations: '#eab308',
  'technology-icons': '#0ea5e9',
  recent: '#0ea5e9',
  'shared-with-you': '#10b981',
  'my-work': '#f59e0b',
  'team-spaces': '#a855f7',
  'image-gallery': '#ec4899',
  'themes-library': '#d946ef',
};

/** Default colour used when no slug match is found. */
export const FEATURE_FALLBACK_HEX = '#64748b';
