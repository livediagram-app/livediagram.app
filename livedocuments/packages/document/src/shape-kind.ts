// The shape vocabulary: every kind a shape element can be, from the basic
// geometry through the device frames and the self-drawing data shapes.
//
// Split out of index.ts the same way element-types.ts and arrow-types.ts were,
// and it is the easiest of the three to justify: one union, ~100 members, and
// it references nothing else in the package and nothing else references it by
// anything other than name. A closed vocabulary that only ever grows is
// exactly the kind of thing that should not sit in the middle of the file
// holding the package's public surface.
//
// Pure types; re-exported through index.ts so the public
// `@livedocuments/document` surface is unchanged.

export type ShapeKind =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'document'
  // Document element (docs/specs/009-elements/page-element.md). Named 'page' because 'document' above is
  // the flowchart output symbol.
  | 'page'
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md): single elements that lay themselves out,
  // replacing the grouped composites the Components palette used to build.
  // Banner: an accent bar, title (the label) over a subtitle line.
  | 'banner'
  // Callout: a card with an accent badge, a heading line and a body (label).
  | 'callout'
  // Card (docs/specs/009-elements/card.md): a diagram node with slots (header band, media, title, meta line,
  // body, tags). The Callout is its preset; a stored `callout` migrates to one on read.
  | 'card'
  // Badge and Step number (docs/specs/009-elements/badge.md, step-number.md): small marks that may attach to a
  // point on a host element (`attachedTo` / `attachAt`) and travel with it.
  | 'badge'
  | 'step'
  // Pointer note (docs/specs/009-elements/pointer-note.md): a note with a leader to a tip that may attach to a point.
  | 'pointer-note'
  // Stack (docs/specs/009-elements/stack.md): a container that lays out what it holds in a row, column or grid.
  | 'stack'
  // Concept graphics (docs/specs/009-elements/concept-graphics.md): one element laying out its own rows
  // (`conceptRows`): a stack of layers, a pyramid (or inverted, or a funnel), a cycle of steps.
  | 'layer-stack'
  | 'pyramid'
  | 'cycle'
  // Round 2: satellites round a hub, concentric rings, chevron stages in a row.
  | 'hub'
  | 'onion'
  | 'chevrons'
  // Stat row: KPI cards, a big value over a caption each, in `stats`.
  | 'stat-row'
  // Process steps: numbered circles joined by arrows, captions in
  // `processSteps`.
  | 'process'
  // Header: a website header bar, logo + brand (the label) + `navLinks`.
  | 'site-header'
  // Tab window (docs/specs/009-elements/tab-window.md): another tab of the document drawn live inside it, fitted;
  // which tab lives in `windowTabId`.
  | 'tab-window'
  | 'stadium'
  | 'cloud'
  | 'triangle'
  | 'trapezoid'
  | 'star'
  // Speech bubble / callout: a rounded body with a tail at the bottom-left.
  | 'speech-bubble'
  // Frame / section: a transparent outlined container with its label in the
  // top-left, drawn around a cluster of elements. See docs/specs/008-canvas/canvas-and-palette.md.
  | 'frame'
  // UI device frames (wireframing). See docs/specs/008-canvas/canvas-and-palette.md "Devices" accordion.
  | 'browser'
  | 'monitor'
  | 'laptop'
  | 'phone'
  | 'tablet'
  // A book-style foldable phone, shown OPEN on its inner screen: a
  // near-square panel with the hinge crease down the middle. Folded it is
  // just `phone`, so only the unfolded state earns its own frame.
  | 'foldable'
  | 'smartwatch'
  // Progress elements (docs/specs/009-elements/progress.md): a horizontal bar + a donut ring that show a
  // 0–100 percentage. They carry `progress` / `progressAnim` (below).
  | 'progress-bar'
  | 'progress-ring'
  // The Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"): milestones along a spine, a concept graphic.
  | 'timeline-rail'
  // Rating (docs/specs/009-elements/rating.md): a row of five stars showing a 1–5 score. Carries
  // `rating` / `ratingAnim` (below).
  | 'rating'
  // Pie + bar charts (docs/specs/009-elements/pie-chart.md): data charts sized by value. Share `pieSlices` /
  // `pieAnim` / `chartLegend` (below). The "Data" component family.
  | 'pie-chart'
  | 'bar-chart'
  // Line chart (docs/specs/009-elements/pie-chart.md): a 2-D chart with `lineCategories` + `lineSeries`
  // (CSV-importable). Shares `pieAnim` / `chartLegend`.
  | 'line-chart'
  // Code block (docs/specs/009-elements/code-block.md): a monospace snippet card. Carries `code` +
  // `codeLanguage` (below); keeps a fixed dark identity regardless of theme.
  | 'code-block'
  // Checklist (docs/specs/009-elements/checklist.md): checkable to-do rows. Carries `checklistItems`
  // (below); boxes toggle on-canvas like the rating's stars.
  | 'checklist'
  // Legend (docs/specs/009-elements/pie-chart.md): a card of colour-coded rows (a swatch + a label), the
  // key you put beside a chart or a colour-coded board.
  | 'legend'
  // Sankey diagram (docs/specs/009-elements/sankey.md): flows between named nodes, each band as wide as
  // the amount it carries. Carries `sankeyFlows` (below); lays itself out in columns.
  | 'sankey'
  // Curated single-colour glyph from the icon catalogue. Which glyph
  // is carried by `iconId` (a registry key resolved in the live app's
  // icon catalogue, NOT a closed enum here, so adding icons is a
  // one-file change with no model migration). Tinted by `strokeColor`
  // like a line drawing; keeps aspect ratio when resized. See docs/specs/008-canvas/canvas-and-palette.md
  // "Icons" accordion.
  | 'icon'
  // Sticker (docs/specs/010-palette/stickers.md): a die-cut colour sticker you slap on the canvas — a
  // colour emoji, or a word badge like APPROVED / BLOCKED. Which one is
  // carried by `stickerId` (a catalogue key, not a closed enum here, same as
  // `iconId`). Deliberately NOT an icon: it paints its own plate + shadow,
  // is never tinted by the theme, carries no caption, and never folds into
  // another shape as an inline glyph.
  | 'sticker';
