// Shared domain types for diagrams. Consumed by the live app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles diagram data. See specs/05-diagram-structure.md and
// specs/09-canvas-and-command-palette.md.

// Live session-tool types used by the `Tab.timer` / `Tab.vote` fields
// below. Type-only import (erased at build) so the index <-> session
// circular reference is fine. The runtime helpers are re-exported lower
// down via `export * from './session'`.
import type { TabTimer, TabVote } from './session';

// Per-range label formatting runs (spec/09). Type-only import so the
// index <-> rich-text relationship stays erasable; the runtime helpers +
// this type are re-exported lower down via `export * from './rich-text'`.
// Only the BoxedElement union members are imported for local use; the full set
// (incl. TableCellStyle / LinkCardMeta sub-types) is re-exported just below.
import type {
  ShapeElement,
  TextElement,
  TableElement,
  StickyElement,
  ImageElement,
  FreehandElement,
  AnnotationElement,
  LinkCardElement,
} from './element-types';
export type {
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
} from './element-types';

// Arrow appearance preset types used by ArrowElement's fields below. The
// constants + accessors that go with them live in arrow-style.ts; type-only
// import so the index <-> arrow-style relationship stays erasable, and the
// whole module is re-exported lower down via `export * from './arrow-style'`.
import type { ArrowheadSize, ArrowheadShape, ArrowStyle } from './arrow-style';

// Border preset types used by the boxed-element + arrow field definitions
// below. The px / dasharray maps + defaults that go with them live in
// border-style.ts; type-only import (erasable), and the whole module is
// re-exported lower down via `export * from './border-style'`.
import type { BorderStyle } from './border-style';

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

// Looping element animation (spec/09 "Animated elements"). Applied to a boxed
// element as a CSS class; deterministic (no broadcast), reduced-motion-safe
// (the keyframes are disabled under prefers-reduced-motion), and freezes to a
// static frame on PNG / SVG export. 'pulse' is an attention ping (an
// expanding ring), 'blink' a status breathe (opacity), 'glow' a soft halo,
// 'trace' a light running the element's outline, 'gradient' a moving gradient
// blending the fill + accent colours, 'bounce' a vertical bob, 'wobble' a
// tilt wiggle. trace / gradient render against the true shape outline (an SVG
// stroke / fill for SVG-rendered shapes, the CSS border / background for
// CSS-rendered shapes + other boxed elements); bounce / wobble drive the
// independent `translate` / `rotate` CSS properties so they compose with an
// element's own rotation rather than clobbering it.
export type ElementAnimation =
  | 'pulse'
  | 'blink'
  | 'glow'
  | 'trace'
  | 'gradient'
  | 'bounce'
  | 'wobble';
export const ELEMENT_ANIMATIONS: readonly ElementAnimation[] = [
  'pulse',
  'blink',
  'glow',
  'trace',
  'gradient',
  'bounce',
  'wobble',
];

// Animation / flow speed (spec/09). A multiplier on each animation's tuned
// base duration (so every animation keeps its own feel; speed just scales it):
// 'slow' doubles the duration, 'fast' halves it. Shared by boxed-element
// animations (`animationSpeed`) and arrow flow (`flowSpeed`); 'normal' = 1 and
// is the default when unset. The renderer feeds the factor to CSS via a
// custom property the keyframe classes multiply into their duration.
export type AnimationSpeed = 'slow' | 'normal' | 'fast';
export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ['slow', 'normal', 'fast'];
export const ANIMATION_SPEED_FACTOR: Record<AnimationSpeed, number> = {
  slow: 2,
  normal: 1,
  fast: 0.5,
};

// Looping animation for an `icon` shape's glyph (spec/09 "Animated icons").
// A separate, glyph-oriented set from the boxed-element ElementAnimation: any
// icon can opt into one of these via the icon context menu (they used to be
// hard-wired to a few icon ids and always-on). 'spin' rotates, 'beat' is the
// heart double-pump (scale), 'pulse' breathes opacity, 'bounce' bobs, 'wiggle'
// tilts, 'flash' blinks, 'tada' is a celebratory scale + rotate. Undefined =
// static. Mapped to a `lvd-icon-*` class; loop speed comes from the separate
// `iconAnimationSpeed` field (slow / normal / fast), same as boxed elements.
export type IconAnimation = 'spin' | 'beat' | 'pulse' | 'bounce' | 'wiggle' | 'flash' | 'tada';
export const ICON_ANIMATIONS: readonly IconAnimation[] = [
  'spin',
  'beat',
  'pulse',
  'bounce',
  'wiggle',
  'flash',
  'tada',
];

