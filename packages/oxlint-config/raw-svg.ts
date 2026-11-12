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
    'Icons render through Glyph (or lucideGlyph) from the product ui package (@livediagram/ui, @liveplanner/ui, ...). Art belongs in a file on ICON_ART_ALLOWLIST (packages/oxlint-config/raw-svg.ts).',
};

// Globs resolve from each workspace's own oxlint config, so they start at `**/components`. One list serves every
// product: a file named here that a product doesn't have allows nothing there.
export const ICON_ART_ALLOWLIST = [
  // Test fixtures render raw markup on purpose.
  '**/*.test.tsx',
  // Marketing illustrations and the hero's mimicry of the editor chrome.
  '**/components/feature-art/**',
  '**/components/hero-editor-window.tsx',
  '**/components/hero-illustration-glyphs.tsx',
  // Style-value previews, option previews and coloured chips.
  '**/components/palette/palette-style-previews.tsx',
  '**/components/palette/palette-tile-art.tsx',
  '**/components/palette/embed-tile-art.tsx',
  '**/components/palette/context-menu-tiles.tsx',
  '**/components/palette/mind-map-menu-glyphs.tsx',
  '**/components/palette/sankey-menu-glyphs.tsx',
  '**/components/canvas/quick-style-rows.tsx',
  '**/components/dialogs/export-format-icons.tsx',
  // Layout thumbnails: an infographic's (livedocuments) and a page layout's (livedesign).
  '**/components/canvas/infographic-layout-thumb.tsx',
  '**/components/canvas/layout-thumb.tsx',
  // A photo tool's choices drawn as what they do (a selection mode's two shapes, a crop ratio's box).
  '**/components/photo/option-pictures.tsx',
  // A plan's Add Field tiles: each field kind drawn as the idea it holds (a card and its child cards, a sum).
  '**/components/plan/AddFieldTileArt.tsx',
  // A start header's band and title mark: the app's Explorer hero motif, drawn in the start palette.
  '**/components/start/StartHeaderBand.tsx',
  '**/components/start/StartTitleMark.tsx',
  // Canvas content: a checklist tick and a collaborator's cursor.
  '**/components/canvas/ChecklistView.tsx',
  '**/components/canvas/RemoteCursor.tsx',
  // Automations' living pictures: the template, action and trigger scenes and their parts (a cursor, a flow line).
  '**/components/automations/scene-parts.tsx',
  '**/components/automations/TemplateScene.tsx',
  '**/components/automations/ActionScene.tsx',
  '**/components/automations/TriggerScene.tsx',
];
