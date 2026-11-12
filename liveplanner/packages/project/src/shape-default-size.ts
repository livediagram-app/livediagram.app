// The default box of every shape kind: the size a shape is born at (createShape in ./shape-factory) and the
// proportion "reset to default aspect ratio" restores. A plain table with no runtime imports, so any module
// may read it at init time; only a TYPE comes from './index', erased at build. Re-exported from
// ./shape-factory.
import type { ShapeKind } from './index';

// Default size per shape kind. Uniform 120 for square / circle / diamond,
// natural aspect ratios for the flowchart-vocabulary shapes (cylinder
// taller than wide, parallelogram + hexagon + project wider than tall).
// Exported so the editor can offer "reset to default aspect ratio": the
// width:height proportion here is each shape's canonical look.
export const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  square: { width: 120, height: 120 },
  circle: { width: 120, height: 120 },
  diamond: { width: 120, height: 120 },
  cylinder: { width: 100, height: 140 },
  parallelogram: { width: 160, height: 100 },
  hexagon: { width: 140, height: 120 },
  document: { width: 140, height: 110 },
  // Project (docs/specs/009-elements/page-element.md): 420x594 is the A-series root-2 ratio, at a size that
  // reads as a page beside a 120px square without swallowing the canvas.
  page: { width: 420, height: 594 },
  // Mind node (docs/specs/009-elements/mind-node.md): a caption-width pill. Wide enough for a phrase,
  // short enough that a column of siblings stays readable. 170x48 fitted a
  // couple of words and made anything longer wrap or overflow, which is not
  // what people actually type into a mind map.
  'mind-node': { width: 250, height: 80 },
  // Lane (docs/specs/009-elements/lane.md): a band, not a box: wide enough to lay a flow across and
  // tall enough for a row of steps.
  lane: { width: 900, height: 200 },
  // Comment panel (docs/specs/012-collaboration/comment-pin.md "The look"): a card sized for a short
  // conversation (three or four bubbles) above the composer. It reflows, so a
  // resize makes room for more of the thread.
  'comment-pin': { width: 300, height: 320 },
  // Action panel (docs/specs/012-collaboration/action-panel.md): sized for a few actions above the Add
  // Action bar. It reflows, so a resize makes room for more actions.
  'action-card': { width: 300, height: 300 },
  // Record (docs/specs/009-elements/entity.md): a class box: wide enough for "name: Type" rows,
  // tall enough for a title plus four of them before it needs resizing.
  entity: { width: 240, height: 170 },
  // Stadium / pill: the conventional flowchart "Start / End" terminator
  // shape. Wider than tall by default; the CSS `border-radius: 9999px`
  // render path means the ends stay perfectly semicircular at any
  // aspect ratio the user resizes to.
  stadium: { width: 160, height: 64 },
  // Actor (UML stickman): line-art figure with its label below. Taller
  // than wide and aspect-locked on create so the figure never distorts.
  // Default size hugs the figure tightly: earlier 90×150 left a 38-
  // unit band below the legs which read as wasted padding under bare
  // (unlabelled) stickmen. 90×130 keeps room for a short label
  // (y 112..130) without dominating the box.
  actor: { width: 90, height: 130 },
  'final-state': { width: 32, height: 32 },
  // Cloud: a container shape (networking / architecture). Stretches to
  // fit its label like the other flowchart shapes.
  cloud: { width: 180, height: 140 },
  triangle: { width: 130, height: 120 },
  trapezoid: { width: 160, height: 110 },
  star: { width: 130, height: 130 },
  // Speech bubble: wider than tall, with room for the tail beneath the body.
  'speech-bubble': { width: 180, height: 130 },
  // Frame / section: a large container drawn around content, so it starts
  // big. Transparent by default (see defaultFillColor) with a top-left label.
  frame: { width: 360, height: 260 },
  // UI device frames. Sized to evoke each device's natural aspect
  // ratio at a glance: browser + monitor land on a 4:3-ish landscape
  // (with the monitor a touch taller to leave room for its stand);
  // laptop is wider with a flatter total profile (screen + keyboard
  // base stacked); phone + tablet are portrait at typical phone /
  // tablet ratios.
  browser: { width: 240, height: 160 },
  monitor: { width: 220, height: 170 },
  laptop: { width: 240, height: 150 },
  phone: { width: 90, height: 170 },
  tablet: { width: 140, height: 180 },
  // Foldable, unfolded: the two panels side by side make a nearly square
  // inner screen, a little wider than it is tall, which is what separates it
  // at a glance from the portrait phone and tablet above.
  foldable: { width: 190, height: 170 },
  // Smartwatch: a square-ish face with bands above + below, so portrait.
  smartwatch: { width: 110, height: 150 },
  // Curated glyph. Square + aspect-locked on create (set in createShape) so
  // the line art never distorts; the label sits below. Sized generously so a
  // two-line caption (e.g. "Durable Objects") clears the glyph rather than
  // crowding it.
  icon: { width: 120, height: 120 },
  // A sticker's default is square, which is right for the emoji half; the
  // creation path widens it for a word badge off STICKER_ASPECT, since the
  // default table is per-kind and a badge and an emoji are one kind.
  sticker: { width: 104, height: 104 },
  // Plan board (docs/specs/026-plan/blueprints/DEFAULTS.md D5): room for five 220px columns and a
  // header; made Blank (no columns yet), so it starts at the empty board's height (planBoardHeightFor).
  // A literal, not PLAN_BOARD_EMPTY_HEIGHT_PX: this table is read while the module graph is still loading,
  // where the imported constant can be uninitialised; plan-shapes.test.ts keeps the two equal.
  // A Plan card is one card face at a board column's width.
  'plan-board': { width: 1120, height: 880 },
  'plan-card': { width: 240, height: 120 },
  // A plan view's own size comes from its view (planViewSize); this is a visualisation's.
  'plan-view': { width: 720, height: 400 },
  // A Sheet (docs/specs/029-sheets/sheet.md "Placing a sheet"): about nine columns by eighteen rows.
  'plan-sheet': { width: 960, height: 560 },
  // Progress bar: a wide, short pill. Progress ring: a square donut
  // (aspect-locked on create so it stays circular).
  'progress-bar': { width: 220, height: 44 },
  'progress-ring': { width: 130, height: 130 },
  // Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"): four milestones, words above and below.
  'timeline-rail': { width: 720, height: 240 },
  // Rating: a row of five stars.
  rating: { width: 200, height: 44 },
  // Charts default their legend BELOW the plot (docs/specs/009-elements/pie-chart.md), so the starting box
  // is squarer than it was when the legend took a side strip: the width goes to
  // the plot and the extra height carries the legend band.
  'pie-chart': { width: 260, height: 220 },
  'bar-chart': { width: 260, height: 220 },
  // Line chart: a touch wider for the x-axis labels.
  'line-chart': { width: 300, height: 240 },
  // Code block: room for a dozen-ish monospace lines (docs/specs/009-elements/code-block.md).
  'code-block': { width: 320, height: 180 },
  // Checklist: a card of starter rows (docs/specs/009-elements/checklist.md).
  checklist: { width: 240, height: 180 },
  // Legend (docs/specs/009-elements/pie-chart.md): narrower than a checklist, because a key is a swatch and
  // a word, and short enough to sit in a corner beside the thing it explains.
  legend: { width: 180, height: 132 },
  // Sankey (docs/specs/009-elements/sankey.md): wide, because a Sankey reads left to right across its
  // columns, and the starter budget has four of them, each with a label beside its bar.
  sankey: { width: 560, height: 300 },
  // Portal (docs/specs/009-elements/portal-element.md): portal-shaped: taller than it is wide, like a portal.
  portal: { width: 72, height: 112 },
  // Tab window (docs/specs/009-elements/tab-window.md, retired): 16:9, TAB_WINDOW_SIZE, for a stored one's kind swap.
  'tab-window': { width: 640, height: 360 },
  // Session button (docs/specs/012-collaboration/session-button.md): a square-ish tile, sized for an icon ABOVE its
  // label: the shape a toolbar button has.
  'session-button': { width: 104, height: 96 },
  // Picker (docs/specs/012-collaboration/picker.md): a card wide enough for a name at a readable size.
  picker: { width: 220, height: 132 },
  // Temperature check (docs/specs/012-collaboration/temperature-check.md): five faces over five bars over
  // the mood meter. Wide enough for each face to carry its word, and tall
  // enough that the bars, the main read, get real height.
  temperature: { width: 320, height: 300 },
  // Decision record (docs/specs/012-collaboration/decision-record.md): a card for a sentence plus three drivers.
  decision: { width: 330, height: 220 },
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md), at the sizes the grouped composites they
  // replace arrived at, so a canvas built from either reads the same.
  banner: { width: 440, height: 104 },
  callout: { width: 380, height: 116 },
  // Card (docs/specs/009-elements/card.md): room for a title, a meta line, two body lines and a tag row.
  card: { width: 300, height: 150 },
  // Badge (docs/specs/009-elements/badge.md): fitted to its text on every commit (badgeSize); this is "New" (BADGE_NEW_LABEL).
  badge: { width: 40, height: 24 },
  // Step number (docs/specs/009-elements/step-number.md): a small disc.
  step: { width: 28, height: 28 },
  // Pointer note (docs/specs/009-elements/pointer-note.md): a short note; its tip hangs below it (D190).
  'pointer-note': { width: 180, height: 64 },
  // Diagram key (docs/specs/009-elements/diagram-key.md): one row's height until it settles (D191).
  'diagram-key': { width: 260, height: 68 },
  // Stack (docs/specs/009-elements/stack.md): an empty row to drop into (D192).
  stack: { width: 360, height: 160 },
  // Sequence diagram (docs/specs/009-elements/sequence-diagram.md): three lifelines and five messages (D194).
  sequence: { width: 560, height: 340 },
  // Boundary (docs/specs/009-elements/boundary.md): room for a few nodes inside.
  boundary: { width: 480, height: 300 },
  // Concept graphics (docs/specs/009-elements/concept-graphics.md).
  'layer-stack': { width: 360, height: 260 },
  pyramid: { width: 320, height: 260 },
  cycle: { width: 300, height: 300 },
  hub: { width: 340, height: 320 },
  onion: { width: 320, height: 320 },
  chevrons: { width: 600, height: 150 },
  // Three 150px cards and two 16px gaps.
  'stat-row': { width: 482, height: 96 },
  process: { width: 420, height: 110 },
  'site-header': { width: 640, height: 84 },
};
