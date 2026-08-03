// Shared domain types for diagrams. Consumed by the live app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles diagram data. See specs/05-diagram-structure.md and
// specs/09-canvas-and-palette.md.

// Live session-tool types used by the `Tab.timer` / `Tab.vote` fields
// below. Type-only import (erased at build) so the index <-> session
// circular reference is fine. The runtime helpers are re-exported lower
// down via `export * from './session'`.
// Value import from the data-shapes LEAF module (it imports only types from
// here, so no cycle at runtime) — elementSupportsText excludes the
// self-drawing data shapes the same way the inline editor does.
import { isSelfDrawingShape } from './data-shapes';
import type { TabTimer, TabVote } from './session';

// Layer type used by the `Tab.layers` field below (spec/74). Type-only
// import for the same erasability reason as session; the runtime layer
// helpers are re-exported lower down via `export * from './layers'`.
import type { Layer } from './layers';

// Per-range label formatting runs (spec/09). Type-only import so the
// index <-> rich-text relationship stays erasable; the runtime helpers +
// this type are re-exported lower down via `export * from './rich-text'`.
// Only the BoxedElement union members are imported for local use; the full set
// (incl. TableCellStyle / LinkCardMeta sub-types) is re-exported just below.
import type { ArrowElement } from './arrow-types';
export type { Anchor, ArrowEnds, ArrowElement, Endpoint } from './arrow-types';
export type { ShapeKind } from './shape-kind';
export { ALL_ANCHORS } from './arrow-types';

import type {
  ShapeElement,
  TextElement,
  TableElement,
  StickyElement,
  ImageElement,
  FreehandElement,
  AnnotationElement,
  LinkCardElement,
  VideoElement,
} from './element-types';
export type {
  ChartLegendPosition,
  ShapeElement,
  TextElement,
  TableCellStyle,
  TableElement,
  StickyElement,
  ImageElement,
  FreehandElement,
  AnnotationElement,
  LinkCardMeta,
  LinkCardElement,
  VideoElement,
} from './element-types';

// Arrow appearance preset types used by ArrowElement's fields below. The
// constants + accessors that go with them live in arrow-style.ts; type-only
// import so the index <-> arrow-style relationship stays erasable, and the
// whole module is re-exported lower down via `export * from './arrow-style'`.

// Border preset types used by the boxed-element + arrow field definitions
// below. The px / dasharray maps + defaults that go with them live in
// border-style.ts; type-only import (erasable), and the whole module is
// re-exported lower down via `export * from './border-style'`.

// Comment-thread type used by the boxed-element `commentThread` fields below.
// The Comment shape + createComment / activeCommentCount helpers live in
// comments.ts; type-only import (erasable), and the whole module is re-exported
// lower down via `export * from './comments'`.

// Documentary type aliases for ids that internal helpers thread
// around. Not exported because no caller outside this package
// imports them by name (they all just use plain `string`); keeping
// them internal lets the public surface stay focused on the rich
// element + tab types below without trailing along three trivial
// `string` aliases.
export type DiagramId = string;
export type TabId = string;
export type ElementId = string;

// --- Shared boxed-element fields ------------------------------------------

export type TextSize = 'scale' | 'sm' | 'md' | 'lg';

// Padding between the element's box and its label. Stored as a t-shirt
// size for round-trip simplicity; the renderer converts to px.
export type Padding = 'none' | 'sm' | 'md' | 'lg';

export const PADDING_PX: Record<Padding, number> = {
  none: 0,
  sm: 6,
  md: 14,
  lg: 24,
};

export type TextAlignX = 'left' | 'center' | 'right';
export type TextAlignY = 'top' | 'middle' | 'bottom';

// Where an inline icon sits relative to its shape's text label (the
// drag-an-icon-onto-a-shape feature, spec/09). The drop-side detection, the
// context-menu placement picker, and the data-model field all speak this.
export type IconPosition = 'left' | 'right' | 'above' | 'below';

// The animation vocabulary (element / icon / progress animations, their
// speed, and the animLoops rule) lives in './animation' — a LEAF module,
// re-exported below, so the public surface is unchanged.

// The self-drawing data-shape family (progress / rail / rating / charts:
// kind predicates, bounds, default data, anim sets, clamps) lives in
// './data-shapes' — a LEAF module so factories.ts can read the defaults
// at module-init time without a runtime cycle through this barrel. It is
// re-exported below, so the public surface is unchanged.

