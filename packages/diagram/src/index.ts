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
import type { TextRun } from './rich-text';

// Arrow appearance preset types used by ArrowElement's fields below. The
// constants + accessors that go with them live in arrow-style.ts; type-only
// import so the index <-> arrow-style relationship stays erasable, and the
// whole module is re-exported lower down via `export * from './arrow-style'`.
import type { ArrowheadSize, ArrowheadShape, ArrowStyle } from './arrow-style';

// Border preset types used by the boxed-element + arrow field definitions
// below. The px / dasharray maps + defaults that go with them live in
// border-style.ts; type-only import (erasable), and the whole module is
// re-exported lower down via `export * from './border-style'`.
import type { BorderStroke, BorderStyle, BorderRadius } from './border-style';

// Comment-thread type used by the boxed-element `commentThread` fields below.
// The Comment shape + createComment / activeCommentCount helpers live in
// comments.ts; type-only import (erasable), and the whole module is re-exported
// lower down via `export * from './comments'`.
import type { CommentThread } from './comments';

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
  | 'checkerboard';

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
  // Curated single-colour glyph from the icon catalogue. Which glyph
  // is carried by `iconId` (a registry key resolved in the live app's
  // icon catalogue, NOT a closed enum here, so adding icons is a
  // one-file change with no model migration). Tinted by `strokeColor`
  // like a line drawing; keeps aspect ratio when resized. See spec/09
  // "Icons" accordion.
  | 'icon';

export type ShapeElement = {
  id: ElementId;
  type: 'shape';
  shape: ShapeKind;
  // Registry key for the glyph (e.g. 'server', 'database', 'user'). Two
  // uses: when `shape === 'icon'` it IS the element (glyph above an
  // optional caption); on any OTHER shape kind it's an inline icon shown
  // beside the shape's text label (drag an icon onto a shape, or add one
  // while a shape is selected). The valid keys + their SVG live in the
  // live app's icon catalogue; an unknown key falls back to a placeholder
  // glyph so a diagram authored against a newer catalogue still renders.
  iconId?: string;
  // Where the inline icon sits relative to the shape's text label (only
  // meaningful on a non-'icon' shape carrying an `iconId`). Defaults to
  // 'left' when unset. Chosen by which side of the shape the icon was
  // dropped on.
  iconPosition?: 'left' | 'right' | 'above' | 'below';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // diagrams round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see apps/live/lib/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved diagrams round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // When set, theme transforms (recolour / switch / reset) leave this
  // shape's `fillColor` alone, so an intrinsic fill survives a theme
  // change the way a sticky note keeps its amber. Used by template
  // scaffolds whose fills carry meaning that a single theme element-fill
  // would erase — e.g. the Gantt chart's per-milestone bar colours,
  // which must stay distinct so the timeline reads as separate tasks.
  // Stroke + text still theme normally.
  themeLockFill?: boolean;
  // Border styling (shapes + stickies). Each is a preset bucket so
  // saved diagrams round-trip without carrying arbitrary numeric
  // values; the renderer maps to pixel widths / SVG dasharrays /
  // border-radius pixels (BORDER_STROKE_PX, BORDER_DASH_ARRAY,
  // BORDER_RADIUS_PX further down).
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See specs/09 "Rotation".
  rotation?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Optional plain-text note. Distinct from `commentThread`: one
  // note per element, no author / timestamp / multi-message
  // structure, just a multi-line paragraph the user can leave on
  // any shape / text / sticky to capture private context. Empty
  // string strips the field on commit (see `setNote` in
  // editor-page.tsx) so persisted JSON stays clean.
  note?: string;
  padding?: Padding;
  // Per-range label formatting (spec/09): runs storing only the deltas
  // over the whole-element text* fields above. Absent, empty, or a single
  // override-free run => the legacy whole-element render. `label` is
  // always kept === runsPlainText(richText). See rich-text.ts.
  richText?: TextRun[];
};

