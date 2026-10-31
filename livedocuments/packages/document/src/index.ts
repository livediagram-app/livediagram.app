// Shared domain types for documents. Consumed by the editor app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles document data. See docs/specs/006-document/document-structure.md and
// docs/specs/008-canvas/canvas-and-palette.md.

// Value import from the data-shapes LEAF module (it imports only types from
// here, so no cycle at runtime) — elementSupportsText excludes the
// self-drawing data shapes the same way the inline editor does.
import type { TagColour } from './tag-colours';
import { isSelfDrawingShape } from './data-shapes';
import type { Page, PageOrientation } from './page';
import type { ArticleFlow } from './article-flow';

// Layer type used by the `Tab.layers` field below (docs/specs/006-document/layers.md). Type-only
// import (erased at build) so the index <-> layers circular reference is fine; the runtime layer
// helpers are re-exported lower down via `export * from './layers'`.
import type { Layer } from './layers';

// Per-range label formatting runs (docs/specs/008-canvas/canvas-and-palette.md). Type-only import so the
// index <-> rich-text relationship stays erasable; the runtime helpers +
// this type are re-exported lower down via `export * from '@liveworkspace/model-core/rich-text'`.
// Only the BoxedElement union members are imported for local use; the full set
// (incl. TableCellStyle / LinkCardMeta sub-types) is re-exported just below.
import type { ArrowElement } from './arrow-types';
import type { Finish } from './finish';
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
  ArticleNoteElement,
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
  ArticleNoteElement,
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
// re-exported lower down via `export * from '@liveworkspace/model-core/border-style'`.

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
// The model's plain vocabulary (ids, text size, padding, alignment, icon position, arrow flows,
// background patterns) is shared by every product: @liveworkspace/model-core/basics.
import type { TabId, ElementId, TextSize } from '@liveworkspace/model-core/basics';
// This product's patterns: the shared ones but those it retired (./retired-patterns), which a stored tab moves off.
import type { BackgroundPattern } from './retired-patterns';
export {
  RETIRED_PATTERNS,
  isBackgroundPattern,
  migrateRetiredPattern,
  type BackgroundPattern,
} from './retired-patterns';
export {
  PADDING_PX,
  ARROW_FLOWS,
  ANIMATED_BACKGROUND_PATTERNS,
  SEASONAL_BACKGROUND_PATTERNS,
  isSeasonalPattern,
  isAnimatedPattern,
  type TabId,
  type ElementId,
  type TextSizePreset,
  type TextSize,
  type Padding,
  type TextAlignX,
  type TextAlignY,
  type IconPosition,
  type ArrowFlow,
  type AnimatedBackgroundPattern,
  type SeasonalBackgroundPattern,
} from '@liveworkspace/model-core/basics';

