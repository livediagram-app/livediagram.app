// Boxed-element type definitions (shape / text / table / sticky / image /
// freehand / annotation / link-card), split out of index.ts to keep it under
// the ~1000-line budget. Pure types; re-exported through index.ts so the
// public `@livepages/document` surface is unchanged. ElementLink + the enums
// stay in index.ts and are imported here (type-only, so no runtime cycle).
import type { Finish } from './finish';
import type { TextRun } from './rich-text';
import type { CommentThread } from './comments';
import type { ElementAction } from './element-action';
import type { BorderStroke, BorderStyle, BorderRadius } from './border-style';
import type { ElementShadow } from './shadow';
import type { ShapeMarker } from './shape-marker';
import type { AccentEdge } from './accent-edge';
import type { CardMedia } from './card';
import type { ChipLook } from './chip';
import type { AttachPoint } from './attachment';
import type { ConceptAnim, ConceptRow, PyramidVariant } from './concept';
import type { PenColourName } from './pen-colours';
import type { QuickSwatchSlot } from './quick-swatches';
import type { CodeThemeId } from './code-themes';
import type { ChartPaletteId } from './chart-palettes';
import type { ChartVariant } from './chart-types';
import type {
  SankeyAlign,
  SankeyLeftover,
  SankeyAnim,
  SankeyFlow,
  SankeyLinkColor,
  SankeyNodeStyle,
  SankeyValueLabel,
} from './sankey-model';
import type { IconSize } from './icon-size';
import type { IconWeight } from './icon-weight';
import type { EmbedProvider } from './youtube';
import type { HeroCaption, StatItem } from './web-components';
import type { ImageCredit } from './image-credit';
import type {
  AnimationSpeed,
  ChecklistItem,
  LegendItem,
  CodeLanguage,
  ElementAnimation,
  TextAnimation,
  ElementId,
  ElementLink,
  IconAnimation,
  IconPosition,
  LineSeries,
  Padding,
  PieAnim,
  PieSlice,
  ProgressAnim,
  RatingAnim,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextSize,
  TextSizePreset,
} from './index';
import type { StackAlign, StackDirection } from './stack';

// Where a chart's legend sits relative to the plot (docs/specs/009-elements/pie-chart.md). 'off' is modelled
// separately by `chartLegend: false`, so this only covers the four placements.
export type ChartLegendPosition = 'top' | 'right' | 'bottom' | 'left';