// --- Text ------------------------------------------------------------------

export type TextElement = {
  id: ElementId;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // diagrams round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see apps/live/lib/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved diagrams round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See specs/09 "Rotation".
  rotation?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Optional plain-text note. Distinct from `commentThread`: one
  // note per element, no author / timestamp / multi-message
  // structure, just a multi-line paragraph the user can leave on
  // any shape / text / sticky to capture private context. Empty
  // string strips the field on commit (see `setNote` in
  // editor-page.tsx) so persisted JSON stays clean.
  note?: string;
  padding?: Padding;
  // Per-range label formatting (spec/09); see ShapeElement.richText.
  richText?: TextRun[];
};

// --- Tables ----------------------------------------------------------------

// An editable grid. `cells` is row-major (`cells[r][c]`) and is the
// source of truth for the grid size: `cells.length` rows, each row the
// same length = the column count (helpers keep it rectangular). A
// double-click on a cell edits its text in place. The whole table
// resizes via the normal element handles (cells share the space
// evenly); per-column / per-row sizing can come later. The first row
// is rendered as a header when `headerRow` is set.
export type TableCellStyle = {
  // Per-cell overrides of the table's text styling (each falls back
  // to the table default when unset).
  bg?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textSize?: TextSize;
  alignX?: TextAlignX;
  // Optional per-cell link (tab / diagram / element / external URL).
  // Lives on the cell style so it rides the same parallel `cellStyles`
  // grid the table helpers already splice on row / column edits, staying
  // aligned with no extra bookkeeping (spec/09).
  link?: ElementLink;
};

export type TableElement = {
  id: ElementId;
  type: 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  // Row-major cell text. Always rectangular (every row same length).
  cells: string[][];
  // Render the first row as a header (tinted band + bold text).
  headerRow?: boolean;
  // Render the first column as a header (same treatment). Combinable
  // with headerRow (the corner cell is then both).
  headerColumn?: boolean;
  // Alternating body-row background tint (a 'zebra' table).
  zebra?: boolean;
  // Per-cell style overrides, row-major + aligned with `cells`
  // (null = inherit the table defaults). Splices alongside cells
  // when rows / columns are added or removed.
  cellStyles?: (TableCellStyle | null)[][];
  // Header-band colours, independent of the body cells. Unset =
  // a tint of the grid stroke (fill) + the cell text colour (text).
  headerFill?: string;
  headerTextColor?: string;
  // Per-column width override in element-space px. An entry of
  // null / undefined (or a short array) means "auto": that column
  // shares the remaining width as a 1fr track. Lets some columns
  // be pinned while the rest fill the space.
  colWidths?: (number | null)[];
  // Per-row height override in element-space px (null / undefined =
  // auto: shares the remaining height as a 1fr track).
  rowHeights?: (number | null)[];
  // Tables have no single label (cells carry the text). Declared as an
  // always-undefined optional so the generic "boxed element has a
  // label" code paths (change log, export, search) compile without a
  // per-type guard, mirroring ImageElement.
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  // Text controls apply to every cell uniformly (a table is one styled
  // grid, not per-cell formatting — that can come later).
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see apps/live/lib/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved diagrams round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  // fillColor tints the cell background; strokeColor draws the grid
  // lines + border; textColor is the cell text.
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  rotation?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  note?: string;
  padding?: Padding;
};

// --- Sticky notes ----------------------------------------------------------

export type StickyElement = {
  id: ElementId;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // diagrams round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see apps/live/lib/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved diagrams round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See specs/09 "Rotation".
  rotation?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Optional plain-text note. Distinct from `commentThread`: one
  // note per element, no author / timestamp / multi-message
  // structure, just a multi-line paragraph the user can leave on
  // any shape / text / sticky to capture private context. Empty
  // string strips the field on commit (see `setNote` in
  // editor-page.tsx) so persisted JSON stays clean.
  note?: string;
  padding?: Padding;
  // Per-range label formatting (spec/09); see ShapeElement.richText.
  richText?: TextRun[];
};