export {
  DARK_CANVAS_BACKGROUND_COLOR,
  DARK_CANVAS_PATTERN_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@liveworkspace/model-core/canvas-colors';

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
  | TableElement
  | ArticleNoteElement
  | LinkCardElement
  | VideoElement;
export type Element = BoxedElement | ArrowElement;

export type Tab = {
  id: TabId;
  name: string;
  // Pages mode's pages (docs/specs/007-editor/pages-mode.md "The pages"): the A4 sheets,
  // in row order, each portrait or landscape, that everyone lays the tab out on. Absent = one page
  // (read via `pagesOf`).
  pages?: Page[];
  // The writing of the tab's article pages, by flow id (docs/specs/007-editor/article-pages.md):
  // each document's blocks and style, shared by its pages (`Page.flow`). Read via
  // `articlesOf`; synced block by block (the `article` room op), never in a `tab-meta` patch.
  articles?: Record<string, ArticleFlow>;
  // Legacy: a single page's orientation, from before multiple pages. Read as one page when `pages`
  // is absent; dropped the first time the pages change (`withPages`).
  pageOrientation?: PageOrientation;
  // The colours someone picked with + in a colour picker on this tab, newest first, lower-case
  // `#rrggbb` (docs/specs/004-interface-design/colour-picker.md "Custom colours"). Read via
  // `customColoursOf`; every picker in the document offers them as Custom Colours.
  customColours?: string[];
  // Tag colours (docs/specs/009-elements/tag-colours.md): a card tag mapped to a colour, read with `tagColoursOf`.
  tagColours?: TagColour[];
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
  // Selected preset theme name (see apps/editor/lib/themes.ts). Setting
  // a theme via the palette repaints every existing element on the tab
  // to match (sticky notes keep their amber palette). Newly added
  // elements inherit the same theme colours by default. Unset = brand
  // defaults.
  theme?: string;
  // Default font-family id for this tab (see ../packages/model-core/src/fonts.ts).
  // Every text-bearing element without its own `font` renders in this
  // one; unset = the editor default. Lets a whole tab adopt a font in
  // one move while individual elements can still override.
  font?: string;
  // Drawing style for every element without its own (docs/specs/008-canvas/finish.md); unset = Flexible.
  finish?: Finish;
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
  // Photoshop-style layers (docs/specs/006-document/layers.md), ordered BOTTOM -> TOP (index 0
  // paints lowest). Absent = the tab behaves as one implicit default
  // layer; the array is materialised lazily on the first layer
  // operation (see layers.ts). Elements point in via `layerId`.
  layers?: Layer[];
};

// --- Type guards -----------------------------------------------------------

export { takesTypedLabel } from './element-types';
export * from './accent-edge';
export * from './card';
export * from './chip';
export * from './attachment';
export * from './pointer-note';
export * from './tag-colours';
export * from './stack';
export * from './concept';
export * from './concept-timeline';
export * from './concept-ramp';
export * from './shape-variants';
export * from '@liveworkspace/model-core/title-caption';
export * from './editor-mode';
export * from './tab-stats';
export * from './page';
export * from '@liveworkspace/model-core/page-fit';
export * from './page-image';
export * from './page-lock';
export * from './page-of';
export * from './wordmark';
export * from './page-content';
export * from './page-frame';
export * from './page-ink';
export * from './page-ink-contrast';
export * from './page-ink-ground';
export * from './page-ink-rules';
export * from './paginate';
export * from './article-flow';
export * from './article-flow-ops';
export * from './article-pages';
export * from './flashcards';
export * from './flashcard-guard';
export * from './article-style';
export * from './article-zones';
export * from './article-notes';
export * from './article-intake';
export * from './article-markdown';
export * from './article-markdown-io';
export * from './page-paint';
export * from './page-default-background';
export * from './pages-edits';
export * from './pages-background-copy';
export * from './tab-window';

export function isBoxed(element: Element): element is BoxedElement {
  return (
    element.type === 'shape' ||
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'image' ||
    element.type === 'freehand' ||
    element.type === 'table' ||
    element.type === 'article-note' ||
    element.type === 'link-card' ||
    element.type === 'video'
  );
}

// True when the element carries a non-empty text label — the plain-text
// `label` every labelable kind mirrors (shape / text / sticky / freehand /
// link-card and arrows). Drives the selection toolbar's "Edit Text" button,
// which only appears once an element actually has text to edit. Tables
// (per-cell `cells`), images (`alt`), and margin notes carry no
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
// Drives the selection toolbar's "Edit Text" / "Add Text" button, which
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
export * from '@liveworkspace/model-core/arrow-avoidance';
export * from './nearest-towards';
export * from './youtube';
export * from './arrow-path';
export * from './arrow-dash';
export * from '@liveworkspace/model-core/arrow-label';
export * from './arrow-label-layout';
export * from '@liveworkspace/model-core/arrow-label-wrap';
export * from './arrow-bend';
export * from './arrow-scale';
export * from '@liveworkspace/model-core/label-font';
export * from '@liveworkspace/model-core/table-cell-font';
export * from './arrow-style';
export * from './er-heads';
export * from '@liveworkspace/model-core/border-style';
// Element drop shadows (docs/specs/008-canvas/element-shadows.md): model, presets + render builders.
export * from './shadow';
export * from './finish';
export * from './sketch';
export * from './sketch-element';
export * from './sketch-backdrop';
export * from './marker';
export * from './marker-element';
// A face's own parts in its finish (docs/specs/008-canvas/finish.md "Faces").
export * from '@liveworkspace/model-core/face-finish';
export * from './marker-face';
export * from './hand-drawn';
export * from './drawn-outline-finish';
// Which elements can be rotated (a margin note's marker cannot).
export * from './rotation';
export * from '@liveworkspace/model-core/shape-marker';
// Fixed-size elements.
export * from './selection-mode';
export * from './comments';
export * from './collab-index-rows';
export * from './comment-thread';
// The whole-document `livedocuments.document` envelope and the per-tab JSON and Markdown export (the editor and the
// CLI's pull files).
export * from './document-envelope';
export * from './export-tab-text';
export * from '@liveworkspace/model-core/comment-mentions';
// Comment reactions (docs/specs/012-collaboration/comment-reactions.md): the six, the stored shape and the toggle.
export * from '@liveworkspace/model-core/comment-reactions';
// The shared plain-object guard for untrusted JSON.
export * from '@liveworkspace/model-core/is-record';
// The shared FNV-1a string hash for deterministic picks.
export * from '@liveworkspace/model-core/string-hash';
// The shared seeded PRNG for deterministic randomness.
export * from '@liveworkspace/model-core/seeded-random';
// The shared count-with-noun wording.
export * from '@liveworkspace/model-core/plural';
// Per-element assigned actions (docs/specs/012-collaboration/assigned-actions.md).
export * from './element-action';
export * from './data-shapes';
export * from './sankey-model';
export * from './sankey-layout';
export * from './sankey-frame';
export * from './sankey-text';
export * from '@liveworkspace/model-core/code-themes';
export * from './chart-palettes';
export * from './chart-frame';
export * from './chart-ink';
export * from './chart-types';
export * from './chart-marks';
export * from './chart-axis';
export * from './chart-values';
export * from './shape-geometry';
export * from '@liveworkspace/model-core/color-wash';
export { labelOn } from './readable-colour';
export * from './quick-swatches';
export * from './quick-swatch-rederive';
export * from './web-components';
export * from './colors';
export * from './cell-colours';
export * from './table-header-colours';
export * from './progress-colours';
export * from '@liveworkspace/model-core/icon-size';
export * from '@liveworkspace/model-core/icon-weight';

// Per-range label formatting (docs/specs/008-canvas/canvas-and-palette.md): the runs-as-delta model + pure
// helpers shared by the canvas renderer and the contentEditable editor.
export * from '@liveworkspace/model-core/rich-text';

export * from './factories';
export * from './segment-geometry';
export * from './duplicate';
export * from './polyline';
export * from './pen-stroke';
export * from '@liveworkspace/model-core/stroke-points';
export * from '@liveworkspace/model-core/stroke-points-cache';
export * from './freehand-points';
export * from '@liveworkspace/model-core/stroke-points-debug';
export * from './pen-colours';
export * from './standard-colours';
export * from './custom-colours';
export * from './stock-colours';
export * from './component-factories';
export * from './table';

// Runtime structural validation for Element + Tab (the trust-boundary guard
// the API uses to vet incoming tabs / documents). See validate.ts.
export * from './validate';
export * from './savable';

// Every stored field per element type (docs/specs/024-agents/blueprints/edit-operations.md).
export * from './element-fields';

// Deterministic auto-layout for agent-built diagrams and the editor's Auto Layout.
export * from './auto-layout';
// The editor's Tidy Up profile (docs/specs/008-canvas/layout-cleanup.md): whether a style suits a tab.
export { tidyLayoutElements, tidyMindmapFits } from './auto-layout-tidy';

// The layout engine's gaps, which edit operations place and make room by.
export { LAYER_GAP, SIBLING_GAP } from './auto-layout-shared';
// The nodes a layout leaves loose swept into rows, and the room a container keeps round its members.
export { CONTAINER_PAD, CONTAINER_TOP, sweepEdgelessNodes } from './auto-layout-sweep';

// Authoring input shared by the MCP, the api and the CLI (docs/specs/015-api/mcp-server.md §4.7a):
// raw elements made safe, labels capped and boxes sized to them, and finished tabs built.
export * from './element-normalise';
export * from './label-box';
export * from './tab-builders';

// Headless SVG renderer (docs/specs/015-api/mcp-server.md §5): per-element drawers + renderElementsToSvg,
// shared by the in-app export and the MCP worker's inline image render.
export * from './svg-render';
export { ELEMENT_FIELD_VALUES, fieldValueIssue } from './element-field-values';
export { inlineIconGap, inlineIconMetrics } from './svg-render-inline-icon';
export { SKETCH_ART_FILTER_ID, SKETCH_FACE_FILTER, svgSketchArtFilter } from './svg-render-sketch';
export * from './svg-render-table';
export { mixHex } from '@liveworkspace/model-core/color-wash';

// Theme engine (docs/specs/011-theme/multicolour-themes.md, /42, /44, /48): theme catalogue + types + the pure
// recolour / switch / reset / preset transforms, shared by the editor and the
// MCP worker (docs/specs/015-api/mcp-server.md). Resolution in the viewer's appearance stays in apps/editor/lib/themes.ts.
export * from './theme-graph';
export * from './themes';
export * from './theme-halves';
export * from './theme-presets';

// Human-readable name for an element's kind ('Square', 'Table', 'Icon', ...),
// used by selection captions and any surface that names what's selected.
export * from './element-kind-label';

// The name a boxed element goes by in a list of elements (the Collaborate
// Panel's rows, the Inbox's rows): its label, a table's first cell,
// or "Untitled".
export * from './element-display-label';

// Anchor table, outlines and side choice (docs/specs/008-canvas/arrow-anchors.md).
export * from './anchors';
export * from './anchor-layouts';
export * from './shape-outline';
export * from '@liveworkspace/model-core/svg-path-outline';
export * from './shape-hit';
// The band a shape's label sits in (docs/specs/008-canvas/canvas-and-palette.md "Shape primitives").
export * from './label-body';
export * from './indicator-placement';
export * from './anchor-choice';
export * from './arrow-body-drop';
export * from './geometry';
export * from './arrow-path-hits';
export * from './arrow-rebind';
export * from './arrow-endpoint-spread';
export * from './arrow-orthogonal';
// Arrows breaking around intervening boxes at render time (docs/specs/008-canvas/arrow-route-behind.md).
export * from './arrow-behind';
export * from './element-grid';
// Tab + document name length cap (docs/specs/006-document/name-length.md).
export * from '@liveworkspace/model-core/names';
export * from './geometry-snapping';
export * from './arrow-snapping';
export * from './geometry-guides';

// Layer order + union bounds, and the load-time migration of documents saved
// while groups existed (docs/specs/009-elements/web-components-and-no-groups.md).
export * from './layer-order';
export * from './legacy-stroke-points';
export * from './stored-elements';
export { isSafeColourValue } from './unsafe-colours';
export * from './stored-tab';
export { settleTabFields } from './tab-fields';

// Photoshop-style layers (docs/specs/006-document/layers.md): the Layer type used by the Tab field
// above, band-aware render ordering, and the pure layer operations.
export * from './layers';
export * from './layer-operations';

// Element-level realtime ops (docs/specs/012-collaboration/realtime-conflict-resolution.md): the ElementOp type + the pure
// diff/apply functions the realtime room uses to merge concurrent edits.
export * from './element-ops';
export * from './participant-content';
export * from './participant-article';
export * from './element-fingerprint';

// Per-element deltas for the fields many participants write at once
// (docs/specs/012-collaboration/collab-race-hardening.md): checklist ticks and comments.
export * from './element-deltas';

// The room's record of those deltas, merged into each save so D1 keeps what
// the room saw (docs/specs/012-collaboration/collab-race-hardening.md phase 3).
export * from './collab-ledger';

// Tab-folder grouping + order normalization (docs/specs/006-document/tab-folders.md). One home
// shared by the tab-bar renderer, the client save path, and the
// server route so the contiguous-run invariant has a single
// implementation.
export * from './tab-folders';

// The curated typefaces (docs/specs/004-interface-design/fonts.md): the catalogue, the id -> CSS stack
// resolver, and the Google Fonts stylesheet href. Lives here rather than in
// apps/editor because the EXPORTS need it too — the SVG / PNG renderers have
// to paint a label in the face the canvas painted it in, and they run in the
// mcp worker as well as the browser.
export * from '@liveworkspace/model-core/fonts';

// Slide decks (docs/specs/012-collaboration/presentation-mode.md): the Slide / Deck types plus the pure resolution
// helpers a presentation is built from. Kept here rather than in apps/editor
// because the api and the MCP worker can answer the same questions.
export * from './slide-deck';
export * from './slide-deck-pages';
// Refs, slug ids, kind words, derived containment and the style keys (docs/specs/024-agents/document-views.md):
// how views, edit operations and the lint name and place elements alike.
export * from './element-refs';
export * from './containment';
export * from '@liveworkspace/model-core/style-keys';
export * from '@liveworkspace/model-core/tab-names';
export * from './svg-render-pages';
export * from './article-draw-ops';
export * from './article-layout-estimate';
export { lineChars } from './svg-render-web';
export * from './drawn-count';
// The a / an rule for copy built around a name, shared with every package above this one.
export { indefiniteArticle, withArticle } from '@liveworkspace/model-core/indefinite-article';
