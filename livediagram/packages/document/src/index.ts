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
// livediagram's patterns: the shared ones plus its own (./background-pattern), Isometric among them.
// The selection-mode glyphs: the shared ones plus livediagram's own (./mode-glyphs), Isometric among them.
export { MODE_GLYPHS, type ModeGlyph } from './mode-glyphs';
export { isBackgroundPattern, type BackgroundPattern } from './background-pattern';
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
export { DEFAULT_TAB_KIND, stampTabKind, tabKindOf, type TabKind } from './tab-kind';
export * from './accent-edge';
export * from './card';
export * from './chip';
export * from './attachment';
export * from './pointer-note';
export * from './tag-colours';
export * from './diagram-key';
export * from './stack';
export * from './sequence-element';
export * from './sequence-text';
export { sequenceDrawing, type SequenceLook } from './svg-render-sequence';
export * from './person-node';
export * from './boundary';
export * from './concept';
export * from './concept-timeline';
export * from './concept-ramp';
export * from './shape-variants';
export * from '@liveworkspace/model-core/title-caption';
export * from './editor-mode';
export * from './tab-stats';
export * from './wordmark';
export * from './editor-mode-switch';
export * from './tab-has-drawing';
export { migrateWhiteboardKind } from './legacy-whiteboard-tab';
export { downgradeLinks, upgradeLegacyLinks } from './legacy-links';

// --- Re-exported resource modules -----------------------------------------
export * from './animation';
export * from './animation-membership';
export * from '@liveworkspace/model-core/arrow-avoidance';
export * from './nearest-towards';
export * from './flowchart';
export * from './flowchart-layout';
export * from './flowchart-grow';
export * from './flowchart-settle';
export * from './mind-flow';
export * from './mind-connector-route';
export * from './mind-map';
export * from './mind-layout';
export * from './mind-grow';
export * from './mind-fit';
export * from './mind-outline-text';
export * from './mind-outline-marks';
export * from './mind-outline';
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
export * from './lane-gutter';
export * from './arrow-style';
export * from './er-heads';
export * from './er-hub-first';
export * from '@liveworkspace/model-core/border-style';
// Element drop shadows (docs/specs/008-canvas/element-shadows.md): model, presets + render builders.
export * from './shadow';
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
// Which elements can be rotated (an annotation marker cannot).
export * from './rotation';
export * from '@liveworkspace/model-core/shape-marker';
// Selection modes a Mode Button can switch to (docs/specs/009-elements/mode-button.md).
export * from './selection-mode';
export * from './behaviour-skin';
// How a poll's answers are shaped (docs/specs/012-collaboration/live-poll.md), shared by the Session button's
// stored config below and by @livediagram/api-schema's wire `LivePoll`.
export * from './poll-style';
export * from './comments';
export * from './collab-index-rows';
export * from './comment-thread';
// The whole-document `livediagram.document` envelope and the per-tab JSON and Markdown export (the editor, the
// Drive mirror and the CLI's pull files).
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
export * from './entity-geometry';
export * from './entity-fields';
export * from './entity-look';
export * from './entity-related';
export * from '@liveworkspace/model-core/code-themes';
export * from './chart-palettes';
export * from './chart-frame';
export * from './chart-types';
export * from './chart-text';
export * from './chart-marks';
export * from './chart-axis';
export * from './chart-values';
// Per-participant responses (docs/specs/012-collaboration/participant-responses.md) + the collaboration element family
// (docs/specs/012-collaboration/estimate-card.md to docs/specs/009-elements/retired-elements.md). Both leaf modules, for the factories cycle.
export * from './responses';
export * from './collab-shapes';
export * from './agenda-current';
// Quiz (docs/specs/012-collaboration/quiz.md). A leaf module, for the same cycle.
export * from './quiz';
export * from './shape-geometry';
// Retired elements (docs/specs/009-elements/retired-elements.md): the kinds that moved to livehuddle, kept as stored.
export * from './retired-elements';
export * from './retired-placeholder';
export * from './actor-figure';
export * from '@liveworkspace/model-core/color-wash';
export { labelOn } from './readable-colour';
export * from './quick-swatches';
export * from './quick-swatch-rederive';
// The Q&A board (docs/specs/012-collaboration/qa-board.md)
export * from './qa-board';
export * from './web-components';
// The Behaviours family (docs/specs/010-palette/palette-top-level-categories.md): which kinds are in it, and which of them
// draw their own `…` rather than taking the shared settings one.
export * from './behaviour-shapes';
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
export * from '@liveworkspace/model-core/person-card';

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
export * from './stroke-loop-fill';
export * from '@liveworkspace/model-core/stroke-points';
export * from './stroke-fit';
export * from '@liveworkspace/model-core/stroke-points-cache';
export * from './freehand-points';
export * from '@liveworkspace/model-core/stroke-points-debug';
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

// Deterministic auto-layout for AI-generated diagrams (docs/specs/015-api/mcp-server.md).
export * from './auto-layout';
// The editor's Tidy Up profile (docs/specs/008-canvas/layout-cleanup.md): whether a style suits a tab.
export { tidyLayoutElements, tidyMindmapFits } from './auto-layout-tidy';

// Cluster-aware graph layout (docs/specs/020-import-export/mermaid.md): Mermaid subgraphs as frames.
export * from './auto-layout-clusters';
export { frameHeadingRect } from './auto-layout-cluster-seats';
// The layout engine's gaps, which edit operations place and make room by.
export { LAYER_GAP, SIBLING_GAP } from './auto-layout-shared';