// --- Images ---------------------------------------------------------------

// See specs/19-images.md. A boxed element that renders user-uploaded
// image bytes inside its bounding box. The bytes themselves live in
// R2 (server-side); the element carries only the opaque id the API
// resolves to a `GET /api/images/<id>` URL, so the diagram payload
// stays small + a future "delete from gallery" can break the
// reference without rewriting every diagram.
export type ImageElement = {
  id: ElementId;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  // R2 object key for the uploaded bytes. Null when the user has
  // dropped a placeholder but not yet picked an image: the canvas
  // renders the dashed empty-state thumbnail in that case.
  imageId: string | null;
  // Captured at upload from the file's natural dimensions. Drives
  // the aspect-lock default + the "Reset to natural size" context-
  // menu action; the element's own width/height drive layout.
  naturalWidth?: number;
  naturalHeight?: number;
  // Optional alt text (accessibility + future export-to-markdown).
  // Aliases as the element's `label` so the surrounding "boxed
  // element has a label" code paths (change log, Markdown export,
  // search index) all see the alt text without needing an
  // ImageElement-specific branch.
  alt?: string;
  // Shared boxed-element fields. ImageElement doesn't render text
  // or borders inside the image (the bitmap fills the box), but the
  // shape / sticky / text variants do, and a wide swath of code
  // (change log, format painter, Markdown / canvas export, Editor
  // panel state plumbing in Canvas.tsx) reads these fields off
  // every BoxedElement. Declaring them here as always-undefined
  // optionals keeps the TS union ergonomic without forcing every
  // call site to gate on `el.type !== 'image'`. Setting them on an
  // image is a no-op visually (the renderer ignores them).
  label?: string;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see apps/live/lib/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved diagrams round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  textColor?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  padding?: Padding;
  locked?: boolean;
  groupId?: ElementId;
  aspectLocked?: boolean;
  opacity?: number;
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See specs/09 "Rotation".
  rotation?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  note?: string;
};

// Freehand "pencil tool" element (spec/09 Pencil (freehand)
// subsection). A polyline sampled during a pointer drag, simplified
// + smoothed at commit, rendered as an inline SVG path inside the
// element's bounding box. Points are stored normalised into [0..1]
// across the box so resize scales the path proportionally;
// `closed: true` adds the closing segment + a theme fill (the
// "sketch a custom shape" path) when the user released near where
// they started.
export type FreehandElement = {
  id: ElementId;
  type: 'freehand';
  x: number;
  y: number;
  width: number;
  height: number;
  // Smoothed, normalised polyline. Each point is { nx, ny } in
  // [0, 1] relative to the bounding box's top-left. Two values per
  // sample (not flat-array form) so JSON shape is debuggable.
  points: { nx: number; ny: number }[];
  // True when the path auto-closes (release-near-start). The
  // renderer adds `Z` + a fill; open paths render stroke-only.
  closed: boolean;
  // Shared boxed-element fields, see ImageElement above for the
  // rationale: the union code paths (change log, format painter,
  // export, Editor panel) all read these uniformly. Labels render
  // on top of the SVG path (BoxedElementView), fill / stroke /
  // border-width / border-style follow the Colours + Border
  // accordions, and the rest of the bag (lock, group, opacity,
  // link, comment, note) flows through the generic boxed-element
  // machinery; persisting the fields keeps copy / paste /
  // format-paint symmetrical with the other boxed kinds.
  label?: string;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see apps/live/lib/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved diagrams round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  textColor?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  padding?: Padding;
  locked?: boolean;
  groupId?: ElementId;
  aspectLocked?: boolean;
  opacity?: number;
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See specs/09 "Rotation".
  rotation?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  note?: string;
};

