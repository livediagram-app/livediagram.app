// Shared domain types for documents. Consumed by the editor app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles document data. See docs/specs/006-document/document-structure.md and
// docs/specs/008-canvas/canvas-and-palette.md.

export type { Anchor, ArrowEnds, ArrowElement, Endpoint } from './arrow-types';
export type { ShapeKind } from './shape-kind';
export { SHAPE_GEOMETRY_KINDS } from './shape-kind';
export { ALL_ANCHORS } from './arrow-types';

export {
  IMAGE_CREDIT_TEXT_MAX,
  IMAGE_CREDIT_URL_MAX,
  isCreditUrl,
  isImageCredit,
  type ImageCredit,
} from './image-credit';
export * from './image-frame';
export * from './logo-strip';
export {
  IMAGE_ALT_MAX,
  cleanImageAlt,
  cleanImageAlts,
  imageAltTextOf,
  withCleanImageAlt,
} from './image-alt';
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
// This product's patterns: the shared ones but those it retired (./retired-patterns), which a stored tab moves off.
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

// The element union, the cross-tab link and the element guards (./element-union), and the Tab type
// (./tab-type). Every module here imports them from this root as before.
export * from './element-union';
export type { Tab } from './tab-type';
import type { Element } from './element-union';

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
export * from './label-backdrop';
export * from './page-ink-ground';
export * from './page-ink-rules';
export * from './paginate';
export * from './article-flow';
export * from './article-table';
export * from './article-toc';
export * from './article-footnotes';
export * from './article-bands';
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
export * from './page-theme-fills';
export * from './pages-edits';
export * from './pages-background-copy';
export * from './tab-window';

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
// Text effects (docs/specs/008-canvas/text-effects.md): gradient presets and the highlight band.
export * from './text-effects';
export * from './finish';
export * from './image-backing';
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
// Map (docs/specs/009-elements/map.md): its model and layout; the geometry is the
// `@livedocuments/document/map-geometry` subpath, never this barrel.
export * from './map-model';
export * from './map-layout';
export * from './map-geometry-ensure';
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
// A stat's change line and count-up (docs/specs/009-elements/stat-row.md); the quote (docs/specs/009-elements/quote.md);
// the table's marks and highlighted column (docs/specs/009-elements/comparison-tables.md).
export * from './stat-count';
export * from './quote';
export * from './element-images';
export * from './table-marks';
export * from './colors';
export * from './cell-colours';
export * from './table-header-colours';
export * from './progress-colours';
export * from '@liveworkspace/model-core/icon-size';
export * from '@liveworkspace/model-core/progress-label';
export * from '@liveworkspace/model-core/icon-weight';

// Per-range label formatting (docs/specs/008-canvas/canvas-and-palette.md): the runs-as-delta model + pure
// helpers shared by the canvas renderer and the contentEditable editor.
export * from '@liveworkspace/model-core/rich-text';

export * from './factories';
export * from './text-presets';
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
export { borderOf } from './svg-render-border';
export { ELEMENT_FIELD_VALUES, fieldValueIssue } from './element-field-values';
export { inlineIconGap, inlineIconMetrics } from './svg-render-inline-icon';
export {
  DOCUMENT_TEXT_PX_MAX,
  DOCUMENT_TEXT_PX_MIN,
  drawnTextSize,
  labelTextScale,
  splitTextPx,
  textPxRangeFor,
  textSizeFields,
  withPickedTextSize,
  type TextPxRange,
} from './label-text-scale';
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
// The grid over this product's own elements (the shared grid is generic over any element union).
export type ElementGrid = SharedElementGrid<Element>;
export type ElementIndex = SharedElementIndex<Element>;
import type { ElementIndex as SharedElementIndex } from '@liveworkspace/element-model/geometry';
import type { ElementGrid as SharedElementGrid } from '@liveworkspace/element-model/element-grid';
// Tab + document name length cap (docs/specs/006-document/name-length.md).
export * from '@liveworkspace/model-core/names';
export * from './geometry-snapping';
export * from './arrow-snapping';
export * from '@liveworkspace/element-model/geometry-guides';

// Layer order + union bounds, and the load-time migration of documents saved
// while groups existed (docs/specs/009-elements/web-components-and-no-groups.md).
export * from './layer-order';
export * from './legacy-stroke-points';
export * from './stored-elements';
export { isSafeColourValue } from '@liveworkspace/element-model/unsafe-colours';
export * from './stored-tab';
export { settleTabFields } from './tab-fields';
// What a save changed, merged over the stored tab by id (docs/specs/012-collaboration/collab-race-hardening.md).
export * from './tab-save-changes';

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
export * from './slide-notes';
export * from './slide-notes-merge';
export * from './slide-deck-patch';
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