// Flowing-arrow animation (spec/09): 'dashes' marches the dash pattern along
// the connector (CSS stroke-dashoffset), 'dots' sends a dot travelling the
// path (CSS offset-path), 'beads' marches a row of round dots, 'pulse' breathes
// the line's opacity, 'grow' breathes its thickness, 'glow' pulses a soft halo
// around it, 'draw' repeatedly draws the line on from start to end (a
// pathLength-normalised stroke-dashoffset reveal), 'comet' sends a glowing dot
// with a fading tail along the path (a staggered fleet of offset-path dots),
// 'rainbow' cycles the stroke colour through the spectrum, 'strobe' blinks the
// line hard on/off (stepped stroke-opacity), 'wind' marches fast sparse long
// dashes like speed lines. The emphasis set draws the eye without busy
// motion: 'heartbeat' is a lub-dub thickness double-pump (vs grow's smooth
// breathe), 'breathe' a slow gentle width + opacity swell, 'shimmer' an
// occasional quick glint of brightness + halo, 'signal' a single discrete
// packet (one long dash) travelling the path (vs wind's stream of speed
// lines). All show / emphasise the direction of data / process flow.
export type ArrowFlow =
  | 'dashes'
  | 'dots'
  | 'beads'
  | 'pulse'
  | 'grow'
  | 'glow'
  | 'heartbeat'
  | 'breathe'
  | 'shimmer'
  | 'signal'
  | 'draw'
  | 'comet'
  | 'rainbow'
  | 'strobe'
  | 'wind';
export const ARROW_FLOWS: readonly ArrowFlow[] = [
  'dashes',
  'dots',
  'beads',
  'pulse',
  'grow',
  'glow',
  'heartbeat',
  'breathe',
  'shimmer',
  'signal',
  'draw',
  'comet',
  'rainbow',
  'strobe',
  'wind',
];

export type BackgroundPattern =
  | 'grid'
  | 'blank'
  | 'lines'
  | 'crosshatch'
  | 'graph'
  | 'confetti'
  | 'stripes'
  | 'diagonal'
  | 'waves'
  | 'bricks'
  | 'isometric'
  | 'hexagonal'
  | 'engineering'
  | 'checkerboard'
  // Animated patterns (spec/09): soft ambient motion rendered as an
  // overlay layer rather than a CSS background image. They theme off the
  // pattern colour like the static ones. Kept last so the static catalogue
  // ordering is undisturbed.
  | 'flow'
  | 'drift'
  | 'aurora'
  | 'ripple'
  | 'ribbons';

// The animated members of BackgroundPattern. These render via the
// AnimatedCanvasBackground overlay (CSS / SVG motion) instead of a static
// `background-image`, so callers that paint or export a still frame can
// branch on this. Order mirrors the picker.
export const ANIMATED_BACKGROUND_PATTERNS = [
  'flow',
  'drift',
  'aurora',
  'ripple',
  'ribbons',
] as const;

export type AnimatedBackgroundPattern = (typeof ANIMATED_BACKGROUND_PATTERNS)[number];

export function isAnimatedPattern(
  pattern: BackgroundPattern,
): pattern is AnimatedBackgroundPattern {
  return (ANIMATED_BACKGROUND_PATTERNS as readonly string[]).includes(pattern);
}

export const DEFAULT_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_PATTERN_COLOR = '#cbd5e1'; // slate-300

// Cross-tab link on any element. `tab` jumps to another tab on the same
// diagram; `diagram` navigates to a different diagram entirely (with
// the diagram's name cached on the element so the picker / badge can
// show it without a round-trip). Element-specific linking
// (jump-and-focus a specific element) is in the spec but not in the
// UI yet.
export type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId }
  | { kind: 'diagram'; diagramId: string; name: string }
  // An external web address. Followed by opening in a new tab; stored
  // verbatim (the UI normalises a bare host to https:// on entry). Used
  // by both element links and per-cell table links (spec/09).
  | { kind: 'url'; url: string };

// --- Element union ---------------------------------------------------------

export type BoxedElement =
  | ShapeElement
  | TextElement
  | StickyElement
  | ImageElement
  | FreehandElement
  | TableElement
  | AnnotationElement
  | LinkCardElement
  | VideoElement;
export type Element = BoxedElement | ArrowElement;

