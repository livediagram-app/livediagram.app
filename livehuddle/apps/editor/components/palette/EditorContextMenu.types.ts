import type { ElementStyleOps } from '@/lib/element-style-ops';
import type {
  AnimationSpeed,
  BorderStroke,
  BorderStyle,
  ChairFacing,
  Element,
  ElementShadow,
  Finish,
  AnimationSetId,
  IconAnimation,
  IconPosition,
  IconSize,
  IconWeight,
  Padding,
  TextAlignX,
  TextAlignY,
  ShapeMarker,
  TextSize,
  TextSizePreset,
} from '@livehuddle/document';
import type { ColourPalette } from '@/components/palette/context-menu-input-rows';
import type { ShapeColorPreset } from '@/lib/themes';

export type EditorContextMenuState =
  | { mode: 'element'; elementId: string; x: number; y: number }
  // A whole multi-selection or group was right-clicked — actions apply to
  // everything selected.
  | { mode: 'multi'; x: number; y: number }
  // `openUp` grows the menu upward from y (for the footer canvas-menu button,
  // so it opens above the footer rather than over it).
  | {
      mode: 'canvas';
      x: number;
      y: number;
      openUp?: boolean;
    };

export type EditorContextMenuProps = {
  menu: EditorContextMenuState;
  // The active tab's elements — used to resolve the clicked element
  // (for the element menu) and read its link / note state.
  elements: Element[];
  // The tab default face (docs/specs/004-interface-design/fonts.md), so the layer previews in here paint
  // what the canvas paints.
  tabFont?: string;
  onClose: () => void;
  // The element currently in text-edit mode, if any. While the menu rides
  // alongside the editor (docs/specs/008-canvas/canvas-and-palette.md) the target's label is still uncommitted
  // (text commits on blur), so label-gated categories (Text: Typography /
  // Alignment / Markers) treat "being edited" as having text — otherwise a
  // fresh shape's menu hides exactly the options the user is typing for.
  editingId: string | null;
  // Open the link picker for a stored link card's destination (its own Link category), optionally pre-selecting a
  // mode (webpage / tab / document) so the modal lands on the right tab. No other element takes a link
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes").
  onLinkElement: (elementId: string, mode?: 'url' | 'tab' | 'document') => void;
  // Remove an inline icon from the element. Only surfaced when the
  // clicked element actually carries one (a non-'icon' shape with iconId).
  onRemoveIcon: (elementId: string) => void;
  // Image element actions (docs/specs/009-elements/images.md): open the picker (select / change) and
  // clear the picked image back to a placeholder.
  onOpenImagePicker: (elementId: string) => void;
  onRemoveImage: (elementId: string) => void;
  // Clear the link off the selected element (docs/specs/009-elements/link-cards.md link-card "Remove Link").
  onRemoveLink: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  // Toggle aspect-ratio lock + set opacity on the clicked element (boxed
  // only). Read the current values off the target below.
  onToggleAspectLock: () => void;
  onSetOpacity: (opacity: number) => void;
  // Colour setters back the custom "+" picker in each ColourRow (the native
  // <input type=color>, kept on the debounced direct setter — see below). The
  // discrete swatch / border / rotation tiles commit through the onCommit*
  // hover-preview handlers instead.
  onSetTextColor: (color: string) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  // Hover-to-preview for the individual colour swatches, border tiles, and
  // rotation angles (docs/specs/010-palette/style-presets.md flow extended to the granular controls): on a
  // desktop pointer, hovering shows the value live and it only sticks on click.
  // onCommit*/onPreview* mirror the preset rows; onPreviewStyleEnd (declared
  // below) reverts. The custom colour <input> keeps onSet*Color (debounced).
  onPreviewTextColor: (color: string) => void;
  onCommitTextColor: (color: string) => void;
  onPreviewFillColor: (color: string) => void;
  onCommitFillColor: (color: string) => void;
  onPreviewStrokeColor: (color: string) => void;
  onCommitStrokeColor: (color: string) => void;
  onPreviewBorderStroke: (value: BorderStroke) => void;
  onCommitBorderStroke: (value: BorderStroke) => void;
  onPreviewBorderStyle: (value: BorderStyle) => void;
  onCommitBorderStyle: (value: BorderStyle) => void;
  // Writes a control's own field onto the selection (lib/element-style-ops.ts).
  elementStyle: ElementStyleOps;
  // Drop shadow (docs/specs/008-canvas/element-shadows.md): preset tiles commit/preview like the border
  // tiles; the four sliders use the debounced onSetShadow (one undo step
  // per gesture, like onSetOpacity). `null` clears.
  onSetShadow: (shadow: ElementShadow | null) => void;
  onPreviewShadow: (shadow: ElementShadow | null) => void;
  onCommitShadow: (shadow: ElementShadow | null) => void;
  // Finish tiles (docs/specs/008-canvas/finish.md): hover previews, click commits; `null` is Follow Tab.
  onPreviewFinish: (finish: Finish | null) => void;
  onCommitFinish: (finish: Finish | null) => void;
  onPreviewRotation: (deg: number) => void;
  onCommitRotation: (deg: number) => void;
  // Status markers (docs/specs/009-elements/shape-markers.md): set / clear the shape's marker glyph and its
  // size. Commit + hover-preview pairs, like the border tiles above.
  onSetMarker: (value: ShapeMarker | null) => void;
  onSetMarkerSize: (value: TextSizePreset) => void;
  onPreviewMarker: (value: ShapeMarker | null) => void;
  onPreviewMarkerSize: (value: TextSizePreset) => void;
  // Portal (docs/specs/009-elements/portal-element.md): which portal this one leads to; null unpairs it.
  onSetPortalTarget: (targetId: string | null) => void;
  // Portal (docs/specs/009-elements/portal-element.md): its name (menu-only — the canvas ring stays clean), and
  // "create the far end for me" for the common case where it doesn't exist yet.
  onSetPortalName: (name: string) => void;
  onCreateLinkedPortal: () => void;
  onSetChairFacing: (facing: ChairFacing) => void;
  // Room (docs/specs/009-elements/office.md): which wall its doorway is in.
  onSetRoomDoor: (door: import('@livehuddle/document').RoomDoor) => void;
  // And its walls (docs/specs/009-elements/office.md "Glass walls"): Solid or Glass.
  onSetRoomWalls: (walls: import('@livehuddle/document').RoomWalls) => void;
  // A Door's, Rug's, Corridor's or Meeting Table's type, changed in place (docs/specs/009-elements/office.md "A piece's
  // type"): every selected piece of `kind` becomes `type`.
  onSetPieceType?: (kind: string, type: string) => void;
  // Stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md): Who Can Speak and Show Cameras.
  onSetStage: (patch: import('./StageMenuSection').StagePatch) => void;
  // The Receptionist on the tab's first Avatar Pad (docs/specs/008-canvas/receptionist.md "Asking him to leave").
  onSetPadReceptionist?: (here: boolean) => void;
  // Screen (docs/specs/009-elements/screen-and-room-sign.md): its Video Link, undefined to clear it.
  onSetScreenUrl?: (url: string | undefined) => void;
  // The social pieces (docs/specs/009-elements/social-pieces.md): a World Clock's zones, a Jukebox's source.
  onSetClockZones?: (zones: import('@livehuddle/document').ClockZone[] | undefined) => void;
  onSetJukeboxSource?: (source: string | undefined) => void;
  // An Arcade Machine's High Scores (social-pieces.md "Clearing"): an Editor's Clear, given only at `can.level` edit.
  onClearArcadeScores?: (elementId: string) => void;
  // Every tab, because a portal link can cross tabs, plus which one is active
  // so the picker can mark the off-tab candidates.
  tabs: import('@livehuddle/document').Tab[];
  activeTabId: string;
  // Style presets (docs/specs/010-palette/style-presets.md): one-click colour + border looks for the selected
  // shape, plus a reset back to the theme default. `shapeColorPresets` are
  // theme-derived (see shapeColorPresets in lib/themes).
  shapeColorPresets: ShapeColorPreset[];
  onApplyShapeColorPreset: (preset: ShapeColorPreset) => void;
  onResetShapeStyle: () => void;
  // Hover-to-preview (docs/specs/010-palette/style-presets.md): on a desktop pointer, hovering a preset tile
  // shows it live on the selected element; it only sticks on click. The
  // `onPreview*` callbacks apply the ephemeral preview; `onPreviewStyleEnd`
  // reverts it when the pointer leaves the tile without clicking.
  onPreviewShapeColorPreset: (preset: ShapeColorPreset) => void;
  onPreviewStyleEnd: () => void;
  // Animated elements: one category per animation set (docs/specs/028-animation/element-animations.md),
  // and a glyph animation on icons. `null` clears it. The onSet* commit;
  // the onPreview* play it live on hover (desktop) and onAnimationPreviewEnd reverts when the
  // pointer leaves the tile (the shared useStylePreview flow). A set's handlers write only its
  // members of the selection.
  onSetSetAnimation: (set: AnimationSetId, value: string | null) => void;
  onPreviewSetAnimation: (set: AnimationSetId, value: string | null) => void;
  onSetSetAnimationSpeed: (set: AnimationSetId, value: AnimationSpeed) => void;
  onSetSetAnimationRepeat: (set: AnimationSetId, value: boolean) => void;
  onSetIconAnimation: (value: IconAnimation | null) => void;
  onSetIconAnimationSpeed: (value: AnimationSpeed) => void;
  onPreviewIconAnimation: (value: IconAnimation | null) => void;
  onAnimationPreviewEnd: () => void;
  // Repeat toggles (docs/specs/008-canvas/canvas-and-palette.md): true (the default) loops, false plays once.
  onSetIconAnimationRepeat: (value: boolean) => void;
  onResetColors: () => void;
  // Whole-element text formatting for the selection (a single boxed element formats via the inline rich-text
  // toolbar instead).
  onToggleTextBold: () => void;
  onToggleTextItalic: () => void;
  onToggleTextUnderline: () => void;
  onToggleTextStrikethrough: () => void;
  onSetTextSize: (size: TextSize) => void;
  onPreviewTextSize: (size: TextSize) => void;
  // Element-level typography for the "Text" flyout (docs/specs/008-canvas/canvas-and-palette.md): the label's font
  // and box padding, applied to the whole selection (parallel to onSetTextSize).
  // Preview variants apply the change ephemerally on hover; onPreviewStyleEnd
  // (below) reverts it, matching the marker / alignment / colour tiles.
  onSetFont: (font: string | null) => void;
  onPreviewFont: (font: string | null) => void;
  onSetPadding: (padding: Padding) => void;
  onPreviewPadding: (padding: Padding) => void;
  // Reset the shape back to its kind's default aspect ratio (keeps area,
  // snaps the width:height proportion back to the canonical look).
  onResetAspectRatio: () => void;
  // Set the selection's exact size in canvas pixels (docs/specs/008-canvas/element-size.md). Either
  // dimension alone is allowed: the omitted one is left as-is, or carried by
  // the aspect lock when that is on.
  onSetSize: (size: { width?: number; height?: number }) => void;
  // The colour palette every ColourRow in this menu offers (docs/specs/008-canvas/canvas-and-palette.md Colours):
  // the theme's swatches plus the user's own, spread straight onto the row.
  colourPalette: ColourPalette;
  // Re-place a shape's inline icon (same iconId, new side). Commit +
  // hover-preview pair.
  onSetIconPosition: (elementId: string, iconId: string, position: IconPosition) => void;
  onPreviewIconPosition: (elementId: string, iconId: string, position: IconPosition) => void;
  // A Technology icon element's fixed tile-size preset (docs/specs/010-palette/technology-icons.md). Commit +
  // hover-preview pair.
  onSetIconSize: (size: IconSize) => void;
  onPreviewIconSize: (size: IconSize) => void;
  // A line-art icon's thin / regular / bold weight (docs/specs/004-interface-design/iconography.md).
  // Commit + hover-preview pair.
  onSetIconWeight: (weight: IconWeight) => void;
  onPreviewIconWeight: (weight: IconWeight) => void;
  // Whole-element text alignment (the same 3x3 grid as the text toolbar's
  // alignment dropdown — surfaced in both places for discovery, docs/specs/008-canvas/canvas-and-palette.md).
  // Commit + hover-preview pair.
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onPreviewTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  // The selected elements (multi-selection / group members), so the 'multi'
  // menu can surface the formatting categories that match their types (Colours
  // / Text / Border for boxed). The format setters above apply to the whole selection. Duplicate / Group / Export /
  // Delete are NOT here: the selection toolbar carries those.
  selectionElements: Element[];
};
