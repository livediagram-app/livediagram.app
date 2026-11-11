// Boxed-element type definitions (shape / text / sticky / image /
// freehand / annotation / link-card), split out of index.ts to keep it under
// the ~1000-line budget. Pure types; re-exported through index.ts so the
// public `@livehuddle/document` surface is unchanged. ElementLink + the enums
// stay in index.ts and are imported here (type-only, so no runtime cycle).
import type { RoomDoor, StageSpeakers } from './office';
import type { ClockZone, NoticeNote } from './office-social';
import type { PieceTimer } from './timer-pieces';
import type { ArcadeScore } from './arcade-scores';
import type { Finish } from './finish';
import type { TextRun } from '@liveworkspace/model-core/rich-text';
import type { CommentThread } from './comments';
import type { ElementAction } from './element-action';
import type {
  BorderStroke,
  BorderStyle,
  BorderRadius,
} from '@liveworkspace/model-core/border-style';
import type { ElementShadow } from './shadow';
import type { ShapeMarker } from '@liveworkspace/model-core/shape-marker';
import type { PenColourName } from './pen-colours';
import type { QuickSwatchSlot } from './quick-swatches';
import type { SelectionMode } from './selection-mode';
import type { IconSize } from '@liveworkspace/model-core/icon-size';
import type { IconWeight } from '@liveworkspace/model-core/icon-weight';
import type { ImageCredit } from './image-credit';
import type { ChairFacing } from './collab-shapes';
import { SHAPE_KINDS } from './shape-kinds';
import { isRetiredElementType } from './retired-kinds';
import type {
  AnimationSpeed,
  Reaction,
  ElementAnimation,
  TextAnimation,
  ElementId,
  ElementLink,
  IconAnimation,
  IconPosition,
  Padding,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextSize,
  TextSizePreset,
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
  // editor app's icon catalogue; an unknown key falls back to a placeholder
  // glyph so a document authored against a newer catalogue still renders.
  iconId?: string;
  // Registry key for a `sticker` shape's art (docs/specs/010-palette/stickers.md) — e.g.
  // 'emoji-thumbs-up', 'badge-blocked'. Only meaningful when
  // `shape === 'sticker'`; the entry resolves in the sticker catalogue
  // (@liveworkspace/icons), and an unknown key renders nothing rather than
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
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
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
  // Font-family id (see ../packages/model-core/src/fonts.ts — e.g. 'inter', 'caveat').
  // Unset = inherit the tab's font (Tab.font), which itself falls back to
  // the editor default. Stored as a stable id and mapped to a CSS stack
  // at render time so saved documents round-trip independent of the
  // catalogue's exact font stacks.
  font?: string;
  // Drawing style (docs/specs/008-canvas/finish.md); unset follows the tab's.
  finish?: Finish;
  fillColor?: string;
  strokeColor?: string;
  // A whiteboard marker's named colour (docs/specs/023-draw-mode/draw-mode.md "The colour picker"):
  // drawn in the version tuned for the viewer's board (penColourHex) when `strokeColor` is unset.
  penColour?: PenColourName;
  textColor?: string;
  // A whiteboard stock colour for the label's text (docs/specs/023-draw-mode/draw-mode.md
  // "Imported and pasted content"): drawn in the version tuned for the viewer's board when
  // `textColor` is unset.
  penTextColour?: PenColourName;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md) and a lane's title gutter
  // (docs/specs/009-elements/lane.md). Unset falls back to each one's own historical default, a
  // tint of the grid stroke for a table and a 10% wash of the lane's stroke
  // for a lane, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: a lane's
  // body and its title strip are the two halves a swimlane is made of, and
  // wanting a coloured heading over a plain body is the normal case, not an
  // exotic one.
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
  // it without scaling it, and the menu's Size category stays away. The
  // fixed-size SHAPE kinds (mode-button, badge,
  // docs/specs/009-elements/mode-button.md) get the same treatment from their
  // kind instead. See isFixedSizeElement.
  fixedSize?: boolean;
  // Border styling (shapes + stickies). Each is a preset bucket so
  // saved documents round-trip without carrying arbitrary numeric
  // values; the renderer maps to pixel widths / SVG dasharrays /
  // border-radius pixels (BORDER_STROKE_PX, BORDER_DASH_ARRAY,
  // BORDER_RADIUS_PX further down).
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
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
  // Mode Button (docs/specs/009-elements/mode-button.md): which selection mode pressing this element hands
  // whoever clicked it. Only meaningful on the 'mode-button' kind, and absent
  // means DEFAULT_BUTTON_MODE ('avatar') — so a button authored without one
  // still does the thing it looks like it should.
  mode?: SelectionMode;
  // Portal (docs/specs/009-elements/portal-element.md): the id of the portal this one leads to, on the same tab.
  // Only meaningful on the 'portal' kind. Absent = an unpaired portal, which is
  // inert and says so — a portal to nowhere shouldn't silently swallow clicks.
  portalTarget?: ElementId;
  // Chair (docs/specs/009-elements/chair.md): which way the seat points. Only meaningful on the
  // 'chair' kind; absent = DEFAULT_CHAIR_FACING ('n'). WHO is sitting in it is
  // deliberately NOT here — occupancy rides the avatar presence op, so a chair
  // can't be left stuck by someone who disconnected.
  chairFacing?: ChairFacing;
  // Room (docs/specs/009-elements/office.md "Room"): the wall its doorway is in, or 'none' for a closed room.
  // Absent = DEFAULT_ROOM_DOOR ('s', the front wall).
  roomDoor?: RoomDoor;
  // A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md): its walls' centre line, the corners
  // as 0..1 fractions of the box. Absent on a rectangular Room.
  roomOutline?: { x: number; y: number }[];
  // Stage (docs/specs/009-elements/office.md "Stage"): who may speak from it, and whether its speakers' cameras and
  // screens reach the whole tab. Absent = DEFAULT_STAGE_SPEAKERS ('edit') and off.
  stageSpeakers?: StageSpeakers;
  stageCameras?: boolean;
  // A Door's swing (docs/specs/009-elements/room-builder.md "Opening and closing"): true is shut; absent or false
  // is open, so every door starts open.
  doorClosed?: boolean;
  // An Avatar Pad's Receptionist (docs/specs/008-canvas/receptionist.md "Asking him to leave"): true once an Editor
  // asked him to leave this pad for good; absent or false, he is there.
  receptionistLeft?: boolean;
  // A piece's type within its kind (docs/specs/009-elements/room-builder.md "Door types"): a Door's (Double, Sliding,
  // Revolving), a Rug's pattern (office.md "Rug types"), a Corridor's shape (corridor.md). Absent is the kind's first
  // type; a value its kind does not take draws as the first (piece-variants.ts).
  variant?: string;
  // Notice Board (docs/specs/009-elements/social-pieces.md "Notice Board"): its pinned notes, oldest first.
  noticeNotes?: NoticeNote[];
  // World Clock (social-pieces.md "World Clock"): up to six zones; absent = the viewer's own zone.
  clockZones?: ClockZone[];
  // Jukebox (social-pieces.md "Jukebox"): the https audio address it plays; absent = no music set.
  jukeboxSource?: string;
  // Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md "The state"): its live clock, changed only by
  // `piece-timer` deltas; absent = idle at the default (a Timer at 5 minutes, a Stopwatch at 0).
  pieceTimer?: PieceTimer;
  // Arcade Machine (docs/specs/009-elements/social-pieces.md "High Scores"): its table, best first, at most ten,
  // changed only by `arcade-score` and `arcade-clear` deltas; absent = no scores.
  arcadeScores?: ArcadeScore[];
  // Screen (docs/specs/009-elements/screen-and-room-sign.md "Screen"): its Video Link, a YouTube, Vimeo or Loom address it
  // shows when nobody in its room is sharing. Absent = none.
  screenUrl?: string;
  // A retired Reaction Pad's burst (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): kept as
  // stored so a save carries it through, never read.
  reaction?: Reaction;
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
  // An Action panel's list (docs/specs/012-collaboration/action-panel.md "The data"): the card holds many
  // actions where an ordinary element holds one. Read through elementActions.
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
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
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
  // Font-family id (see ../packages/model-core/src/fonts.ts — e.g. 'inter', 'caveat').
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
  // A whiteboard stock colour for the text (docs/specs/023-draw-mode/draw-mode.md "Imported and
  // pasted content"): drawn in the version tuned for the viewer's board when `textColor` is unset.
  penTextColour?: PenColourName;
  // Quick-swatch binding (docs/specs/008-canvas/quick-style-panel.md): the slot (1-6) the text
  // colour was picked from in the quick style panel's Text colour row, so a
  // theme change re-derives it. Cleared the moment the colour is set any other way.
  textSwatch?: QuickSwatchSlot;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md) and a lane's title gutter
  // (docs/specs/009-elements/lane.md). Unset falls back to each one's own historical default, a
  // tint of the grid stroke for a table and a 10% wash of the lane's stroke
  // for a lane, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: a lane's
  // body and its title strip are the two halves a swimlane is made of, and
  // wanting a coloured heading over a plain body is the normal case, not an
  // exotic one.
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
  // How the box sizes itself (docs/specs/007-editor/editor-modes.md "A text box's sizing"):
  // 'fit', the width follows the words up to the wrap width and the height hugs the lines (clicked
  // into place in Draw mode); 'wrap', the width is set and the height hugs the lines (dragged out
  // or resized in Draw mode). Absent = a fixed box, its text wrapping inside it. Honoured in both
  // editor modes and for everyone.
  sizing?: TextSizing;
  // Multiplier on the label size, set by a Shift resize of a whiteboard text box
  // (docs/specs/023-draw-mode/draw-mode.md "Text boxes"). Absent = 1.
  textScale?: number;
  // Wordmark type (docs/specs/007-editor/editor-modes.md "Pages moved to livedocuments"), drawn wherever the text
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