export type Tab = {
  id: TabId;
  name: string;
  elements: Element[];
  backgroundPattern?: BackgroundPattern;
  backgroundColor?: string;
  // 0..1, defaults to 1. Applied to backgroundColor as the alpha
  // channel so the canvas can sit over a transparent / lower-opacity
  // backdrop (useful when embedded or layered on a theme).
  backgroundOpacity?: number;
  patternColor?: string;
  // Pattern tile scale, defaults to 1. Multiplies the rendered pattern's
  // tile size so the user can make the grid / dots / texture larger or
  // smaller (the canvas pattern-size slider). Does not affect the pan
  // phase, so the pattern still tracks panning at any scale.
  backgroundPatternScale?: number;
  // Motion speed for an ANIMATED background pattern (spec/09), defaults to
  // 1. A rate multiplier (2 = twice as fast) fed to the animated backdrop's
  // keyframes; ignored by the static patterns. The canvas Speed slider
  // (shown only while an animated pattern is active) writes it.
  backgroundAnimationSpeed?: number;
  // Selected preset theme name (see apps/live/lib/themes.ts). Setting
  // a theme via the palette repaints every existing element on the tab
  // to match (sticky notes keep their amber palette). Newly added
  // elements inherit the same theme colours by default. Unset = brand
  // defaults.
  theme?: string;
  // Default font-family id for this tab (see apps/live/lib/fonts.ts).
  // Every text-bearing element without its own `font` renders in this
  // one; unset = the editor default. Lets a whole tab adopt a font in
  // one move while individual elements can still override.
  font?: string;
  // Default text size for NEW elements added from the palette on this
  // tab. Unlike `font`, this is a create-time seed — copied onto each
  // new element's own `textSize`, not resolved at render — so changing
  // it later doesn't retroactively resize existing elements. Unset = the
  // per-type factory default ('md').
  defaultTextSize?: TextSize;
  // Set to true once the user has explicitly chosen a starting template
  // (including "Blank"), so the template picker doesn't reappear on this tab.
  templateChosen?: boolean;
  // True when the tab is locked: every element becomes read-only,
  // adds via the palette are blocked, theme / background mutations
  // are blocked, and the Activity panel hides its Revert + Undo
  // buttons for as long as this tab is active. Toggled from the
  // tab ellipsis menu.
  locked?: boolean;
  // Per-diagram folder name (specs/30). Tabs sharing a name render
  // as a contiguous run under one collapsible chip in the tab bar.
  // This is link metadata, not body content: it's stripped from the
  // persisted tab body and carried on the diagram_tabs row alongside
  // order_index, so a shared tab can be foldered in one diagram and
  // loose in another. Unset / empty = loose. See tab-folders.ts for
  // the normalize + grouping helpers.
  folder?: string;
  // Live session tools (spec/39), facilitator-run + synced to every
  // participant via the normal tab sync. `timer` is a countdown /
  // stopwatch; `vote` is a dot-voting session. Both are edit-role
  // controlled (the room drops view-role mutations) and absent until a
  // facilitator starts one. See session.ts for the pure helpers.
  timer?: TabTimer;
  vote?: TabVote;
  // Photoshop-style layers (spec/74), ordered BOTTOM -> TOP (index 0
  // paints lowest). Absent = the tab behaves as one implicit default
  // layer; the array is materialised lazily on the first layer
  // operation (see layers.ts). Elements point in via `layerId`.
  layers?: Layer[];
};

export type Diagram = {
  id: DiagramId;
  name: string;
  tabs: Tab[];
  createdAt: string;
  updatedAt: string;
};

// --- Type guards -----------------------------------------------------------

export function isBoxed(element: Element): element is BoxedElement {
  return (
    element.type === 'shape' ||
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'image' ||
    element.type === 'freehand' ||
    element.type === 'table' ||
    element.type === 'annotation' ||
    element.type === 'link-card' ||
    element.type === 'video'
  );
}

// True when the element carries a non-empty text label — the plain-text
// `label` every labelable kind mirrors (shape / text / sticky / freehand /
// link-card and arrows). Drives the selection toolbar's "Edit text" button,
// which only appears once an element actually has text to edit. Tables
// (per-cell `cells`), images (`alt`), and annotations (`note`) carry no
// single `label`, so this reads false for them — matching the inline label
// editor, which targets `label`-bearing elements only.
export function elementHasText(element: Element): boolean {
  const label = (element as { label?: string }).label;
  return typeof label === 'string' && label.trim().length > 0;
}

