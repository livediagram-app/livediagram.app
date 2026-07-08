import type {
  AnimationSpeed,
  ArrowEnds,
  ArrowFlow,
  ArrowheadShape,
  ArrowheadSize,
  ArrowStyle,
  ArrowThickness,
  BorderRadius,
  BorderStroke,
  BorderStyle,
  ChartLegendPosition,
  Element,
  Layer,
  ElementAnimation,
  IconAnimation,
  IconPosition,
  IconSize,
  Padding,
  TextAlignX,
  TextAlignY,
  PieAnim,
  PieSlice,
  ProgressAnim,
  RatingAnim,
  ShapeKind,
  ShapeMarker,
  TextSize,
} from '@livediagram/diagram';
import type { ArrowPreset } from '@/components/palette/StylePresets';
import type { ShapeColorPreset } from '@/lib/themes';

export type EditorContextMenuState =
  | { mode: 'element'; elementId: string; x: number; y: number }
  // A whole multi-selection or group was right-clicked — actions apply to
  // everything selected.
  | { mode: 'multi'; x: number; y: number }
  // `openUp` grows the menu upward from y (for the footer canvas-menu button,
  // so it opens above the footer rather than over it).
  | { mode: 'canvas'; x: number; y: number; openUp?: boolean };

export type EditorContextMenuProps = {
  menu: EditorContextMenuState;
  // The active tab's elements — used to resolve the clicked element
  // (for the element menu) and read its link / note state.
  elements: Element[];
  onClose: () => void;
  // Open the link picker for the element, optionally pre-selecting a mode
  // (webpage / tab / diagram) so the modal lands on the right tab.
  onLinkElement: (elementId: string, mode?: 'url' | 'tab' | 'diagram') => void;
  // Remove an inline icon from the element. Only surfaced when the
  // clicked element actually carries one (a non-'icon' shape with iconId).
  onRemoveIcon: (elementId: string) => void;
  // Image element actions (spec/19): open the picker (select / change) and
  // clear the picked image back to a placeholder.
  onOpenImagePicker: (elementId: string) => void;
  onRemoveImage: (elementId: string) => void;
  // Clear the link off the selected element (spec/40 link-card "Remove Link").
  onRemoveLink: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  // Layers (spec/74): the tab's normalised stack (bottom -> top) for the
  // Layer section's move-to dropdown, the selection's resolved layer
  // (null when members span layers), and the selection-wide move.
  layers: Layer[];
  selectionLayerId: string | null;
  onMoveSelectionToLayer: (layerId: string) => void;
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
  // rotation angles (spec/48 flow extended to the granular controls): on a
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
  onPreviewBorderRadius: (value: BorderRadius) => void;
  onCommitBorderRadius: (value: BorderRadius) => void;
  onPreviewRotation: (deg: number) => void;
  onCommitRotation: (deg: number) => void;
  // Status markers (spec/49): set / clear the shape's marker glyph and its
  // size. Commit + hover-preview pairs, like the border tiles above.
  onSetMarker: (value: ShapeMarker | null) => void;
  onSetMarkerSize: (value: TextSize) => void;
  onPreviewMarker: (value: ShapeMarker | null) => void;
  onPreviewMarkerSize: (value: TextSize) => void;
  // Timeline rail (spec/51): set the rail's point count.
  onSetRailCount: (count: number) => void;
  // Rating (spec/52): the star score + its animation.
  onSetRating: (value: number) => void;
  onSetRatingAnim: (value: RatingAnim | null) => void;
  onSetRatingAnimSpeed: (value: AnimationSpeed) => void;
  onSetRatingAnimRepeat: (value: boolean) => void;
  // Pie chart (spec/53): the data rows + the slice animation.
  onSetPieData: (slices: PieSlice[]) => void;
  onSetPieAnim: (value: PieAnim | null) => void;
  onSetPieAnimSpeed: (value: AnimationSpeed) => void;
  onSetPieAnimRepeat: (value: boolean) => void;
  onSetChartLegend: (value: boolean) => void;
  onSetChartLegendPosition: (position: ChartLegendPosition) => void;
  // Line chart (spec/53): open the data modal for the given element (the 2-D
  // grid is too wide for the menu, which just summarises the series).
  onEditLineData: (elementId: string) => void;
  // Style presets (spec/48): one-click colour + border looks for the selected
  // shape, plus a reset back to the theme default. `shapeColorPresets` are
  // theme-derived (see shapeColorPresets in lib/themes).
  shapeColorPresets: ShapeColorPreset[];
  onApplyShapeColorPreset: (preset: ShapeColorPreset) => void;
  onResetShapeStyle: () => void;
  // Hover-to-preview (spec/48): on a desktop pointer, hovering a preset tile
  // shows it live on the selected element; it only sticks on click. The
  // `onPreview*` callbacks apply the ephemeral preview; `onPreviewStyleEnd`
  // reverts it when the pointer leaves the tile without clicking. Shared across
  // the shape style and arrow preset rows.
  onPreviewShapeColorPreset: (preset: ShapeColorPreset) => void;
  onPreviewArrowPreset: (preset: ArrowPreset) => void;
  onPreviewStyleEnd: () => void;
  // Arrow style presets (spec/48): one-click line looks (pattern / thickness /
  // optional flow animation) for the selected arrow, plus a reset.
  onApplyArrowPreset: (preset: ArrowPreset) => void;
  onResetArrowStyle: () => void;
  // Animated elements (spec/09): a looping animation on boxed elements, a flow
  // animation on arrows, and a glyph animation on icons. `null` clears it. The
  // onSet* commit; the onPreview* play it live on hover (desktop) and
  // onAnimationPreviewEnd reverts when the pointer leaves the tile — same
  // hover-to-preview flow as the style presets above (shared useStylePreview).
  onSetAnimation: (value: ElementAnimation | null) => void;
  onSetArrowFlow: (value: ArrowFlow | null) => void;
  onSetIconAnimation: (value: IconAnimation | null) => void;
  onSetIconAnimationSpeed: (value: AnimationSpeed) => void;
  onPreviewAnimation: (value: ElementAnimation | null) => void;
  onPreviewArrowFlow: (value: ArrowFlow | null) => void;
  onPreviewIconAnimation: (value: IconAnimation | null) => void;
  onAnimationPreviewEnd: () => void;
  onSetProgress: (value: number) => void;
  onSetProgressAnim: (value: ProgressAnim | null) => void;
  onSetProgressAnimSpeed: (value: AnimationSpeed) => void;
  onSetProgressAnimRepeat: (value: boolean) => void;
  onSetAnimationSpeed: (value: AnimationSpeed) => void;
  onSetFlowSpeed: (value: AnimationSpeed) => void;
  onResetColors: () => void;
  // Whole-element text formatting — surfaced for arrows that carry a label
  // (boxed elements format via the inline rich-text toolbar instead).
  onToggleTextBold: () => void;
  onToggleTextItalic: () => void;
  onToggleTextUnderline: () => void;
  onToggleTextStrikethrough: () => void;
  onSetTextSize: (size: TextSize) => void;
  onPreviewTextSize: (size: TextSize) => void;
  // Element-level typography for the "Text" flyout (spec/09): the label's font
  // and box padding, applied to the whole selection (parallel to onSetTextSize).
  onSetFont: (font: string | null) => void;
  onSetPadding: (padding: Padding) => void;
  // Arrow Line + Pointer controls (spec/09), surfaced for arrows via the
  // shared ArrowLine / Pointer controls.
  onSetArrowThickness: (v: ArrowThickness) => void;
  onSetArrowStyle: (v: ArrowStyle) => void;
  onSetArrowStrokeStyle: (v: BorderStyle) => void;
  onSetArrowEnds: (v: ArrowEnds) => void;
  onSetArrowheadSize: (v: ArrowheadSize) => void;
  onSetArrowheadShape: (v: ArrowheadShape) => void;
  // Morph shape elements to another kind in place (preserving size/colour).
  // Id-scoped: the single menu passes just the clicked element, the multi
  // menu every morphable member. Commit + hover-preview pair.
  onSetShapeKind: (ids: string[], kind: ShapeKind) => void;
  onPreviewShapeKind: (ids: string[], kind: ShapeKind) => void;
  // Reset the shape back to its kind's default aspect ratio (keeps area,
  // snaps the width:height proportion back to the canonical look).
  onResetAspectRatio: () => void;
  // Preset colour swatches for the colour pickers, derived from the active
  // theme so the offered presets match it.
  presetColors: string[];
  // Table structure toggles (header row / column, zebra) for the Table
  // category.
  onToggleTableHeaderRow: () => void;
  onToggleTableHeaderColumn: () => void;
  onToggleTableZebra: () => void;
  // Re-place a shape's inline icon (same iconId, new side). Commit +
  // hover-preview pair.
  onSetIconPosition: (elementId: string, iconId: string, position: IconPosition) => void;
  onPreviewIconPosition: (elementId: string, iconId: string, position: IconPosition) => void;
  // A Technology icon element's fixed tile-size preset (spec/41). Commit +
  // hover-preview pair.
  onSetIconSize: (size: IconSize) => void;
  onPreviewIconSize: (size: IconSize) => void;
  // Whole-element text alignment (the same 3x3 grid as the text toolbar's
  // alignment dropdown — surfaced in both places for discovery, spec/09).
  // Commit + hover-preview pair.
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onPreviewTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onOpenNote: (elementId: string) => void;
  onOpenComments: (elementId: string) => void;
  // Assigned actions (spec/68): the Collaborate category's Assign Action
  // tile, shown for everyone (signed-out users can self-assign). Opens
  // the assign dialog (no action yet) or the action popover (one exists).
  onAssignAction: (elementId: string) => void;
  // The selected elements (multi-selection / group members), so the 'multi'
  // menu can surface the formatting categories that match their types (Colours
  // / Text / Border for boxed, Line + Pointer for arrows). The format setters
  // above apply to the whole selection. Duplicate / Group / Lock / Export /
  // Delete are NOT here — the selection toolbar carries those.
  selectionElements: Element[];
};