export type ShapeElement = {
  id: ElementId;
  type: 'shape';
  // Layer membership (docs/specs/006-document/layers.md): id of the Tab.layers entry this element
  // renders inside. Absent / unknown = the tab's default layer, so every
  // element authored before layers existed keeps rendering unchanged.
  // Carried by every element variant (arrows included, see index.ts).
  layerId?: string;
  shape: ShapeKind;
  // Registry key for the glyph (e.g. 'server', 'database', 'user'). Two
  // uses: when `shape === 'icon'` it IS the element (glyph above an
  // optional caption); on any OTHER shape kind it's an inline icon shown
  // beside the shape's text label (drag an icon onto a shape, or add one
  // while a shape is selected). The valid keys + their SVG live in the
  // live app's icon catalogue; an unknown key falls back to a placeholder
  // glyph so a document authored against a newer catalogue still renders.
  iconId?: string;
  // Registry key for a `sticker` shape's art (docs/specs/010-palette/stickers.md) — e.g.
  // 'emoji-thumbs-up', 'badge-blocked'. Only meaningful when
  // `shape === 'sticker'`; the entry resolves in the sticker catalogue
  // (@livepages/icons), and an unknown key renders nothing rather than
  // guessing, so a document authored against a newer catalogue still opens.
  //
  // Kept separate from `iconId` on purpose: an element that predates
  // docs/specs/010-palette/stickers.md carries an emoji as an `iconId` on an `icon` shape and must
  // keep rendering as one. See `isLegacyEmojiIconId`.
  stickerId?: string;
  // Looping animation for an `icon` shape's glyph (docs/specs/008-canvas/canvas-and-palette.md "Animated icons").
  // Independent of the boxed-element `animation` field above: icons get their
  // own motion set (the icon context menu swaps in IconAnimationTiles), since
  // a spinning gear / beating heart wants glyph-level motion, not the
  // wrapper ring / glow a shape uses. Undefined = static. Applied as a
  // `lvd-icon-*` CSS class on the glyph by IconGlyph / IconPrims.
  iconAnimation?: IconAnimation;
  // Loop speed for `iconAnimation`, mirroring the boxed-element `animationSpeed`
  // (a duration multiplier fed to the `lvd-icon-*` keyframes via
  // `--lvd-icon-anim-speed`). Undefined = the shared default ('slow').
  iconAnimationSpeed?: AnimationSpeed;
  // Whether `iconAnimation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  iconAnimationRepeat?: boolean;
  // Fixed render size for a Technology (brand) icon's tile (docs/specs/010-palette/technology-icons.md):
  // the mark draws at ICON_SIZE_PX[iconSize] regardless of the element's
  // box, so resizing the element never inflates the chip. Undefined = the
  // default preset ('md'). Ignored by line-art icons, which keep scaling
  // with their box.
  iconSize?: IconSize;
  // Line weight of a line-art icon glyph (docs/specs/004-interface-design/iconography.md): thin / regular /
  // bold on-screen stroke. Undefined = regular. Ignored by Technology marks, which are filled tiles.
  iconWeight?: IconWeight;
  // Where the inline icon sits relative to the shape's text label (only
  // meaningful on a non-'icon' shape carrying an `iconId`). Defaults to
  // 'left' when unset. Chosen by which side of the shape the icon was
  // dropped on.
  iconPosition?: IconPosition;
  // Progress elements (docs/specs/009-elements/progress.md), only meaningful when `shape` is
  // 'progress-bar' / 'progress-ring'. `progress` is the filled percentage
  // (0–100, defaults to 50); `progressAnim` animates how the fill behaves.
  // Edited from the element's context menu.
  progress?: number;
  progressAnim?: ProgressAnim;
  // Loop speed for `progressAnim` (slow / normal / fast), same multiplier as
  // boxed-element animations. Undefined = normal.
  progressAnimSpeed?: AnimationSpeed;
  // Whether the animation repeats. `fill` defaults to playing ONCE and holding
  // the filled state (so a dropped progress bar fills in and stays done, not a
  // perpetual loop); `pulse` / `stripes` are continuous and default to looping.
  // The context-menu toggle overrides this per element.
  progressAnimRepeat?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // documents round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see packages/document/src/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved documents round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  // Drawing style (docs/specs/008-canvas/finish.md); unset follows the tab's.
  finish?: Finish;
  fillColor?: string;
  strokeColor?: string;
  // A stock colour by name (docs/specs/008-canvas/canvas-and-palette.md "Colours"):
  // drawn in the version tuned for the viewer's canvas (penColourHex) when `strokeColor` is unset.
  penColour?: PenColourName;
  textColor?: string;
  // A stock colour for the label's text (docs/specs/008-canvas/canvas-and-palette.md "Colours"):
  // drawn in the version tuned for the viewer's canvas when `textColor` is unset.
  penTextColour?: PenColourName;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md). Unset falls back to
  // a tint of the grid stroke, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: wanting a
  // coloured heading over a plain body is the normal case, not an exotic one.
  headerFill?: string;
  // When set, theme transforms (recolour / switch / reset) leave this
  // shape's `fillColor` alone, so an intrinsic fill survives a theme
  // change the way a sticky note keeps its amber. Used by template
  // scaffolds whose fills carry meaning that a single theme element-fill
  // would erase — e.g. the Gantt chart's per-milestone bar colours,
  // which must stay distinct so the timeline reads as separate tasks.
  // Stroke + text still theme normally.
  themeLockFill?: boolean;
  // The element is one size for life: no resize handles, union-scales move
  // it without scaling it, and the menu's Size category stays away. The fixed-size SHAPE kinds
  // (the badge, docs/specs/009-elements/badge.md) get the same treatment from their kind. See
  // isFixedSizeElement.
  fixedSize?: boolean;
  // Border styling (shapes + stickies). Each is a preset bucket so
  // saved documents round-trip without carrying arbitrary numeric
  // values; the renderer maps to pixel widths / SVG dasharrays /
  // border-radius pixels (BORDER_STROKE_PX, BORDER_DASH_ARRAY,
  // BORDER_RADIUS_PX further down).
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  // A coloured bar along one edge of a box shape (docs/specs/008-canvas/accent-edge.md); absent = none. Only
  // the kinds in ACCENT_EDGE_SHAPES draw it. Its colour is its own, else the border's as drawn.
  accentEdge?: AccentEdge;
  accentEdgeColor?: string;
  // Colour-preset binding (docs/specs/010-palette/style-presets.md). When a one-click colour preset is applied
  // to a shape, we store the preset's stable id (e.g. 'bold', 'soft',
  // 'branch-0') alongside the concrete fill / stroke / text it wrote. This lets
  // a later theme change RE-DERIVE the preset for the new theme (the Bold look
  // of theme B instead of staying pinned to theme A's Bold colours) rather than
  // treating the preset colours as an immovable manual override. Cleared the
  // moment the user hand-edits a colour or resets to theme, since the binding
  // no longer holds. Only meaningful on shapes.
  colorPreset?: string;
  // Quick-swatch bindings (docs/specs/008-canvas/quick-style-panel.md): the slot (1-6) a stroke or
  // background colour was picked from in the quick style panel, stored beside
  // the concrete colour so a theme change re-derives it from the new theme's
  // same slot. Cleared the moment that colour is set any other way.
  strokeSwatch?: QuickSwatchSlot;
  fillSwatch?: QuickSwatchSlot;
  // Tab window (docs/specs/009-elements/tab-window.md): the id of the tab of this document it shows. Only meaningful
  // on the 'tab-window' kind. Absent until chosen; a tab that is gone (or not shared) shows as unavailable.
  windowTabId?: string;
  // A timeline rail saved before the Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"): its point count
  // and labels, read once to make its milestones (element-normalise railToTimeline) and never written again.
  railCount?: number;
  railLabels?: string[];
  // Rating (docs/specs/009-elements/rating.md): the score in filled stars (0..RATING_MAX) + its optional
  // animation. Only meaningful on the 'rating' kind.
  rating?: number;
  ratingAnim?: RatingAnim;
  ratingAnimSpeed?: AnimationSpeed;
  ratingAnimRepeat?: boolean;
  // Data charts (docs/specs/009-elements/pie-chart.md): the labelled data + its optional animation, shared
  // by the pie + bar chart kinds (the `pie*` names are kept for data
  // round-trip). `chartLegend` toggles the legend (default on).
  pieSlices?: PieSlice[];
  pieAnim?: PieAnim;
  pieAnimSpeed?: AnimationSpeed;
  pieAnimRepeat?: boolean;
  chartLegend?: boolean;
  // Show Values (docs/specs/009-elements/pie-chart.md): each mark's number printed on the chart. Absent = off.
  chartValues?: boolean;
  // Show Axis (docs/specs/009-elements/pie-chart.md): the value axis, its tick labels and gridlines. Absent = off.
  chartAxis?: boolean;
  // Legend placement (docs/specs/009-elements/pie-chart.md); ignored when `chartLegend` is false. Missing /
  // undefined === 'right', the historical default.
  chartLegendPosition?: ChartLegendPosition;
  // Chart type (docs/specs/009-elements/pie-chart.md "Chart types"): which of its kind's types a chart draws as
  // (bar-chart `horizontal`, line-chart `area` / `scatter`, pie-chart `doughnut`); absent, or one its kind does not
  // take, is the kind's first (Column, Line, Pie).
  chartVariant?: ChartVariant;
  // Line chart (docs/specs/009-elements/pie-chart.md): the shared x-axis categories + one or more named
  // series (CSV-importable). Only meaningful on the 'line-chart' kind.
  lineCategories?: string[];
  lineSeries?: LineSeries[];
  // Legend (docs/specs/009-elements/pie-chart.md): the colour-coded rows. Only meaningful on the 'legend'
  // kind; bounded in validate.ts.
  legendItems?: LegendItem[];
  // Sankey diagram (docs/specs/009-elements/sankey.md): the flows (by node name), the nodes somebody
  // recoloured, and how the diagram draws. Only meaningful on the 'sankey' kind; bounded in validate.ts.
  // Absent options read as their defaults: bands blended, end nodes to the right, amounts shown, no unit.
  sankeyFlows?: SankeyFlow[];
  sankeyNodes?: SankeyNodeStyle[];
  sankeyLinkColor?: SankeyLinkColor;
  sankeyAlign?: SankeyAlign;
  sankeyValueLabel?: SankeyValueLabel;
  sankeyUnit?: string;
  sankeyLeftover?: SankeyLeftover;
  sankeyLeftoverName?: string;
  sankeyAnim?: SankeyAnim;
  sankeyAnimSpeed?: AnimationSpeed;
  sankeyAnimRepeat?: boolean;
  // Chart palette (docs/specs/009-elements/pie-chart.md): which categorical ramp the slices / series take
  // when they carry no colour of their own. Only meaningful on the chart
  // kinds; absent = the tab theme's palette, as before.
  chartPalette?: ChartPaletteId;
  // Code block (docs/specs/009-elements/code-block.md): the snippet text + its highlight language. Only
  // meaningful on the 'code-block' kind; bounded in validate.ts.
  code?: string;
  codeLanguage?: CodeLanguage;
  // Which colour scheme the card paints in (see code-themes.ts). Absent =
  // 'midnight', the single look the block shipped with, so older documents are
  // untouched.
  codeTheme?: CodeThemeId;
  // Whether a line longer than the card wraps instead of running off it.
  // Absent = true: a snippet you cannot read the end of is not a snippet, and
  // the card is usually narrower than the code someone pastes into it. Set
  // false to keep long lines on one line (and off the card).
  codeWrap?: boolean;
  // Page masthead (docs/specs/009-elements/page-element.md): the fixed heading + subtitle above the body.
  // Meaningful on the 'page' kind, and reused by two web components
  // (docs/specs/009-elements/web-components-and-no-groups.md) for the same job — a single-line heading beside the
  // multi-line label: a banner's subtitle (`pageSubtitle`) and a callout's
  // heading (`pageTitle`). Bounded in validate.ts.
  //
  // Separate fields, not the first two lines of the body: a page's title is
  // structure, not prose. Keeping them apart means the body can be reordered,
  // reformatted or emptied without the heading moving or vanishing, and the
  // masthead can be styled as a masthead rather than as whatever the first
  // line of the rich text happens to be.
  //
  // Plain strings, not rich runs: a title has one look, set by the element.
  pageTitle?: string;
  pageSubtitle?: string;
  // Card slots (docs/specs/009-elements/card.md): media at the top left (absent = none), the header band (stored
  // only when on) and up to six tag chips along the bottom. Title and meta line are pageTitle / pageSubtitle.
  cardMedia?: CardMedia;
  cardHeader?: boolean;
  tags?: string[];
  // Badge and Step number (docs/specs/009-elements/badge.md): the look (absent = the kind's default), the host it is
  // attached to and the point it sits on (both or neither), and a step's Play in Order (stored only when true).
  chipLook?: ChipLook;
  attachedTo?: ElementId;
  attachAt?: AttachPoint;
  stepSequence?: boolean;
  // A pointer note's tip, relative to its top-left (docs/specs/009-elements/pointer-note.md).
  pointerTip?: { x: number; y: number };
  // A stack's arrangement (docs/specs/009-elements/stack.md); each absent = its default.
  stackDirection?: StackDirection;
  stackAlign?: StackAlign;
  stackGap?: number;
  stackPadding?: number;
  stackColumns?: number;
  // Concept graphics (docs/specs/009-elements/concept-graphics.md): the rows (a layer, tier or step each, with an
  // optional note), a pyramid's variant (absent = pyramid) and the Concept animation with its speed and repeat.
  conceptRows?: ConceptRow[];
  pyramidVariant?: PyramidVariant;
  conceptAnim?: ConceptAnim;
  conceptAnimSpeed?: AnimationSpeed;
  conceptAnimRepeat?: boolean;
  // A hub's spokes (docs/specs/009-elements/concept-graphics.md); absent = drawn, `false` = off.
  hubSpokes?: boolean;
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md), bounded in validate.ts: a stat row's KPI
  // cards, a process's step captions (one circle each, numbered by position)
  // and a header's nav links. Each only meaningful on its own kind.
  stats?: StatItem[];
  processSteps?: string[];
  navLinks?: string[];
  // Checklist (docs/specs/009-elements/checklist.md): the checkable rows. Only meaningful on the
  // 'checklist' kind; bounded in validate.ts.
  checklistItems?: ChecklistItem[];
  // Status marker (docs/specs/009-elements/shape-markers.md): a small glyph (traffic-light dot / checkbox) shown
  // just left of the label, or centred when the shape has no label. `markerSize`
  // is a TextSize preset where 'scale' tracks the element's text size (never a px: a marker is a dot).
  marker?: ShapeMarker;
  markerSize?: TextSizePreset;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  // Drop shadow (docs/specs/008-canvas/element-shadows.md). Absent = no shadow; see shadow.ts.
  shadow?: ElementShadow;
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See docs/specs/008-canvas/canvas-and-palette.md "Rotation".
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  // Text animation on the words this element carries (docs/specs/028-animation/element-animations.md).
  // Undefined = still words. Speed as for `animation`. Repeat is OFF by default (the words play once
  // and stay revealed): stored only when true.
  textAnimation?: TextAnimation;
  textAnimationSpeed?: AnimationSpeed;
  textAnimationRepeat?: boolean;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  // A list of actions, where an ordinary element holds one `action`. Nothing in the editor writes it
  // today. Read through elementActions.
  actions?: ElementAction[];
  // Optional note. Distinct from `commentThread`: one note per
  // element, no author / timestamp / multi-message structure, just a
  // small document the user can leave on any shape / text / sticky to
  // capture private context. Empty string strips the field on commit
  // (see `setNote` in useEditorNotes.ts) so persisted JSON stays clean.
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
  padding?: Padding;
  // Per-range label formatting (docs/specs/008-canvas/canvas-and-palette.md): runs storing only the deltas
  // over the whole-element text* fields above. Absent, empty, or a single
  // override-free run => the legacy whole-element render. `label` is
  // always kept === runsPlainText(richText). See rich-text.ts.
  richText?: TextRun[];
};