// True when the element KIND can carry the plain-text `label` — whether or
// not one is set yet. Shapes qualify except the self-drawing data shapes
// (progress / rail / rating / charts), which the inline editor refuses;
// text / sticky / freehand / arrows all edit `label` too. A link-card is
// deliberately OUT: its view renders link metadata, never `label`, and its
// double-click opens the link picker (spec/40) — an Add-text button there
// entered an edit state with no editor on screen.
// Drives the selection toolbar's "Edit text" / "Add text" button, which
// shows on every text-capable element (an empty one included, so the
// affordance teaches that text can be added).
export function elementSupportsText(element: Element): boolean {
  if (element.type === 'shape') return !isSelfDrawingShape(element.shape);
  return (
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'freehand' ||
    element.type === 'arrow'
  );
}

// --- Re-exported resource modules -----------------------------------------
export * from './animation';
export * from './arrow-avoidance';
export * from './nearest-towards';
export * from './mind-map';
export * from './youtube';
export * from './arrow-path';
export * from './arrow-style';
export * from './border-style';
// Element drop shadows (spec/86): model, presets + render builders.
export * from './shadow';
export * from './shape-marker';
// Selection modes a Mode Button can switch to (spec/103).
export * from './selection-mode';
export * from './comments';
// Per-element assigned actions (spec/68).
export * from './element-action';
export * from './data-shapes';
// Per-participant responses (spec/122) + the collaboration element family
// (spec/123 to spec/130). Both leaf modules, for the factories cycle.
export * from './responses';
export * from './collab-shapes';
export * from './colors';
export * from './icon-size';

// Per-range label formatting (spec/09): the runs-as-delta model + pure
// helpers shared by the canvas renderer and the contentEditable editor.
export * from './rich-text';

export * from './factories';
export * from './graph-authoring';
export * from './mermaid';
export * from './duplicate';
export * from './polyline';
export * from './component-factories';
export * from './table';

// Runtime structural validation for Element + Tab (the trust-boundary guard
// the API uses to vet incoming tabs / diagrams). See validate.ts.
export * from './validate';

// Deterministic auto-layout for AI-generated diagrams (spec/25).
export * from './auto-layout';

// Cluster-aware graph layout (spec/73): Mermaid subgraphs as frames.
export * from './auto-layout-clusters';

// Shared by the editor's text export + import and reusable by the api / MCP.

// Headless SVG renderer (spec/62 §5): per-element drawers + renderElementsToSvg,
// shared by the in-app export and the MCP worker's inline image render.
export * from './svg-render';
export * from './svg-render-table';

// Theme engine (spec/29, /42, /44, /48): theme catalogue + types + the pure
// recolour / switch / reset / preset transforms, shared by the editor and the
// MCP worker (spec/62). Custom-theme resolution stays in apps/live/lib/themes.ts.
export * from './theme-graph';
export * from './themes';
export * from './theme-presets';

// Human-readable name for an element's kind ('Square', 'Table', 'Icon', ...),
// used by selection captions and any surface that names what's selected.
export * from './element-kind-label';

export * from './anchor-choice';
export * from './geometry';
export * from './arrow-rebind';
export * from './arrow-endpoint-spread';
// Arrows breaking around intervening boxes at render time (spec/90).
export * from './arrow-behind';
// Tab + diagram name length cap (spec/91).
export * from './names';
export * from './geometry-snapping';
export * from './geometry-guides';

export * from './groups';

// Photoshop-style layers (spec/74): the Layer type used by the Tab field
// above, band-aware render ordering, and the pure layer operations.
export * from './layers';
export * from './layer-operations';

// Element-level realtime ops (spec/75): the ElementOp type + the pure
// diff/apply functions the realtime room uses to merge concurrent edits.
export * from './element-ops';

// Tab-folder grouping + order normalization (specs/30). One home
// shared by the tab-bar renderer, the client save path, and the
// server route so the contiguous-run invariant has a single
// implementation.
export * from './tab-folders';

// Live session tools (spec/39): the TabTimer / TabVote types used by the
// Tab fields above, plus the pure timer + vote helpers.
export * from './session';

// Pencil-tool shape recognition (spec/09 Pencil (freehand)
// subsection's recognise mode). Re-exported so callers import
// from the package root the same way they do every other helper
// here.
export { recogniseShape, type RecognisedShape, type RecognisedShapeKind } from './recognise-shape';