// Where an inline icon sits relative to its shape's text label (the
// drag-an-icon-onto-a-shape feature, spec/09). The drop-side detection, the
// context-menu placement picker, and the data-model field all speak this.
export type IconPosition = 'left' | 'right' | 'above' | 'below';

// Progress elements (spec/46): a horizontal bar + a donut ring that display a
// 0–100 `progress` value. `progressAnim` animates HOW the filled portion
// behaves: 'fill' repeatedly grows it from 0 to the value, 'pulse' breathes its
// opacity, 'stripes' runs a barber-pole / marching pattern over the fill.
// Undefined = a static fill. Mapped to `lvd-prog-*` classes by ProgressView.
export type ProgressAnim = 'fill' | 'pulse' | 'stripes';
export const PROGRESS_ANIMS: readonly ProgressAnim[] = ['fill', 'pulse', 'stripes'];

// The two progress ShapeKinds, grouped so renderers + context-menu gates can
// branch on "is this a progress element" without repeating the literal pair.
export function isProgressShape(kind: ShapeKind): boolean {
  return kind === 'progress-bar' || kind === 'progress-ring';
}

// Timeline-rail bounds: a rail always has at least 2 points, and the canvas
// affordance caps additions so the element stays legible (spec/51).
export const RAIL_MIN_POINTS = 2;
export const RAIL_MAX_POINTS = 12;
export const RAIL_DEFAULT_POINTS = 3;
// Canvas px the rail widens by per added point, so spacing stays constant as
// points are appended at the right end.
export const RAIL_POINT_STEP_PX = 120;

export function isRailShape(kind: ShapeKind): boolean {
  return kind === 'timeline-rail';
}

// Rating element (spec/52): a row of stars showing a 1..RATING_MAX score.
// `ratingAnim` animates the filled stars — 'pop' pops them in one-by-one,
// 'twinkle' sparkles them, 'pulse' breathes their opacity, 'rock' tips them.
// Undefined = static. Mapped to `lvd-rating-*` classes by RatingView.
export const RATING_MAX = 5;
export const RATING_DEFAULT = 3;
export type RatingAnim = 'pop' | 'twinkle' | 'pulse' | 'rock';
export const RATING_ANIMS: readonly RatingAnim[] = ['pop', 'twinkle', 'pulse', 'rock'];

export function isRatingShape(kind: ShapeKind): boolean {
  return kind === 'rating';
}

// Pie chart (spec/53). A slice is one labelled datum; `color` overrides the
// default categorical palette when set. `pieAnim` animates the slices —
// 'grow' sweeps them in, 'pop' scales them in, 'spin' rotates the whole pie,
// 'pulse' breathes their opacity. Undefined = static. Mapped to `lvd-pie-*`
// by PieChartView. The first of the chart family, so the anim set is its own.
export type PieSlice = { label: string; value: number; color?: string };
export type PieAnim = 'grow' | 'pop' | 'spin' | 'pulse';
export const PIE_ANIMS: readonly PieAnim[] = ['grow', 'pop', 'spin', 'pulse'];
// Default categorical palette for slices without an explicit colour.
export const PIE_PALETTE: readonly string[] = [
  '#0ea5e9',
  '#f59e0b',
  '#22c55e',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#ec4899',
  '#84cc16',
];
export const PIE_DEFAULT_SLICES: readonly PieSlice[] = [
  { label: 'A', value: 40 },
  { label: 'B', value: 30 },
  { label: 'C', value: 20 },
];

export function isPieShape(kind: ShapeKind): boolean {
  return kind === 'pie-chart';
}

// Clamp to a whole 0..RATING_MAX star count.
export function clampRating(value: number): number {
  return Math.max(0, Math.min(RATING_MAX, Math.round(value)));
}