// --- Text ------------------------------------------------------------------

// How a text box sizes itself (TextElement.sizing): 'fit' to its words, or 'wrap' at a set width.
export type TextSizing = 'fit' | 'wrap';

export type TextElement = {
  id: ElementId;
  type: 'text';
  // Who added it, when a Participant did (docs/specs/013-workspace/share-roles.md "What a Participant changes"):
  // the server-derived adder key the room stamped. Absent on everything an Editor added. Never set by a client.
  addedBy?: string;
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // documents round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see packages/document/src/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved documents round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  // Drawing style (docs/specs/008-canvas/finish.md); unset follows the tab's.
  finish?: Finish;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // A stock colour for the text (docs/specs/008-canvas/canvas-and-palette.md "Colours"):
  // drawn in the version tuned for the viewer's canvas when `textColor` is unset.
  penTextColour?: PenColourName;
  // Quick-swatch binding (docs/specs/008-canvas/quick-style-panel.md): the slot (1-6) the text
  // colour was picked from in the quick style panel's Text colour row, so a
  // theme change re-derives it. Cleared the moment the colour is set any other way.
  textSwatch?: QuickSwatchSlot;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md). Unset falls back to
  // a tint of the grid stroke, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: wanting a
  // coloured heading over a plain body is the normal case, not an exotic one.
  headerFill?: string;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See docs/specs/008-canvas/canvas-and-palette.md "Rotation".
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  // Text animation on the words this element carries (docs/specs/028-animation/element-animations.md).
  // Undefined = still words. Speed as for `animation`. Repeat is OFF by default (the words play once
  // and stay revealed): stored only when true.
  textAnimation?: TextAnimation;
  textAnimationSpeed?: AnimationSpeed;
  textAnimationRepeat?: boolean;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  // Optional note. Distinct from `commentThread`: one note per
  // element, no author / timestamp / multi-message structure, just a
  // small document the user can leave on any shape / text / sticky to
  // capture private context. Empty string strips the field on commit
  // (see `setNote` in useEditorNotes.ts) so persisted JSON stays clean.
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
  padding?: Padding;
  // Per-range label formatting (docs/specs/008-canvas/canvas-and-palette.md); see ShapeElement.richText.
  richText?: TextRun[];
  // How the box sizes itself (docs/specs/006-document/document-structure.md "Data model"):
  // 'fit', the width follows the words up to the wrap width and the height hugs the lines; 'wrap',
  // the width is set and the height hugs the lines. Absent = a fixed box, its text wrapping inside
  // it. Honoured for everyone.
  sizing?: TextSizing;
  // Multiplier on the label size, set by a Shift resize of a text box
  // (docs/specs/006-document/document-structure.md "Data model"). Absent = 1.
  textScale?: number;
  // Wordmark type (docs/specs/007-editor/logo-pages.md "Wordmark type"), drawn wherever the text
  // is. Tracking: em added between letters, -0.2 to 1; absent is none.
  letterSpacing?: number;
  // The weight it paints in; wins over `textBold` while set. Absent follows `textBold`.
  fontWeight?: 400 | 500 | 700;
  // Shown in capitals or lower case; the label keeps what was typed. Absent is as typed.
  textCase?: 'upper' | 'lower';
  // Bends the text along a circle, -360 to 360 degrees: positive bows up, negative down. Absent is
  // flat. Arched text is one line.
  textArc?: number;
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
  // Optional per-cell link (tab / document / element / external URL).
  // Lives on the cell style so it rides the same parallel `cellStyles`
  // grid the table helpers already splice on row / column edits, staying
  // aligned with no extra bookkeeping (docs/specs/008-canvas/canvas-and-palette.md).
  link?: ElementLink;
};

