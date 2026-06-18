// Boxed-element type definitions (shape / text / table / sticky / image /
// freehand / annotation / link-card), split out of index.ts to keep it under
// the ~1000-line budget. Pure types; re-exported through index.ts so the
// public `@livediagram/diagram` surface is unchanged. ElementLink + the enums
// stay in index.ts and are imported here (type-only, so no runtime cycle).
import type { TextRun } from './rich-text';
import type { CommentThread } from './comments';
import type { BorderStroke, BorderStyle, BorderRadius } from './border-style';
import type {
  AnimationSpeed,
  ElementAnimation,
  ElementId,
  ElementLink,
  IconAnimation,
  Padding,
  ProgressAnim,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextSize,
} from './index';

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
  // Looping animation for an `icon` shape's glyph (spec/09 "Animated icons").
  // Independent of the boxed-element `animation` field above: icons get their
  // own motion set (the icon context menu swaps in IconAnimationTiles), since
  // a spinning gear / beating heart wants glyph-level motion, not the
  // wrapper ring / glow a shape uses. Undefined = static. Applied as a
  // `lvd-icon-*` CSS class on the glyph by IconGlyph / IconPrims.
  iconAnimation?: IconAnimation;
  // Where the inline icon sits relative to the shape's text label (only
  // meaningful on a non-'icon' shape carrying an `iconId`). Defaults to
  // 'left' when unset. Chosen by which side of the shape the icon was
  // dropped on.
  iconPosition?: 'left' | 'right' | 'above' | 'below';
  // Progress elements (spec/46), only meaningful when `shape` is
  // 'progress-bar' / 'progress-ring'. `progress` is the filled percentage
  // (0–100, defaults to 50); `progressAnim` animates how the fill behaves.
  // Edited from the element's context menu.
  progress?: number;
  progressAnim?: ProgressAnim;
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
  // How the bitmap fills its box. Defaults to 'contain' (the whole image
  // shows, letterboxed) which suits screenshots / diagrams. 'cover' fills the
  // box (cropping) — used by the hero + avatar composites (spec/09) so a
  // photo fills the area / circle rather than letterboxing.
  objectFit?: 'cover' | 'contain';
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
  // Looping CSS animation (spec/09 "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'normal'.
  animationSpeed?: AnimationSpeed;
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
