// Raw icon-sized <svg> guard (docs/specs/004-interface-design/iconography.md, "Guarding"): every
// chrome icon renders through the Glyph primitive, so a hand-painted <svg> with a literal width of
// 8 to 24px is an icon that bypassed it. Art (feature illustrations, style-value previews, brand
// marks, canvas content, fixtures) lives in the files listed below and keeps its own paint.

export const RAW_ICON_SVG = {
  selector: [
    "JSXOpeningElement[name.name='svg'] > JSXAttribute[name.name='width'][value.value=/^([89]|1[0-9]|2[0-4])$/]",
    "JSXOpeningElement[name.name='svg'] > JSXAttribute[name.name='width'][value.expression.value<=24]",
  ].join(', '),
  message:
    'Icons render through Glyph (or lucideGlyph) from @livediagram/ui. Art belongs in a file on ICON_ART_ALLOWLIST (packages/eslint-config/raw-svg.js).',
};

// Globs resolve from each workspace's own eslint config, so they start at `**/components`.
export const ICON_ART_ALLOWLIST = [
  // Test fixtures render raw markup on purpose.
  '**/*.test.tsx',
  // Marketing illustrations and the hero's mimicry of the editor chrome.
  '**/components/feature-art/**',
  '**/components/HeroIllustration.tsx',
  '**/components/hero-editor-window.tsx',
  '**/components/hero-theme-dialog.tsx',
  '**/components/hero-illustration-glyphs.tsx',
  // Style-value previews, option previews and coloured chips.
  '**/components/palette/palette-style-previews.tsx',
  '**/components/palette/palette-tile-art.tsx',
  '**/components/palette/context-menu-tiles.tsx',
  '**/components/palette/context-menu-data-editors.tsx',
  '**/components/canvas/quick-style-rows.tsx',
  '**/components/canvas/infographic-layout-thumb.tsx',
  '**/components/dialogs/export-format-icons.tsx',
  '**/components/dialogs/import-source-icons.tsx',
  // Canvas content: a checklist tick and a collaborator's cursor.
  '**/components/canvas/ChecklistView.tsx',
  '**/components/canvas/RemoteCursor.tsx',
];