export type TableElement = {
  id: ElementId;
  type: 'table';
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
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
  // The table look this was painted with (docs/specs/010-palette/style-presets.md), if any: the id of a
  // `tableColorPresets` entry. Stored for the same reason a shape stores
  // `colorPreset` — the colours below are resolved values, so without the id a
  // theme change cannot tell "the theme's Banded" from four hand-picked
  // colours, and the table strands on the old theme. Cleared the moment any of
  // those colours (or the banding) is set by hand.
  tablePreset?: string;
  // Per-cell style overrides, row-major + aligned with `cells`
  // (null = inherit the table defaults). Splices alongside cells
  // when rows / columns are added or removed.
  cellStyles?: (TableCellStyle | null)[][];
  // Header-band TEXT colour, independent of the body cells. Unset = the cell
  // text colour. (The band's FILL is the shared `headerFill` on the base
  // element.)
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
  // label" code paths (export, search) compile without a
  // per-type guard, mirroring ImageElement.
  label?: string;
  locked?: boolean;
  // Text controls apply to every cell uniformly (a table is one styled
  // grid, not per-cell formatting — that can come later).
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see packages/document/src/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved documents round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  // Drawing style (docs/specs/008-canvas/finish.md); unset follows the tab's.
  finish?: Finish;
  // fillColor tints the cell background; strokeColor draws the grid
  // lines + border; textColor is the cell text.
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md). Unset falls back to
  // a tint of the grid stroke, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: wanting a
  // coloured heading over a plain body is the normal case, not an exotic one.
  headerFill?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  // Text animation on the words this element carries (docs/specs/028-animation/element-animations.md).
  // Undefined = still words. Speed as for `animation`. Repeat is OFF by default (the words play once
  // and stay revealed): stored only when true.
  textAnimation?: TextAnimation;
  textAnimationSpeed?: AnimationSpeed;
  textAnimationRepeat?: boolean;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
  padding?: Padding;
};