// --- Annotations -----------------------------------------------------------

// See specs/38-annotations.md. A fixed-size themed circle holding a note
// glyph: hover it to read its `note` floating above the canvas, click it to
// edit the note. It is a boxed element so it flows through every generic
// path (selection, drag, layering, lock, group, link, colours, comments,
// the note feature), but it does NOT resize (no handles) — it stays a tidy
// marker. There is no inline label; the content lives entirely in `note`.
// The shared boxed fields are declared (mostly always-undefined here) so the
// union code paths compile without per-type guards, mirroring ImageElement.
export type AnnotationElement = {
  id: ElementId;
  type: 'annotation';
  x: number;
  y: number;
  width: number;
  height: number;
  // The note this marker carries. Edited via NotePopover / useEditorNotes,
  // previewed on hover. Empty string strips the field on commit.
  note?: string;
  // fillColor tints the circle; strokeColor draws the ring + the note glyph.
  // textColor is unused (no inline label) but declared for the generic
  // colour code paths.
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // An annotation has no editable label; declared always-undefined so the
  // generic "boxed element has a label" paths compile (mirrors Table/Image).
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  commentThread?: CommentThread;
  // Shared boxed-element fields that the generic union code paths (format
  // painter, geometry, search) read uniformly. An annotation doesn't expose
  // UI for these — it's a fixed, non-rotating marker with no inline text —
  // so they stay undefined in practice; declared for parity the same way
  // ImageElement / TableElement declare their always-undefined text fields.
  rotation?: number;
  aspectLocked?: boolean;
  padding?: Padding;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  font?: string;
};

// --- Link cards ------------------------------------------------------------

// See specs/40-link-cards.md. A rectangular bookmark element: the user sets
// its URL via the normal element-link UI (`link` with `{ kind: 'url' }`),
// and the editor fetches a preview (title / site / favicon / image) through
// the api worker's `/api/unfurl` endpoint and caches it in `meta`. The
// metadata rides the normal tab sync, so peers + reloads get it for free.
// Resizable like a shape; carries the shared boxed fields (mostly
// always-undefined, mirroring AnnotationElement) for the generic code paths.
export type LinkCardMeta = {
  // The URL this metadata was fetched for — guards against showing stale
  // preview after the link changes.
  url: string;
  title?: string;
  siteName?: string;
  image?: string; // og:image URL (referenced directly, not stored)
  favicon?: string; // resolved favicon URL
  description?: string;
};

export type LinkCardElement = {
  id: ElementId;
  type: 'link-card';
  x: number;
  y: number;
  width: number;
  height: number;
  // Cached unfurl preview for `link` (a url-kind ElementLink). Absent until
  // a URL is set + fetched; the card shows the bare URL meanwhile.
  meta?: LinkCardMeta;
  // fillColor = card background; strokeColor = card border; textColor = the
  // title/site text.
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // The URL source + everyday boxed fields.
  link?: ElementLink;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  opacity?: number;
  rotation?: number;
  aspectLocked?: boolean;
  commentThread?: CommentThread;
  note?: string;
  // Declared for the generic union code paths (format painter, geometry,
  // search), unused by the card UI — mirrors AnnotationElement.
  padding?: Padding;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  font?: string;
};

// --- Arrows ----------------------------------------------------------------

export type Anchor = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const ALL_ANCHORS: Anchor[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export type Endpoint =
  | { kind: 'free'; x: number; y: number }
  // `manual` marks an anchor the user set by hand (dragging the endpoint
  // onto that face). The auto-rebind that re-chooses faces as boxes move
  // (`rebindArrowAnchorsAfterMove`) leaves a manual endpoint fixed, so a
  // deliberate correction sticks. Absent === auto-managed (the default).
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor; manual?: boolean };

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

// --- Re-exported resource modules -----------------------------------------
export * from './arrow-path';
export * from './arrow-style';
export * from './border-style';
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