// Authoring input shared by the MCP, the api and the CLI (docs/specs/015-api/mcp-server.md §4.7,
// §4.7a): raw elements made safe, graph input capped and laid out, and finished tabs built.
export * from './element-normalise';
export * from './graph-input';
export { KINK_RUN, arrowEndKey } from './graph-notches';
export * from './graph-limits';
export * from './tab-builders';

// Shared by the editor's text export + import and reusable by the api / MCP.

// Headless SVG renderer (docs/specs/015-api/mcp-server.md §5): per-element drawers + renderElementsToSvg,
// shared by the in-app export and the MCP worker's inline image render.
export * from './svg-render';
export { borderOf } from './svg-render-border';
export {
  isSequenceDiagram,
  parseSequenceDiagram,
  SEQUENCE_MAX_ITEMS,
  SEQUENCE_MAX_PARTICIPANTS,
  type SequenceDiagram,
} from './mermaid-sequence';
export { ELEMENT_FIELD_VALUES, fieldValueIssue } from './element-field-values';
export { buildMindTemplate, MIND_HUES, type MindHue, type MindSpec } from './mind-template';
export { inlineIconGap, inlineIconMetrics } from './svg-render-inline-icon';
export { SKETCH_ART_FILTER_ID, SKETCH_FACE_FILTER, svgSketchArtFilter } from './svg-render-sketch';
export * from './svg-render-table';
export * from './table-fit';
// The SVG face kit's marks (text, line fitting, colour mixing), for drawings made outside this package.
export {
  fitLine as svgFitLine,
  mixHex,
  text as svgText,
  wrapLines as svgWrapLines,
} from './svg-render-face-kit';

// Theme engine (docs/specs/011-theme/multicolour-themes.md, /42, /44, /48): theme catalogue + types + the pure
// recolour / switch / reset / preset transforms, shared by the editor and the
// MCP worker (docs/specs/015-api/mcp-server.md). The viewer-appearance wrappers stay in apps/editor/lib/themes.ts.
export * from './theme-graph';
export * from './themes';
export * from './theme-halves';
export * from './label-backdrop';
// A tab as one appearance sees it, for exports and the Explorer's previews.
export * from './tab-as-seen';
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
export * from './arrow-free-ends';
export * from './arrow-endpoint-spread';
export * from './arrow-orthogonal';
export * from './arrow-reciprocal';
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
export * from './legacy-groups';
export * from './legacy-docks';
export * from './legacy-stroke-points';
export * from './stored-elements';
export { isSafeColourValue } from '@liveworkspace/element-model/unsafe-colours';
export * from './stored-tab';
export { settleTabFields } from './tab-fields';
export { retiredSchemeOf, migrateRetiredScheme } from './retired-schemes';
// The retired themes' upgrade on its own, for the migration's stored-tab upgrade without the Pages and Plan drops
// (apps/api/src/migration/upgrade-tab.ts).
export { dropCustomTheme, isRetiredCustomThemeId } from './retired-custom-themes';
export { dropRetiredPages, isRetiredPagesElement } from './retired-pages';
export { dropRetiredPlan, isRetiredPlanElement } from './retired-plan';

// Photoshop-style layers (docs/specs/006-document/layers.md): the Layer type used by the Tab field
// above, band-aware render ordering, and the pure layer operations.
export * from './layers';
export * from './layer-operations';

// Element-level realtime ops (docs/specs/012-collaboration/realtime-conflict-resolution.md): the ElementOp type + the pure
// diff/apply functions the realtime room uses to merge concurrent edits.
export * from './element-ops';
export * from './participant-content';
export * from '@liveworkspace/model-core/adder';
export * from './element-fingerprint';

// Per-element deltas for the fields many participants write at once
// (docs/specs/012-collaboration/collab-race-hardening.md): answers, ideas, checklist ticks, comments.
export * from './element-deltas';

// The room's record of those deltas, merged into each save so D1 keeps what
// the room saw (docs/specs/012-collaboration/collab-race-hardening.md phase 3).
export * from './collab-ledger';
export * from './whole-tab-lock';

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
export {
  recogniseShape,
  type RecognisedShape,
  type RecognisedShapeKind,
} from '@liveworkspace/model-core/recognise-shape';

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
export * from './lane-seam-snapping';
// Refs, slug ids, kind words, derived containment and the style keys (docs/specs/024-agents/document-views.md):
// how views, edit operations and the lint name and place elements alike.
export * from './element-refs';
export * from './containment';
export * from '@liveworkspace/model-core/style-keys';
export * from '@liveworkspace/model-core/tab-names';
export { agendaFitHeight } from './svg-render-agenda';
export * from './session-button-text';
export { lineChars } from './svg-render-web';
export * from './drawn-count';
// The a / an rule for copy built around a name, shared with every package above this one.
export { indefiniteArticle, withArticle } from '@liveworkspace/model-core/indefinite-article';
// Slug ids (element refs, and anything else that mints a readable id from a name).
export { cutSlug, slugText, uniqueSlug } from './slug';
// A day in milliseconds, for day arithmetic.
export * from './civil-dates';
// SHA-256 in every runtime, secure context or not.
export { sha256, sha256Fallback } from './sha256';