// --- Sticky notes ----------------------------------------------------------

export type StickyElement = {
  id: ElementId;
  type: 'sticky';
  // Who added it, when a Participant did: see TextElement.addedBy.
  addedBy?: string;
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  // One size for life — see ShapeElement.fixedSize / isFixedSizeElement.
  fixedSize?: boolean;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // documents round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Font-family id (see packages/document/src/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved documents round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  // Drawing style (docs/specs/008-canvas/finish.md); unset follows the tab's.
  finish?: Finish;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // A stock colour for the note's text (docs/specs/008-canvas/canvas-and-palette.md "Colours"),
  // drawn in its canvas's version when `textColor` is unset.
  penTextColour?: PenColourName;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md). Unset falls back to
  // a tint of the grid stroke, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: wanting a
  // coloured heading over a plain body is the normal case, not an exotic one.
  headerFill?: string;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  // Drop shadow (docs/specs/008-canvas/element-shadows.md). Absent = no shadow; see shadow.ts.
  shadow?: ElementShadow;
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See docs/specs/008-canvas/canvas-and-palette.md "Rotation".
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  // Text animation on the words this element carries (docs/specs/028-animation/element-animations.md).
  // Undefined = still words. Speed as for `animation`. Repeat is OFF by default (the words play once
  // and stay revealed): stored only when true.
  textAnimation?: TextAnimation;
  textAnimationSpeed?: AnimationSpeed;
  textAnimationRepeat?: boolean;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  // Optional note. Distinct from `commentThread`: one note per
  // element, no author / timestamp / multi-message structure, just a
  // small document the user can leave on any shape / text / sticky to
  // capture private context. Empty string strips the field on commit
  // (see `setNote` in useEditorNotes.ts) so persisted JSON stays clean.
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
  padding?: Padding;
  // Per-range label formatting (docs/specs/008-canvas/canvas-and-palette.md); see ShapeElement.richText.
  richText?: TextRun[];
};

