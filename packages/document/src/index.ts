// Shared domain types for documents. Consumed by the live app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles document data. See docs/specs/006-document/document-structure.md and
// docs/specs/008-canvas/canvas-and-palette.md.

// Live session-tool types used by the `Tab.timer` / `Tab.vote` fields
// below. Type-only import (erased at build) so the index <-> session
// circular reference is fine. The runtime helpers are re-exported lower
// down via `export * from './session'`.
// Value import from the data-shapes LEAF module (it imports only types from
// here, so no cycle at runtime) — elementSupportsText excludes the
// self-drawing data shapes the same way the inline editor does.
import { isSelfDrawingShape } from './data-shapes';
import type { TabKind } from './tab-kind';
import type { EditorMode } from './editor-mode';
import type { IllustratePage, PageOrientation } from './illustrate-page';
import type { ArticleFlow } from './article-flow';
import type { TabTimer, TabVote } from './session';

// Layer type used by the `Tab.layers` field below (docs/specs/006-document/layers.md). Type-only
// import for the same erasability reason as session; the runtime layer
// helpers are re-exported lower down via `export * from './layers'`.
import type { Layer } from './layers';

// Per-range label formatting runs (docs/specs/008-canvas/canvas-and-palette.md). Type-only import so the
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
  PathElement,
  AnnotationElement,
  LinkCardElement,
  VideoElement,
} from './element-types';
export {
  IMAGE_CREDIT_TEXT_MAX,
  IMAGE_CREDIT_URL_MAX,
  isCreditUrl,
  isImageCredit,
  type ImageCredit,
} from './image-credit';
export type {
  ChartLegendPosition,
  ShapeElement,
  TextElement,
  TextSizing,
  TableCellStyle,
  TableElement,
  StickyElement,
  ImageElement,
  FreehandElement,
  PathElement,
  PathHandleMode,
  PathNode,
  PathPoint,
  AnnotationElement,
  LinkCardMeta,
  LinkCardElement,
  VideoElement,
  PlanCardRef,
  PlanSheetRef,
  PlanViewRef,
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
export type DocumentId = string;
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
// drag-an-icon-onto-a-shape feature, docs/specs/008-canvas/canvas-and-palette.md). The drop-side detection, the
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

// Flowing-arrow animation (docs/specs/008-canvas/canvas-and-palette.md): 'dashes' marches the dash pattern along
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
  // Animated patterns (docs/specs/008-canvas/canvas-and-palette.md): soft ambient motion rendered as an
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

export {
  DARK_CANVAS_BACKGROUND_COLOR,
  DARK_CANVAS_PATTERN_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from './canvas-colors';

// Cross-tab link on any element. `tab` jumps to another tab on the same
// document; `document` navigates to a different document entirely (with
// the document's name cached on the element so the picker / badge can
// show it without a round-trip). Element-specific linking
// (jump-and-focus a specific element) is in the spec but not in the
// UI yet.
export type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId }
  | { kind: 'document'; documentId: string; name: string }
  // An external web address. Followed by opening in a new tab; stored
  // verbatim (the UI normalises a bare host to https:// on entry). Used
  // by both element links and per-cell table links (docs/specs/008-canvas/canvas-and-palette.md).
  | { kind: 'url'; url: string };

// --- Element union ---------------------------------------------------------

export type BoxedElement =
  | ShapeElement
  | TextElement
  | StickyElement
  | ImageElement
  | FreehandElement
  | PathElement
  | TableElement
  | AnnotationElement
  | LinkCardElement
  | VideoElement;
export type Element = BoxedElement | ArrowElement;

// What KIND of board this tab is, when it is a specialised one. A board
// kind changes how the editor presents the same underlying tab: an
// 'event-storming' board opens the palette on its notation, fixes the note
// silhouettes, blocks resize and swaps the element menu for verbs
// (docs/specs/021-event-storming/event-storming.md). Absent = an ordinary tab, which is every tab by default.
//
// This is deliberately a FIRST-CLASS field rather than something inferred
// from the tab's contents or its layer ids: identity by proxy broke twice
// (a three-layer checklist, then a single layer a facilitator can delete),
// each time stripping a board of its own tooling with nothing on screen to
// explain why. The editor stays one editor — a kind tunes presentation, it
// does not fork persistence, realtime, comments or export.
//
// 'diagram' is an ordinary tab and is written explicitly onto tabs the
// editor commits; tabs stored before the field carry nothing, which reads
// as 'diagram' via `tabKindOf` (see ./tab-kind).

export type Tab = {
  id: TabId;
  name: string;
  kind?: TabKind;
  // The tab's editor mode, the same for everyone on it and the mode it opens in
  // (docs/specs/007-editor/editor-modes.md "Where the mode lives"). Absent = 'diagram' (read via
  // `opensInOf`); a switch sets it as one tab edit (withEditorModeSwitched).
  opensIn?: EditorMode;
  // Illustrate mode's pages (docs/specs/007-editor/editor-modes.md "The pages"): the A4 sheets,
  // in row order, each portrait or landscape, that everyone lays the tab out on. Absent = one page
  // (read via `illustratePagesOf`).
  pages?: IllustratePage[];
  // The writing of the tab's article pages, by flow id (docs/specs/007-editor/article-pages.md):
  // each document's blocks and style, shared by its pages (`IllustratePage.flow`). Read via
  // `articlesOf`; synced block by block (the `doc` room op), never in a `tab-meta` patch.
  articles?: Record<string, ArticleFlow>;
  // Legacy: a single page's orientation, from before multiple pages. Read as one page when `pages`
  // is absent; dropped the first time the pages change (`withIllustratePages`).
  pageOrientation?: PageOrientation;
  // An event-storming board whose workshop notes have been settled onto the
  // lanes once (docs/specs/021-event-storming/event-storming.md "Always on a lane"). Set by that settle, by the
  // template, or by a file import; never cleared, and grafted across undo.
  esLanesSettled?: boolean;
  // The colours someone picked with + in a colour picker on this tab, newest first, lower-case
  // `#rrggbb` (docs/specs/004-interface-design/colour-picker.md "Custom colours"). Read via
  // `customColoursOf`; every picker in the document offers them as Custom Colours.
  customColours?: string[];
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
  // Motion speed for an ANIMATED background pattern (docs/specs/008-canvas/canvas-and-palette.md), defaults to
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
  // Default font-family id for this tab (see packages/document/src/fonts.ts).
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
  // are blocked for as long as this tab is active. Toggled from the
  // tab ellipsis menu.
  locked?: boolean;
  // Per-document folder name (docs/specs/006-document/tab-folders.md). Tabs sharing a name render
  // as a contiguous run under one collapsible chip in the tab bar.
  // This is link metadata, not body content: it's stripped from the
  // persisted tab body and carried on the document_tabs row alongside
  // order_index, so a shared tab can be foldered in one document and
  // loose in another. Unset / empty = loose. See tab-folders.ts for
  // the normalize + grouping helpers.
  folder?: string;
  // Live session tools (docs/specs/012-collaboration/session-tools.md), facilitator-run + synced to every
  // participant via the normal tab sync. `timer` is a countdown /
  // stopwatch; `vote` is a dot-voting session. Both are edit-role
  // controlled (the room drops view-role mutations) and absent until a
  // facilitator starts one. See session.ts for the pure helpers.
  timer?: TabTimer;
  vote?: TabVote;
  // Photoshop-style layers (docs/specs/006-document/layers.md), ordered BOTTOM -> TOP (index 0
  // paints lowest). Absent = the tab behaves as one implicit default
  // layer; the array is materialised lazily on the first layer
  // operation (see layers.ts). Elements point in via `layerId`.
  layers?: Layer[];
};

// --- Type guards -----------------------------------------------------------

export {
  isPlanSheetRef,
  newPlanSheetId,
  PLAN_SHEET_ID_PATTERN,
  takesTypedLabel,
} from './element-types';
export { DEFAULT_TAB_KIND, stampTabKind, tabKindOf, type TabKind } from './tab-kind';
export * from './editor-mode';
export * from './illustrate-page';
export * from './illustrate-page-fit';
export * from './page-lock';
export * from './page-of';
export * from './logo-page';
export * from './element-mirror';
export * from './element-symmetry';
export * from './logo-guide-snap';
export * from './wordmark';
export * from './illustrate-page-content';
export * from './illustrate-paginate';
export * from './editor-mode-switch';
export * from './article-flow';
export * from './article-flow-ops';
export * from './article-pages';
export * from './article-style';
export * from './article-zones';
export * from './article-notes';
export * from './article-to-page';
export * from './article-intake';
export { migrateWhiteboardKind } from './legacy-whiteboard-tab';
export { downgradeLinks, upgradeLegacyLinks } from './legacy-links';

export function isBoxed(element: Element): element is BoxedElement {
  return (
    element.type === 'shape' ||
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'image' ||
    element.type === 'freehand' ||
    element.type === 'path' ||
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
// double-click opens the link picker (docs/specs/009-elements/link-cards.md) — an Add-text button there
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
export * from './animation-membership';
export * from './arrow-avoidance';
export * from './nearest-towards';
export * from './mind-flow';
export * from './mind-map';
export * from './mind-layout';
export * from './mind-grow';
export * from './mind-outline-text';
export * from './mind-outline-marks';
export * from './mind-outline';
export * from './youtube';
export * from './arrow-path';
export * from './arrow-label';
export * from './arrow-label-layout';
export * from './arrow-label-wrap';
export * from './arrow-bend';
export * from './arrow-scale';
export * from './label-font';
export * from './lane-gutter';
export * from './arrow-style';
export * from './border-style';
// Element drop shadows (docs/specs/008-canvas/element-shadows.md): model, presets + render builders.
export * from './shadow';
// Which elements can be rotated (an annotation marker cannot).
export * from './rotation';
export * from './shape-marker';
// Selection modes a Mode Button can switch to (docs/specs/009-elements/mode-button.md).
export * from './selection-mode';
export * from './behaviour-skin';
// How a poll's answers are shaped (docs/specs/012-collaboration/live-poll.md), shared by the Session button's
// stored config below and by @livediagram/api-schema's wire `LivePoll`.
export * from './poll-style';
export * from './comments';
export * from './comment-thread';
export * from './item-comments';
// The whole-document `livediagram.document` envelope and the per-tab JSON and Markdown export (the editor, the
// Drive mirror and the CLI's pull files).
export * from './document-envelope';
export * from './export-tab-text';
export * from './export-tab-plan';
export * from './plan-board-layout';
export * from './comment-mentions';
// Per-element assigned actions (docs/specs/012-collaboration/assigned-actions.md).
export * from './element-action';
export * from './data-shapes';
export * from './entity-geometry';
export * from './code-themes';
export * from './chart-palettes';
export * from './chart-frame';
export * from './chart-source';
// Per-participant responses (docs/specs/012-collaboration/participant-responses.md) + the collaboration element family
// (docs/specs/012-collaboration/estimate-card.md to docs/specs/009-elements/chair.md). Both leaf modules, for the factories cycle.
export * from './responses';
export * from './collab-shapes';
// Quiz (docs/specs/012-collaboration/quiz.md). A leaf module, for the same cycle.
export * from './quiz';
export * from './shape-geometry';
export * from './actor-figure';
export * from './color-wash';
export * from './quick-swatches';
export * from './quick-swatch-rederive';
// The Q&A board (docs/specs/012-collaboration/qa-board.md)
export * from './qa-board';
export * from './web-components';
// The Behaviours family (docs/specs/010-palette/palette-top-level-categories.md): which kinds are in it, and which of them
// draw their own `…` rather than taking the shared settings one.
export * from './behaviour-shapes';
export * from './colors';
export * from './icon-size';
export * from './icon-weight';

// Per-range label formatting (docs/specs/008-canvas/canvas-and-palette.md): the runs-as-delta model + pure
// helpers shared by the canvas renderer and the contentEditable editor.
export * from './rich-text';

export * from './factories';
export * from './event-storming';
export * from './event-storming-lanes';
export * from './event-storming-lane-landing';
export * from './event-storming-next';
export * from './event-storming-photo';
export * from './whiteboard';
export * from './whiteboard-stroke';
export * from './graph-authoring';
export * from './mermaid';
export * from './duplicate';
export * from './polyline';
export * from './pen-stroke';
export * from './stroke-points';
export * from './stroke-points-cache';
export * from './freehand-points';
export * from './stroke-points-debug';
export * from './pen-colours';
export * from './standard-colours';
export * from './custom-colours';
export * from './stock-colours';
export * from './snap-colours';
export * from './path-geometry';
export * from './path-element';
export * from './component-factories';
export * from './table';

// Runtime structural validation for Element + Tab (the trust-boundary guard
// the API uses to vet incoming tabs / documents). See validate.ts.
export * from './validate';
export * from './savable';

// Every stored field per element type (docs/specs/024-agents/blueprints/edit-operations.md).
export * from './element-fields';

// Deterministic auto-layout for AI-generated diagrams (docs/specs/007-editor/ai-assistance.md).
export * from './auto-layout';

// Cluster-aware graph layout (docs/specs/020-import-export/mermaid.md): Mermaid subgraphs as frames.
export * from './auto-layout-clusters';
// The layout engine's gaps, which edit operations place and make room by.
export { LAYER_GAP, SIBLING_GAP } from './auto-layout-shared';

// Authoring input shared by the MCP, the api and the CLI (docs/specs/015-api/mcp-server.md §4.7,
// §4.7a): raw elements made safe, graph input capped and laid out, and finished tabs built.
export * from './element-normalise';
export * from './graph-input';
export * from './tab-builders';

// Shared by the editor's text export + import and reusable by the api / MCP.

// Headless SVG renderer (docs/specs/015-api/mcp-server.md §5): per-element drawers + renderElementsToSvg,
// shared by the in-app export and the MCP worker's inline image render.
export * from './svg-render';
export * from './svg-render-plan-sheet';
export * from './svg-render-table';

// Theme engine (docs/specs/011-theme/multicolour-themes.md, /42, /44, /48): theme catalogue + types + the pure
// recolour / switch / reset / preset transforms, shared by the editor and the
// MCP worker (docs/specs/015-api/mcp-server.md). Custom-theme resolution stays in apps/live/lib/themes.ts.
export * from './theme-graph';
export * from './themes';
export * from './theme-presets';

// Human-readable name for an element's kind ('Square', 'Table', 'Icon', ...),
// used by selection captions and any surface that names what's selected.
export * from './element-kind-label';

// The name a boxed element goes by in a list of elements (the Collaborate
// Panel's rows, the Activity page's rows): its label, a table's first cell,
// or "Untitled".
export * from './element-display-label';

// Anchor table, outlines and side choice (docs/specs/008-canvas/arrow-anchors.md).
export * from './anchors';
export * from './anchor-layouts';
export * from './shape-outline';
export * from './svg-path-outline';
export * from './shape-hit';
// The band a shape's label sits in (docs/specs/008-canvas/canvas-and-palette.md "Shape primitives").
export * from './label-body';
export * from './shape-area';
export * from './indicator-placement';
export * from './anchor-choice';
export * from './geometry';
export * from './arrow-path-hits';
export * from './arrow-rebind';
export * from './arrow-endpoint-spread';
export * from './arrow-orthogonal';
export * from './arrow-reciprocal';
// Arrows breaking around intervening boxes at render time (docs/specs/008-canvas/arrow-route-behind.md).
export * from './arrow-behind';
export * from './element-grid';
// Tab + document name length cap (docs/specs/006-document/name-length.md).
export * from './names';
export * from './geometry-snapping';
export * from './arrow-snapping';
export * from './geometry-guides';

// Layer order + union bounds, and the load-time migration of documents saved
// while groups existed (docs/specs/009-elements/web-components-and-no-groups.md).
export * from './layer-order';
export * from './legacy-groups';
export * from './legacy-docks';
export * from './legacy-stroke-points';
export * from './stored-elements';
export * from './stored-tab';
export { retiredSchemeOf, migrateRetiredScheme, type RetiredScheme } from './retired-schemes';

// Photoshop-style layers (docs/specs/006-document/layers.md): the Layer type used by the Tab field
// above, band-aware render ordering, and the pure layer operations.
export * from './layers';
export * from './layer-operations';

// Element-level realtime ops (docs/specs/012-collaboration/realtime-conflict-resolution.md): the ElementOp type + the pure
// diff/apply functions the realtime room uses to merge concurrent edits.
export * from './element-ops';
export * from './element-fingerprint';

// Per-element deltas for the fields many participants write at once
// (docs/specs/012-collaboration/collab-race-hardening.md): answers, ideas, checklist ticks, comments.
export * from './element-deltas';
export * from './plan-board-patch';

// The room's record of those deltas, merged into each save so D1 keeps what
// the room saw (docs/specs/012-collaboration/collab-race-hardening.md phase 3).
export * from './collab-ledger';

// Tab-folder grouping + order normalization (docs/specs/006-document/tab-folders.md). One home
// shared by the tab-bar renderer, the client save path, and the
// server route so the contiguous-run invariant has a single
// implementation.
export * from './tab-folders';

// Live session tools (docs/specs/012-collaboration/session-tools.md): the TabTimer / TabVote types used by the
// Tab fields above, plus the pure timer + vote helpers.
export * from './session';

// Pencil-tool shape recognition (docs/specs/008-canvas/canvas-and-palette.md Pencil (freehand)
// subsection's recognise mode). Re-exported so callers import
// from the package root the same way they do every other helper
// here.
export { recogniseShape, type RecognisedShape, type RecognisedShapeKind } from './recognise-shape';

// The curated typefaces (docs/specs/004-interface-design/fonts.md): the catalogue, the id -> CSS stack
// resolver, and the Google Fonts stylesheet href. Lives here rather than in
// apps/live because the EXPORTS need it too — the SVG / PNG renderers have
// to paint a label in the face the canvas painted it in, and they run in the
// mcp worker as well as the browser.
export * from './fonts';

// Slide decks (docs/specs/012-collaboration/presentation-mode.md): the Slide / Deck types plus the pure resolution
// helpers a presentation is built from. Kept here rather than in apps/live
// because the api and the MCP worker can answer the same questions.
export * from './slide-deck';
export * from './lane-seam-snapping';
// Refs, slug ids, kind words, derived containment and the style keys (docs/specs/024-agents/document-views.md):
// how views, edit operations and the lint name and place elements alike.
export * from './element-refs';
export * from './containment';
export * from './style-keys';
export * from './plan-palette';