// --- Sticky notes ----------------------------------------------------------

export type StickyElement = {
  id: ElementId;
  type: 'sticky';
  // Who added it, when a Participant did: see TextElement.addedBy.
  addedBy?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
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
  // Font-family id (see ../packages/model-core/src/fonts.ts — e.g. 'inter', 'caveat').
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
  // A whiteboard stock colour for the note's text (docs/specs/023-draw-mode/draw-mode.md
  // "Imported and pasted content"), drawn in its board's version when `textColor` is unset.
  penTextColour?: PenColourName;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md) and a lane's title gutter
  // (docs/specs/009-elements/lane.md). Unset falls back to each one's own historical default, a
  // tint of the grid stroke for a table and a 10% wash of the lane's stroke
  // for a lane, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: a lane's
  // body and its title strip are the two halves a swimlane is made of, and
  // wanting a coloured heading over a plain body is the normal case, not an
  // exotic one.
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
  // Font-family id (see ../packages/model-core/src/fonts.ts — e.g. 'inter', 'caveat').
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

// --- Link cards ------------------------------------------------------------

// See docs/specs/009-elements/link-cards.md. A rectangular bookmark element: the user sets
// its URL via the normal element-link UI (`link` with `{ kind: 'url' }`),
// and the editor fetches a preview (title / site / favicon / image) through
// the api worker's `/api/unfurl` endpoint and caches it in `meta`. The
// metadata rides the normal tab sync, so peers + reloads get it for free.
// Resizable like a shape; carries the shared boxed fields (mostly
// always-undefined, mirroring ImageElement) for the generic code paths.
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
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md) and a lane's title gutter
  // (docs/specs/009-elements/lane.md). Unset falls back to each one's own historical default, a
  // tint of the grid stroke for a table and a 10% wash of the lane's stroke
  // for a lane, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: a lane's
  // body and its title strip are the two halves a swimlane is made of, and
  // wanting a coloured heading over a plain body is the normal case, not an
  // exotic one.
  headerFill?: string;
  // The URL source + everyday boxed fields.
  link?: ElementLink;
  label?: string;
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
  // search), unused by the card UI.
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