// --- Images ---------------------------------------------------------------

// See docs/specs/009-elements/images.md. A boxed element that renders user-uploaded
// image bytes inside its bounding box. The bytes themselves live in
// R2 (server-side); the element carries only the opaque id the API
// resolves to a `GET /api/images/<id>` URL, so the document payload
// stays small + a future "delete from gallery" can break the
// reference without rewriting every document.
export type ImageElement = {
  id: ElementId;
  type: 'image';
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
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
  // box (cropping) — used by the hero + avatar (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/web-components-and-no-groups.md) so a
  // photo fills the area / circle rather than letterboxing.
  objectFit?: 'cover' | 'contain';
  // Hero caption card (docs/specs/009-elements/web-components-and-no-groups.md): a themed card inset near the bottom of the
  // image carrying a title + a supporting line, in `fillColor` with
  // `textColor` (white by default). Present = shown; the palette's Hero is an
  // image created with one, and any image can gain or lose it from the menu.
  heroCaption?: HeroCaption;
  // Creator + licence credit of a picture picked from Image search
  // (docs/specs/009-elements/image-search.md). Absent for uploads.
  credit?: ImageCredit;
  // Optional alt text (accessibility + future export-to-markdown).
  // Aliases as the element's `label` so the surrounding "boxed
  // element has a label" code paths (Markdown export, search
  // index) all see the alt text without needing an
  // ImageElement-specific branch.
  alt?: string;
  // Shared boxed-element fields. ImageElement doesn't render text
  // or borders inside the image (the bitmap fills the box), but the
  // shape / sticky / text variants do, and a wide swath of code
  // (format painter, Markdown / canvas export, Editor
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
  // Font-family id (see packages/document/src/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved documents round-trip independent of the
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
  aspectLocked?: boolean;
  opacity?: number;
  // Drop shadow (docs/specs/008-canvas/element-shadows.md). Absent = no shadow; see shadow.ts.
  shadow?: ElementShadow;
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See docs/specs/008-canvas/canvas-and-palette.md "Rotation".
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
};

