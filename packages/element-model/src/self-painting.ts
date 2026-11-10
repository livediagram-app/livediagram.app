// The shape kinds that DRAW THEIR OWN BODY (liveworkspace/docs/specs/002-architecture/architecture.md "The shared
// element model"), so the wrapper carries no border or background and every border control is dead for them. One
// list, because the renderer and the menu were each keeping their own and drifted: the menu still offered Border on
// a code block, a checklist, a portal and a reveal long after the renderer stopped painting one.
//
// A kind table: it holds every product's self-painting kinds, and each product holds a subset of them (no product
// holds a kind listed here that it draws a box for). livehuddle adds its furniture in its own colors.ts.
//
// The actor, icons and stickers are here for a different reason (a stick figure, a glyph and a die-cut plate have
// no enclosing outline to stroke), but the outcome is the same, so they share the predicate rather than a second
// condition.
export const SELF_PAINTING_SHAPES: ReadonlySet<string> = new Set<string>([
  'actor',
  // A UML final state draws its ring and dot itself (shape-geometry.ts): no box to border.
  'final-state',
  // Badge and Step number (docs/specs/009-elements/badge.md): the face paints the pill / disc in its look.
  'badge',
  'step',
  // Concept graphics (docs/specs/009-elements/concept-graphics.md): rows, tiers and discs, no box.
  'layer-stack',
  'pyramid',
  'cycle',
  'hub',
  'onion',
  'chevrons',
  'icon',
  // A sticker paints its own plate, shadow and content (docs/specs/010-palette/stickers.md).
  'sticker',
  // Progress bar / ring: ProgressView draws the track and the fill itself with its own hardcoded arc stroke, and
  // never reads the element's strokeWidth or strokeStyle. They were the drift this list was created to stop,
  // recurring: added to isSelfDrawingShape and not here, so the Border accordion kept offering Strength and Pattern
  // on them. Not merely inert: the pick was committed, so it wrote to the element, autosaved and broadcast an op to
  // every peer in the room, for no visual change at any zoom.
  'progress-bar',
  'progress-ring',
  'timeline-rail',
  'rating',
  'pie-chart',
  'bar-chart',
  'line-chart',
  'code-block',
  'checklist',
  // Legend (docs/specs/009-elements/pie-chart.md): LegendView paints its own card and rows.
  'legend',
  // Sankey (docs/specs/009-elements/sankey.md): nodes and bands, coloured per node; no box to stroke.
  'sankey',
  // Behaviour elements (docs/specs/009-elements/portal-element.md, /106): the ring / cover IS the element.
  'portal',
  'reveal',
  // A retired piece (docs/specs/009-elements/retired-elements.md) draws its own placeholder card, no box behind it.
  'chair',
  'fence',
  'desk',
  'sofa',
  'avatar-pad',
  'room',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
  // A quiz (docs/specs/012-collaboration/quiz.md) paints its own disc and ring of answers; a box behind them would
  // frame a circle in a square.
  'quiz',
  // A tab window (docs/specs/009-elements/tab-window.md) draws its own rounded frame round the tab it shows.
  'tab-window',
  // An instance draws its main (docs/specs/009-elements/components.md), never a box of its own.
  'instance',
  // Plan board and card (docs/specs/026-plan/plan-board.md) paint their own surfaces and stripes.
  'plan-board',
  'plan-card',
  'plan-view',
  'plan-sheet',
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md) that lay out their own surfaces: an
  // accent bar (banner, header), a row of cards, circles and connectors. A callout is NOT here: its card is an
  // ordinary bordered box with content inside.
  'banner',
  'site-header',
  'stat-row',
  'process',
]);