// Round a value to a whole 0–100 percentage. Shared by the progress setter,
// the context-menu slider, and ProgressView so the clamp-and-round can't drift
// (default applied by the caller before clamping).
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Flowing-arrow animation (spec/09): 'dashes' marches the dash pattern along
// the connector (CSS stroke-dashoffset), 'dots' sends a dot travelling the
// path (CSS offset-path), 'beads' marches a row of round dots, 'pulse' breathes
// the line's opacity, 'grow' breathes its thickness, 'glow' pulses a soft halo
// around it. All show / emphasise the direction of data / process flow.
export type ArrowFlow = 'dashes' | 'dots' | 'beads' | 'pulse' | 'grow' | 'glow';
export const ARROW_FLOWS: readonly ArrowFlow[] = [
  'dashes',
  'dots',
  'beads',
  'pulse',
  'grow',
  'glow',
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

// --- Shapes ---------------------------------------------------------------

export type ShapeKind =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'document'
  | 'stadium'
  | 'actor'
  | 'cloud'
  | 'triangle'
  | 'trapezoid'
  | 'star'
  // Speech bubble / callout: a rounded body with a tail at the bottom-left.
  | 'speech-bubble'
  // Frame / section: a transparent outlined container with its label in the
  // top-left, drawn around a cluster of elements. See spec/09.
  | 'frame'
  // UI device frames (wireframing). See spec/09 "Devices" accordion.
  | 'browser'
  | 'monitor'
  | 'laptop'
  | 'phone'
  | 'tablet'
  | 'smartwatch'
  // Progress elements (spec/46): a horizontal bar + a donut ring that show a
  // 0–100 percentage. They carry `progress` / `progressAnim` (below).
  | 'progress-bar'
  | 'progress-ring'
  // Timeline rail (spec/51): a horizontal line with evenly-spaced points above
  // it. Carries `railCount` (below); a canvas affordance adds points at the
  // right end. The first of a family of composite "rail" components.
  | 'timeline-rail'
  // Rating (spec/52): a row of five stars showing a 1–5 score. Carries
  // `rating` / `ratingAnim` (below).
  | 'rating'
  // Pie chart (spec/53): a data chart whose slices are sized by value. Carries
  // `pieSlices` / `pieAnim` (below). The first of the "Data" component family.
  | 'pie-chart'
  // Curated single-colour glyph from the icon catalogue. Which glyph
  // is carried by `iconId` (a registry key resolved in the live app's
  // icon catalogue, NOT a closed enum here, so adding icons is a
  // one-file change with no model migration). Tinted by `strokeColor`
  // like a line drawing; keeps aspect ratio when resized. See spec/09
  // "Icons" accordion.
  | 'icon';

// --- Arrows ----------------------------------------------------------------

export type Anchor = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const ALL_ANCHORS: Anchor[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export type Endpoint =
  | { kind: 'free'; x: number; y: number }
  // `manual` marks an anchor the user set by hand (dragging the endpoint
  // onto that face). The auto-rebind that re-chooses faces as boxes move
  // (`rebindArrowAnchorsAfterMove`) leaves a manual endpoint fixed, so a
  // deliberate correction sticks. Absent === auto-managed (the default).
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor; manual?: boolean }
  // Connected to a point ALONG another arrow's line (spec/50) — `t` is the
  // parametric position (0 = the target arrow's `from`, 1 = its `to`). The
  // position resolves dynamically from the target arrow's centreline, so it
  // tracks the target as it moves / reshapes (e.g. sequence-diagram messages
  // attached to a lifeline arrow). Resolved by `endpointPosition`.
  | { kind: 'on-arrow'; arrowId: ElementId; t: number };

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

// Which endpoint(s) of an arrow get an arrowhead marker. 'to' (default)
// is the conventional one-way arrow; 'from' flips it; 'both' makes a
// two-headed connector. There's no 'none' yet — a line with no
// direction is rare enough to defer.
export type ArrowEnds = 'from' | 'to' | 'both' | 'none';

export type ArrowElement = {
  id: ElementId;
  type: 'arrow';
  from: Endpoint;
  to: Endpoint;
  locked?: boolean;
  // Stroke colour for the line + arrowhead. Falls through to the
  // default arrow slate when unset. There's no fill or text on an
  // arrow so this is the only colour field.
  strokeColor?: string;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  arrowEnds?: ArrowEnds;
  // Stroke width in px. Defaults to the medium preset when unset so
  // existing arrows render unchanged. Presets surface via the Palette;
  // the underlying field is a free number so future inputs (sliders,
  // numeric entry) work without a schema migration.
  strokeWidth?: number;
  // Line pattern preset (solid / dashed / dotted). Shares the
  // BorderStyle union with the shape Border accordion so a future
  // pattern addition lands on both. Defaults to 'solid' (no
  // dasharray) so existing arrows render unchanged.
  strokeStyle?: BorderStyle;
  // Arrowhead size preset. Lives separately from `strokeWidth` so a
  // thin line can carry a chunky arrowhead and vice versa. Snapped
  // to a named preset for the toggle UI (see `arrowheadSizeOf`).
  arrowheadSize?: ArrowheadSize;
  // Arrowhead head SHAPE preset (filled triangle / hollow triangle /
  // open V / dot / diamond ...). Independent of size + ends so a UML
  // diagram can pair a hollow triangle (inheritance) or diamond
  // (aggregation / composition) with any line weight. Defaults to the
  // filled triangle so arrows authored before the field render
  // unchanged (see `arrowheadShapeOf`).
  arrowheadShape?: ArrowheadShape;
  // Path shape. 'straight' is the default and matches every arrow
  // authored before the field existed. 'curved' bows the line out
  // perpendicular to the from→to chord (smooth quadratic Bezier).
  // 'angled' renders the connector as an axis-aligned L-shape with
  // a single right-angle bend. See `arrowStyleOf`.
  arrowStyle?: ArrowStyle;
  // Flowing-arrow animation (spec/09): marching dashes or a travelling dot
  // along the path to show flow direction. Undefined = static.
  flow?: ArrowFlow;
  // Speed of `flow` (multiplier on its base duration). Default 'normal'.
  flowSpeed?: AnimationSpeed;
  // Optional override for the curve control point. Stored as a
  // delta from the chord midpoint (canvas coords) so the curve
  // translates with the arrow when an endpoint moves: the chord
  // midpoint shifts, the offset stays the same, and the user's
  // chosen bow direction + magnitude is preserved. Only consulted
  // when `arrowStyle === 'curved'`; the auto perpendicular bow is
  // used whenever this field is absent so existing curved arrows
  // render unchanged. Setting it back to undefined "resets" the
  // curve to its default shape.
  curveOffset?: { dx: number; dy: number };
  // Optional extra control points for a multi-bend curve (spec/09). Each is
  // a delta from the chord midpoint (canvas coords), like `curveOffset`, so
  // the whole curve translates with the arrow when an endpoint moves. When
  // present (and `arrowStyle === 'curved'`) the curve is a smooth spline
  // through from -> these points -> to, letting the user click the line to
  // add bends rather than being stuck with a single bow. Absent or empty =
  // the single-control-point behaviour above. `curveOffset` is treated as
  // the first point when this is absent, so existing curved arrows are
  // unchanged.
  curvePoints?: { dx: number; dy: number }[];
  // Optional override for the angled-arrow elbow position. Stored
  // as a delta from the auto-computed elbow (the right-angle corner
  // a default angled arrow draws at `(to.x, from.y)` or `(from.x,
  // to.y)`). Lets the user drag the visible elbow handle to bend
  // the arrow somewhere other than the default corner. Only
  // consulted when `arrowStyle === 'angled'`; the auto right-angle
  // applies when this field is absent so existing angled arrows
  // render unchanged.
  elbowOffset?: { dx: number; dy: number };
  // Optional label rendered next to the arrow's midpoint. Empty /
  // missing → no label is drawn. Double-click on the arrow opens an
  // inline editor for this field. When `labelOffset` is absent the
  // placement is computed at render time to dodge nearby boxed
  // elements (right → below → left → above of midpoint).
  label?: string;
  // Optional user-chosen label placement: `t` is the position along
  // the line (0..1 by arc length), `offset` the signed perpendicular
  // distance from the line (positive = left of travel, negative =
  // right) so the label can sit on either side. Set by dragging the
  // label; absent → the auto midpoint placement above. Translates
  // with the arrow because it's parameterised against the line, not
  // stored as absolute coords.
  labelOffset?: { t: number; offset: number };
  // Optional label-text formatting, mirroring the boxed-element fields so
  // an arrow's label can be sized / styled / coloured / fonted from the
  // Selected Element panel's Text accordion. All optional: absent → the
  // label renders at the default small (12px) size in the arrow's stroke
  // colour. Alignment + padding don't apply (the label sits at the
  // midpoint), so those fields are intentionally omitted.
  textSize?: TextSize;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Label colour, independent of `strokeColor` (the line). Falls back to
  // the stroke colour when unset so the label matches the line by default.
  textColor?: string;
  font?: string;
};

// --- Element union ---------------------------------------------------------

export type BoxedElement =
  | ShapeElement
  | TextElement
  | StickyElement
  | ImageElement
  | FreehandElement
  | TableElement
  | AnnotationElement
  | LinkCardElement;
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
    element.type === 'link-card'
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

// --- Re-exported resource modules -----------------------------------------
export * from './arrow-path';
export * from './arrow-style';
export * from './border-style';
export * from './shape-marker';
export * from './comments';
export * from './colors';

// Per-range label formatting (spec/09): the runs-as-delta model + pure
// helpers shared by the canvas renderer and the contentEditable editor.
export * from './rich-text';

export * from './factories';
export * from './table';

// Deterministic auto-layout for AI-generated diagrams (spec/25).
export * from './auto-layout';

// Human-readable name for an element's kind ('Square', 'Table', 'Icon', ...),
// used by selection captions and any surface that names what's selected.
export * from './element-kind-label';

export * from './geometry';
export * from './geometry-snapping';

export * from './groups';

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