// Freehand "pencil tool" element (docs/specs/008-canvas/canvas-and-palette.md Pencil (freehand)
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
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * The stroke's points, normalised into its box, and a pen's pressure at each when it reported
   * one, packed into one block: base64 of a version byte, a flags byte and a little-endian record
   * per point (x u16, y u16, optional pressure u8). See docs/specs/006-document/stroke-points.md.
   * @format byte
   */
  packedPoints: string;
  // True when the path auto-closes (release-near-start). The
  // renderer adds `Z` + a fill; open paths render stroke-only.
  closed: boolean;
  // Highlighter strokes (docs/specs/008-canvas/highlighter.md): the renderers swap the border
  // presets for the marker recipe — a wide round stroke, translucent
  // multiply blend, never filled. The stroke colour stays
  // user-overridable; the recipe owns translucency.
  pen?: 'highlighter';
  // Marker stroke width in px (docs/specs/008-canvas/highlighter.md), chosen from the highlighter
  // banner's strength control at draw time. Absent = the default 14.
  penWidth?: number;
  // A pen stroke's perfect-freehand streamline (absent: a stroke stored before it was recorded,
  // drawn with none). Its pressures, when
  // the pen reported them, ride in `packedPoints`. A pen stroke's points are its raw samples.
  streamline?: number;
  // A stock colour by name (docs/specs/008-canvas/canvas-and-palette.md "Colours"):
  // drawn in the version tuned for the viewer's canvas (penColourHex) when `strokeColor` is unset.
  penColour?: PenColourName;
  // Polygon-tool paths (docs/specs/008-canvas/polygon-tool.md): the canvas renderer draws straight
  // M/L segments instead of Catmull-Rom smoothing, so deliberately
  // placed corners stay corners. Absent on pencil / highlighter
  // strokes (which want the smoothing).
  straightEdges?: boolean;
  // Shared boxed-element fields, see ImageElement above for the
  // rationale: the union code paths (format painter, export,
  // Editor panel) all read these uniformly. Labels render
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
  // Font-family id (see packages/document/src/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved documents round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  textColor?: string;
  fillColor?: string;
  // Keep this fill through a theme change (themeColourFields), as a shape may: a drawn scene's colours.
  themeLockFill?: boolean;
  strokeColor?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  padding?: Padding;
  locked?: boolean;
  aspectLocked?: boolean;
  opacity?: number;
  // Clockwise rotation in degrees about the element's centre. Absent
  // or 0 means unrotated. See docs/specs/008-canvas/canvas-and-palette.md "Rotation".
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  link?: ElementLink;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
};

// --- Annotations -----------------------------------------------------------

// See docs/specs/009-elements/annotations.md. A fixed-size themed circle holding a note
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
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // The note this marker carries. Edited via NotePopover / useEditorNotes,
  // previewed on hover. Empty string strips the field on commit.
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
  // A margin note of an article (docs/specs/007-editor/article-pages.md "Comments and actions"):
  // the marker in a page's margin beside the text its comment thread or action is on, kept beside
  // that text as the writing moves. Its glyph says which: a speech bubble, or a tick for an action.
  articleNote?: 'comment' | 'action';
  // fillColor tints the circle; strokeColor draws the ring + the note glyph.
  // textColor is unused (no inline label) but declared for the generic
  // colour code paths.
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md). Unset falls back to
  // a tint of the grid stroke, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: wanting a
  // coloured heading over a plain body is the normal case, not an exotic one.
  headerFill?: string;
  // An annotation has no editable label; declared always-undefined so the
  // generic "boxed element has a label" paths compile (mirrors Table/Image).
  label?: string;
  locked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  // Shared boxed-element fields that the generic union code paths (format
  // painter, geometry, search) read uniformly. An annotation doesn't expose
  // UI for these — it's a fixed, non-rotating marker with no inline text —
  // so they stay undefined in practice; declared for parity the same way
  // ImageElement / TableElement declare their always-undefined text fields.
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
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

// See docs/specs/009-elements/link-cards.md. A rectangular bookmark element: the user sets
// its URL via the normal element-link UI (`link` with `{ kind: 'url' }`),
// and the editor fetches a preview (title / site / favicon / image) through
// the api worker's `/api/unfurl` endpoint and caches it in `meta`. The
// metadata rides the normal tab sync, so peers + reloads get it for free.
// Resizable like a shape; carries the shared boxed fields (mostly
// always-undefined, mirroring AnnotationElement) for the generic code paths.
// Only the fields the card actually renders (title / image / favicon).
// The unfurl endpoint also returns siteName + description, but nothing
// draws them, so they aren't cached onto the element or persisted.
export type LinkCardMeta = {
  // The URL this metadata was fetched for — guards against showing stale
  // preview after the link changes.
  url: string;
  title?: string;
  image?: string; // og:image URL (referenced directly, not stored)
  favicon?: string; // resolved favicon URL
};