// --- Retired element types --------------------------------------------------

// A stored element of a TYPE the element engine deleted (docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine", "Retired elements"; part 1: `video`, the video and website embeds; part 2: `table`; part 4:
// `freehand`, `path` and `annotation`, the pen strokes, paths and annotation markers). Kept
// exactly as stored and drawn as the placeholder in its box: nothing reads its own fields, so whatever else it
// carries (a video's `embedProvider`, a table's `cells` and `cellStyles`) rides through a save untouched. Only the box and the shared boxed fields the generic code paths
// read (selection, layout, comments, format painter) are typed.
export type RetiredTypeElement = {
  id: ElementId;
  type: 'video' | 'table' | 'freehand' | 'path' | 'annotation';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // Fill for an element's HEADING area, where it has one distinct from its
  // body: a table's header row (docs/specs/008-canvas/canvas-and-palette.md) and a lane's title gutter
  // (docs/specs/009-elements/lane.md). Unset falls back to each one's own historical default, a
  // tint of the grid stroke for a table and a 10% wash of the lane's stroke
  // for a lane, so an unset heading looks exactly as it always did.
  //
  // Separate from `fillColor` because they are separate surfaces: a lane's
  // body and its title strip are the two halves a swimlane is made of, and
  // wanting a coloured heading over a plain body is the normal case, not an
  // exotic one.
  headerFill?: string;
  // The URL source + everyday boxed fields.
  link?: ElementLink;
  label?: string;
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
  // search), unused by the card UI.
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
// configures instead of writes: a sticker is artwork, a mode
// button renders its own caption from its setting, so opening a text caret on
// them would offer to edit something that isn't theirs to edit. A retired
// element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired
// elements", a kind livehuddle does not have) takes no typed label either.
const UNTYPED_SHAPES = new Set<string>([
  'sticker',
  // A fence (docs/specs/009-elements/fence.md) carries no label.
  'fence',
  // An Avatar Pad (docs/specs/009-elements/avatar-pad.md) carries no label.
  'avatar-pad',
  'mode-button',
  // The Directory (docs/specs/009-elements/directory.md) carries no label; an Elevator's label is its name.
  'directory',
  // Stairs (docs/specs/009-elements/stairs.md) carry no name.
  'stairs',
  // The Screen and the Room Sign (docs/specs/009-elements/screen-and-room-sign.md) carry no label.
  'screen',
  'room-sign',
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  'timer',
  'stopwatch',
]);

export function takesTypedLabel(el: { type: string; shape?: string }): boolean {
  if (el.type === 'arrow' || isRetiredElementType(el.type)) return false;
  if (el.type !== 'shape') return true;
  return !UNTYPED_SHAPES.has(el.shape ?? '') && SHAPE_KINDS.has(el.shape ?? '');
}