export type LinkCardElement = {
  id: ElementId;
  type: 'link-card';
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
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
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md). Unset falls back to
  // a tint of the grid stroke, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: wanting a
  // coloured heading over a plain body is the normal case, not an exotic one.
  headerFill?: string;
  // The URL source + everyday boxed fields.
  link?: ElementLink;
  label?: string;
  locked?: boolean;
  opacity?: number;
  // Drop shadow (docs/specs/008-canvas/element-shadows.md). Absent = no shadow; see shadow.ts.
  shadow?: ElementShadow;
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  aspectLocked?: boolean;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
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

// --- Video -----------------------------------------------------------------

// See docs/specs/009-elements/youtube-video.md. A 16:9 card showing a YouTube video's poster
// frame, which plays inline when pressed. Added through the same new-type
// surface as the link card above, and shares its URL-editing flow: the user
// sets the link with the normal element-link UI.
//
// Aspect-locked to 16:9 on resize (`aspectLocked` defaults true from
// createVideo) — a stretched video frame is never what anyone wants.
export type VideoElement = {
  id: ElementId;
  type: 'video';
  // Layer membership (docs/specs/006-document/layers.md) — see ShapeElement.layerId.
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Which provider this embed was created FOR (docs/specs/009-elements/embed-providers.md). A creation-time
  // hint only: it names the empty state and the link dialog, so a Figma embed
  // says "Add a Figma link" rather than something generic. The link itself
  // stays authoritative — paste a Vimeo URL into one made from the Figma tile
  // and it renders Vimeo, because refusing a link that plainly works would be
  // pedantry.
  embedProvider?: EmbedProvider;
  // NOTE there is no `videoId` field, deliberately. The YouTube URL lives in
  // `link` (a url-kind ElementLink) and the id is parsed from it on demand by
  // `youtubeVideoId` (youtube.ts). A link card caches its preview in `meta`
  // because unfurling costs a network round trip; parsing an id costs
  // nothing, so storing it would only be a second copy of the truth that can
  // drift from the link.
  //
  // fillColor = card background; strokeColor = card border; textColor = the
  // caption text.
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md). Unset falls back to
  // a tint of the grid stroke, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: wanting a
  // coloured heading over a plain body is the normal case, not an exotic one.
  headerFill?: string;
  // The URL source + everyday boxed fields.
  link?: ElementLink;
  label?: string;
  locked?: boolean;
  opacity?: number;
  // Drop shadow (docs/specs/008-canvas/element-shadows.md). Absent = no shadow; see shadow.ts.
  shadow?: ElementShadow;
  rotation?: number;
  // Looping CSS animation (docs/specs/008-canvas/canvas-and-palette.md "Animated elements"). Undefined = static.
  animation?: ElementAnimation;
  // Speed of `animation` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  animationSpeed?: AnimationSpeed;
  // Whether `animation` loops. Undefined / true = loop forever (the
  // default); false = play once and hold.
  animationRepeat?: boolean;
  aspectLocked?: boolean;
  commentThread?: CommentThread;
  // Assigned action (docs/specs/012-collaboration/assigned-actions.md): at most one per element, non-undoable like
  // the comment thread. See element-action.ts.
  action?: ElementAction;
  note?: string;
  // Per-range note formatting (docs/specs/009-elements/rich-text-notes.md): runs carrying bold / italic /
  // underline / heading / link deltas. `note` stays the plain-text mirror,
  // always === runsPlainText(noteRich). Absent = an unformatted note, which
  // renders exactly as it always did.
  noteRich?: TextRun[];
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

// Does this element take a TYPED label — i.e. is dropping one an invitation
// to start writing? True for the paper-and-text kinds (sticky, shape, text,
// icon), false for the ones whose face is a picture or a control the user
// configures instead of writes: a sticker is artwork, so opening a text caret
// on it would offer to edit something that isn't its to edit.
const UNTYPED_SHAPES = new Set<string>([
  'sticker',
  // A tab window shows another tab (docs/specs/009-elements/tab-window.md); there is nothing to write on it.
  'tab-window',
]);

export function takesTypedLabel(el: { type: string; shape?: string }): boolean {
  if (el.type === 'arrow') return false;
  if (el.type !== 'shape') return true;
  return !UNTYPED_SHAPES.has(el.shape ?? '');
}
