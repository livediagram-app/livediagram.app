'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: a single-element menu (link / layer order / note /
// comment) or a whole-selection 'multi' menu. The canvas (empty-space)
// right-click opens the tab menu with its canvas sections folded in,
// rendered by the TabBar — not here. Duplicate lives in the selection
// toolbar (SelectionPopover), not here.
//
// Purely presentational: every action is a callback prop, and each
// item closes the menu after firing (the close-then-act pattern the
// inline version used). The page owns the open/closed state + the
// handlers; this component only decides which items to show.

import { useState } from 'react';
import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';
import {
  animLoops,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  isBoxed,
  isChartShape,
  isLineShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
  LINE_DEFAULT_SERIES,
  PIE_DEFAULT_SLICES,
  PIE_LOOPING_ANIMS,
  PROGRESS_LOOPING_ANIMS,
  RAIL_DEFAULT_POINTS,
  RATING_DEFAULT,
  RATING_LOOPING_ANIMS,
  supportsBorderControls,
  supportsBorderRadius,
  supportsColours,
  type AnimationSpeed,
  type ArrowEnds,
  type ArrowFlow,
  type ArrowheadShape,
  type ArrowheadSize,
  type ArrowStyle,
  type ArrowThickness,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type ElementAnimation,
  type IconAnimation,
  type IconPosition,
  type PieAnim,
  type PieSlice,
  type ProgressAnim,
  type RatingAnim,
  type ShapeKind,
  type ShapeMarker,
  type TextSize,
} from '@livediagram/diagram';
import { ArrowLineControls, ArrowPointerControls } from '@/components/canvas/arrow-controls';
import { ContextMenu, ContextMenuDivider } from '@/components/palette/ContextMenu';
import { SizeButton, ToggleSwitch } from '@/components/palette/palette-controls';
import {
  BoldIcon,
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import {
  AspectLockMenuIcon,
  BorderGlyph,
  CommentMenuIcon,
  IconCategoryGlyph,
  ImageGlyph,
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  LineGlyph,
  LinkMenuIcon,
  AnimationMenuGlyph,
  ProgressMenuGlyph,
  PresetsMenuGlyph,
  NoteMenuIcon,
  PaletteMenuIcon,
  PointerGlyph,
  RemoveIconGlyph,
  RotationGlyph,
  SquareMenuIcon,
  TableGlyph,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import { ShapeIcon } from '@/components/primitives/shape-icon';

import {
  AnimationTiles,
  FlowTiles,
  IconAnimationTiles,
} from '@/components/palette/context-menu-tiles';
import {
  ArrowPresets,
  ShapePresets,
  type ArrowPreset,
  type ShapeBorderPreset,
} from '@/components/palette/StylePresets';
import type { ShapeColorPreset } from '@/lib/themes';
import {
  BorderGrid,
  ChartMenuGlyph,
  ColourRow,
  DataMenuGlyph,
  IconPositionGrid,
  LineDataSummary,
  MarkersMenuGlyph,
  MarkerTiles,
  MenuToggleRow,
  OpacityRow,
  PieAnimTiles,
  PieDataEditor,
  ProgressAnimTiles,
  ProgressRow,
  RailPointsRow,
  RatingAnimTiles,
  RatingMenuGlyph,
  RatingPickerRow,
  TextSizeTiles,
  TextToggle,
} from '@/components/palette/context-menu-rows';

// A curated subset of the most common shapes offered for in-place morphing
// in the context menu's Shape category (the full set lived in the old panel).
const COMMON_SHAPES: ShapeKind[] = [
  'square',
  'circle',
  'diamond',
  'stadium',
  'parallelogram',
  'hexagon',
  'triangle',
  'cylinder',
];

// Fixed rotation angles offered in the context menu's Rotation category
// (and the search palette's Rotate actions). 0 doubles as "reset to
// upright". These 45° steps are the only way to rotate — there's no
// free-drag rotate handle.
const ROTATION_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

// Border option sets rendered in the menu's Border section.
const BORDER_STROKES: readonly BorderStroke[] = ['none', 'thin', 'medium', 'thick', 'extra-thick'];
const BORDER_STYLES: readonly BorderStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
  'long-dash',
  'dash-dot-dot',
];
const BORDER_RADII: readonly BorderRadius[] = ['none', 'sm', 'md', 'lg', 'full'];

// Cursor position + which menu to show. `element` carries the clicked
// element id; `canvas` is the empty-canvas right-click. Exported so
// the page can type its own context-menu state against it.
export type EditorContextMenuState =
  | { mode: 'element'; elementId: string; x: number; y: number }
  // A whole multi-selection or group was right-clicked — actions apply to
  // everything selected.
  | { mode: 'multi'; x: number; y: number }
  // `openUp` grows the menu upward from y (for the footer canvas-menu button,
  // so it opens above the footer rather than over it).
  | { mode: 'canvas'; x: number; y: number; openUp?: boolean };

type EditorContextMenuProps = {
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
  // Status markers (spec/49): set / clear the shape's marker glyph and its size.
  onSetMarker: (value: ShapeMarker | null) => void;
  onSetMarkerSize: (value: TextSize) => void;
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
  // Line chart (spec/53): open the data modal for the given element (the 2-D
  // grid is too wide for the menu, which just summarises the series).
  onEditLineData: (elementId: string) => void;
  // Style presets (spec/48): one-click colour + border looks for the selected
  // shape, plus a reset back to the theme default. `shapeColorPresets` are
  // theme-derived (see shapeColorPresets in lib/themes).
  shapeColorPresets: ShapeColorPreset[];
  onApplyShapeColorPreset: (preset: ShapeColorPreset) => void;
  onApplyShapeBorderPreset: (preset: ShapeBorderPreset) => void;
  onResetShapeStyle: () => void;
  // Hover-to-preview (spec/48): on a desktop pointer, hovering a preset tile
  // shows it live on the selected element; it only sticks on click. The
  // `onPreview*` callbacks apply the ephemeral preview; `onPreviewStyleEnd`
  // reverts it when the pointer leaves the tile without clicking. Shared across
  // the shape colour / border and arrow preset rows.
  onPreviewShapeColorPreset: (preset: ShapeColorPreset) => void;
  onPreviewShapeBorderPreset: (preset: ShapeBorderPreset) => void;
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
  // Arrow Line + Pointer controls (spec/09), surfaced for arrows via the
  // shared ArrowLine / Pointer controls.
  onSetArrowThickness: (v: ArrowThickness) => void;
  onSetArrowStyle: (v: ArrowStyle) => void;
  onSetArrowStrokeStyle: (v: BorderStyle) => void;
  onSetArrowEnds: (v: ArrowEnds) => void;
  onSetArrowheadSize: (v: ArrowheadSize) => void;
  onSetArrowheadShape: (v: ArrowheadShape) => void;
  // Morph a shape element to another kind in place (preserving size/colour).
  onSetShapeKind: (kind: ShapeKind) => void;
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
  // Re-place a shape's inline icon (reuses the drop handler: same iconId,
  // new side).
  onSetIconPosition: (elementId: string, iconId: string, position: IconPosition) => void;
  onOpenNote: (elementId: string) => void;
  onOpenComments: (elementId: string) => void;
  // The selected elements (multi-selection / group members), so the 'multi'
  // menu can surface the formatting categories that match their types (Colours
  // / Text / Border for boxed, Line + Pointer for arrows). The format setters
  // above apply to the whole selection. Duplicate / Group / Lock / Export /
  // Delete are NOT here — the selection toolbar carries those.
  selectionElements: Element[];
};

export function EditorContextMenu(props: EditorContextMenuProps) {
  const { menu, elements, onClose } = props;
  const position = { x: menu.x, y: menu.y };
  // Revert any in-flight swatch / border / rotation hover preview if the menu
  // unmounts mid-hover (dismissed by click-away or Escape) — pointerleave won't
  // fire on unmount. The inline tiles below share this single safety net; the
  // preset rows + ColourRow also revert on their own pointerleave.
  useRevertOnUnmount(props.onPreviewStyleEnd);
  // Grow UPWARD when the menu is opened in the bottom fifth of the
  // viewport, so the tall collapsible-category menu opens above the
  // cursor instead of running off-screen — matching the tab menu.
  const anchorBottom = typeof window !== 'undefined' && menu.y > window.innerHeight * 0.8;
  // Which collapsible section is open in the element menu — at most one at a
  // time (null = all collapsed). An accordion the user can only open one of.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
    // Rows sit flush (no per-row hairline); the only rules in this menu are the
    // MenuGroupSeparator bands, so grouping reads at a glance.
    flush: true,
  });
  // Which colour row's inline palette is open (text / background / border) —
  // at most one, toggled by re-clicking the row so it never sticks open.
  const [openColor, setOpenColor] = useState<string | null>(null);
  const colorProps = (id: string) => ({
    open: openColor === id,
    onToggle: () => setOpenColor((c) => (c === id ? null : id)),
  });
  // Hover-preview handler bundles for the three colour kinds, spread into each
  // ColourRow so the swatches preview/commit like the style presets while the
  // custom <input> keeps the debounced onChange. onPreviewEnd is the shared
  // revert (clearStylePreview).
  const textColorHandlers = {
    onChange: props.onSetTextColor,
    onPreview: props.onPreviewTextColor,
    onCommit: props.onCommitTextColor,
    onPreviewEnd: props.onPreviewStyleEnd,
  };
  const fillColorHandlers = {
    onChange: props.onSetFillColor,
    onPreview: props.onPreviewFillColor,
    onCommit: props.onCommitFillColor,
    onPreviewEnd: props.onPreviewStyleEnd,
  };
  const strokeColorHandlers = {
    onChange: props.onSetStrokeColor,
    onPreview: props.onPreviewStrokeColor,
    onCommit: props.onCommitStrokeColor,
    onPreviewEnd: props.onPreviewStyleEnd,
  };
  // Session-tool pickers (spec/39): the chosen timer mode + countdown length
  // and the votes-per-person budget, local until the facilitator hits Start
  // (mirrors the old tab editor's Session accordion).

  if (menu.mode === 'multi') {
    // The selection toolbar (SelectionPopover / MultiSelectionToolbar) already
    // carries Duplicate / Group / Lock / Export / Delete, so this menu is
    // purely the type-aware formatting categories its ellipsis opens. A
    // selection with nothing formattable (e.g. only images) shows no menu
    // rather than an empty box.
    const selectionFormattable =
      props.selectionElements.some((el) => supportsColours(el)) ||
      props.selectionElements.some((el) => supportsBorderControls(el)) ||
      props.selectionElements.some((el) => el.type === 'arrow');
    if (!selectionFormattable) return null;
    return (
      <ContextMenu position={position} onClose={onClose} flush anchorBottom={anchorBottom}>
        {(() => {
          // Type-aware formatting for the whole selection: only the categories
          // that match the selected element types show, and each control
          // applies to every matching member (the setters are selection-wide).
          // Display values read off the first matching member.
          const sel = props.selectionElements;
          const boxedSel = sel.filter(isBoxed);
          const arrowSel = sel.filter((el) => el.type === 'arrow');
          const colourable = sel.some((el) => supportsColours(el));
          const borderableSel = sel.some((el) => supportsBorderControls(el));
          const textSrc = boxedSel[0] ?? arrowSel[0];
          const fillSrc = boxedSel.find(
            (el) => defaultFillColor(el as BoxedElement) !== 'transparent',
          ) as BoxedElement | undefined;
          const strokeSrc = boxedSel.find(
            (el) => defaultStrokeColor(el as BoxedElement) !== 'transparent',
          ) as BoxedElement | undefined;
          const borderSrc = sel.find((el) => supportsBorderControls(el)) as
            | { strokeWidth?: BorderStroke; strokeStyle?: BorderStyle; type: string }
            | undefined;
          const arrowSrc = arrowSel[0];
          if (!colourable && !borderableSel && !arrowSel.length) return null;
          // Same grouping as the single-element menu: appearance (Animation /
          // Colours / Border) · content (Line / Pointer / Text). Layer / Shape /
          // Rotation / Icon / Image / Table / Link / Collaborate don't apply to a
          // multi-selection, so those groups stay excluded.
          const showMultiAppearance =
            boxedSel.length > 0 || !!arrowSrc || colourable || borderableSel;
          const showMultiContent = !!arrowSrc || !!textSrc;
          // A mixed shape + arrow selection would otherwise show two
          // "Animation" categories (boxed animation + arrow flow). Disambiguate
          // by kind only when both are present; on a single-kind selection the
          // plain "Animation" reads fine.
          const bothAnimated = boxedSel.length > 0 && !!arrowSrc;
          return (
            <>
              {/* Animation (spec/09) — applies to every boxed member of the
                  selection. */}
              {boxedSel.length ? (
                <MenuAccordionSection
                  title={bothAnimated ? 'Shape Animation' : 'Animation'}
                  icon={<AnimationMenuGlyph />}
                  {...sectionProps('m-animation')}
                >
                  <AnimationTiles
                    animation={boxedSel[0]!.animation ?? null}
                    speed={boxedSel[0]!.animationSpeed ?? 'normal'}
                    onSet={props.onSetAnimation}
                    onSetSpeed={props.onSetAnimationSpeed}
                    onPreview={props.onPreviewAnimation}
                    onPreviewEnd={props.onAnimationPreviewEnd}
                  />
                </MenuAccordionSection>
              ) : null}
              {arrowSrc ? (
                <MenuAccordionSection
                  title={bothAnimated ? 'Arrow Animation' : 'Animation'}
                  icon={<AnimationMenuGlyph />}
                  {...sectionProps('m-flow')}
                >
                  <FlowTiles
                    flow={arrowSrc.flow ?? null}
                    speed={arrowSrc.flowSpeed ?? 'normal'}
                    onSet={props.onSetArrowFlow}
                    onSetSpeed={props.onSetFlowSpeed}
                    onPreview={props.onPreviewArrowFlow}
                    onPreviewEnd={props.onAnimationPreviewEnd}
                  />
                </MenuAccordionSection>
              ) : null}
              {colourable ? (
                <MenuAccordionSection
                  title="Colours"
                  icon={<PaletteMenuIcon />}
                  {...sectionProps('m-colours')}
                >
                  {textSrc ? (
                    <ColourRow
                      label="Text"
                      value={
                        (textSrc as { textColor?: string }).textColor ??
                        defaultTextColor(textSrc as BoxedElement)
                      }
                      {...textColorHandlers}
                      {...colorProps('m-text')}
                      presets={props.presetColors}
                    />
                  ) : null}
                  {fillSrc ? (
                    <ColourRow
                      label="Background"
                      value={fillSrc.fillColor ?? defaultFillColor(fillSrc)}
                      {...fillColorHandlers}
                      {...colorProps('m-bg')}
                      presets={props.presetColors}
                    />
                  ) : null}
                  {strokeSrc ? (
                    <ColourRow
                      label="Border"
                      value={strokeSrc.strokeColor ?? defaultStrokeColor(strokeSrc)}
                      {...strokeColorHandlers}
                      {...colorProps('m-border')}
                      presets={props.presetColors}
                    />
                  ) : null}
                </MenuAccordionSection>
              ) : null}
              {borderableSel ? (
                <MenuAccordionSection
                  title="Border"
                  icon={<BorderGlyph />}
                  {...sectionProps('m-border-style')}
                >
                  <div className="px-2 py-1">
                    <BorderGrid label="Strength" cols={5}>
                      {BORDER_STROKES.map((v) => (
                        <SizeButton
                          key={v}
                          active={(borderSrc?.strokeWidth ?? 'medium') === v}
                          onClick={() => props.onCommitBorderStroke(v)}
                          onPointerEnter={onMouseHover(() => props.onPreviewBorderStroke(v))}
                          onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
                        >
                          <BorderStrokeIcon value={v} />
                        </SizeButton>
                      ))}
                    </BorderGrid>
                    <BorderGrid label="Pattern" cols={3}>
                      {BORDER_STYLES.map((v) => (
                        <SizeButton
                          key={v}
                          active={(borderSrc?.strokeStyle ?? 'solid') === v}
                          onClick={() => props.onCommitBorderStyle(v)}
                          onPointerEnter={onMouseHover(() => props.onPreviewBorderStyle(v))}
                          onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
                        >
                          <BorderStyleIcon value={v} />
                        </SizeButton>
                      ))}
                    </BorderGrid>
                  </div>
                </MenuAccordionSection>
              ) : null}
              {/* ── Content group: Line / Pointer / Text ── */}
              {showMultiContent && showMultiAppearance ? <MenuGroupSeparator /> : null}
              {arrowSrc ? (
                <>
                  <MenuAccordionSection
                    title="Line"
                    icon={<LineGlyph />}
                    {...sectionProps('m-line')}
                  >
                    <div className="px-3 py-1.5">
                      <ArrowLineControls
                        thickness={arrowThicknessOf(arrowSrc)}
                        style={arrowStyleOf(arrowSrc)}
                        strokeStyle={arrowSrc.strokeStyle ?? 'solid'}
                        onSetThickness={props.onSetArrowThickness}
                        onSetStyle={props.onSetArrowStyle}
                        onSetStrokeStyle={props.onSetArrowStrokeStyle}
                      />
                    </div>
                  </MenuAccordionSection>
                  <MenuAccordionSection
                    title="Pointer"
                    icon={<PointerGlyph />}
                    {...sectionProps('m-pointer')}
                  >
                    <div className="px-3 py-1.5">
                      <ArrowPointerControls
                        ends={arrowSrc.arrowEnds ?? 'to'}
                        headSize={arrowheadSizeOf(arrowSrc)}
                        headShape={arrowheadShapeOf(arrowSrc)}
                        onSetEnds={props.onSetArrowEnds}
                        onSetHeadSize={props.onSetArrowheadSize}
                        onSetHeadShape={props.onSetArrowheadShape}
                      />
                    </div>
                  </MenuAccordionSection>
                </>
              ) : null}
              {textSrc ? (
                <MenuAccordionSection
                  title="Text"
                  icon={<TextGlyph />}
                  {...sectionProps('m-text-size')}
                >
                  <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Size
                  </p>
                  <TextSizeTiles
                    current={(textSrc as { textSize?: TextSize }).textSize}
                    onSet={props.onSetTextSize}
                  />
                </MenuAccordionSection>
              ) : null}
            </>
          );
        })()}
      </ContextMenu>
    );
  }

  if (menu.mode === 'element') {
    const target = elements.find((el) => el.id === menu.elementId);
    if (!target) return null;
    const boxed = isBoxed(target);
    const isIcon = target.type === 'shape' && target.shape === 'icon';
    // Border + colour controls apply to shapes / freehand / tables, including
    // standalone icons — their wrapper paints fillColor as the box background
    // and strokeColor as the border just like a square (the icon glyph sits on
    // top). A brand icon's glyph stays fixed-colour, but its box background /
    // border are the user's to set, so we offer the same controls.
    const borderable = supportsBorderControls(target);
    const borderStrokeVal: BorderStroke =
      (target as { strokeWidth?: BorderStroke }).strokeWidth ??
      (target.type === 'table' ? 'thin' : 'medium');
    const borderStyleVal: BorderStyle =
      (target as { strokeStyle?: BorderStyle }).strokeStyle ?? 'solid';
    const borderRadiusVal: BorderRadius =
      (target as { borderRadius?: BorderRadius }).borderRadius ?? 'sm';
    // A regular shape carrying an inline icon (drag-an-icon-onto-it
    // feature, spec/09) gets a "Remove icon" entry; the dedicated 'icon'
    // shape is its own glyph and excluded.
    const hasInlineIcon =
      target.type === 'shape' && target.shape !== 'icon' && target.iconId !== undefined;
    const hasImage = target.type === 'image' && target.imageId != null;
    const hasLink = target.link != null;
    // Regular shapes (not the dedicated icon glyph, not a frame container, not
    // a progress element which carries its own `progress` data) can morph to
    // another common kind in place.
    const isProgress = target.type === 'shape' && isProgressShape(target.shape);
    const isRail = target.type === 'shape' && isRailShape(target.shape);
    const isRating = target.type === 'shape' && isRatingShape(target.shape);
    const isChart = target.type === 'shape' && isChartShape(target.shape);
    const isLine = target.type === 'shape' && isLineShape(target.shape);
    // The shape-only sections below (Marker / Progress / Rail / Rating / Data)
    // all render under a `target.type === 'shape'` guard, so this is non-null
    // wherever they read it — `shapeTarget?.field ?? default` reads the shape
    // fields without an `as ShapeElement` assertion at each site.
    const shapeTarget = target.type === 'shape' ? target : null;
    const morphable =
      target.type === 'shape' &&
      !isIcon &&
      target.shape !== 'frame' &&
      !isProgress &&
      !isRail &&
      !isRating &&
      !isChart;
    // Consistent category grouping (spec/09): placement (Layer / Shape /
    // Rotation) · appearance (Progress / Animation / Colours / Border) ·
    // content (Line / Pointer / Text / Icon / Image / Table / Link) ·
    // collaboration. A group divider renders above a group only when that
    // group has a visible section, so an absent group never leaves a dangling
    // rule. Placement always shows (Layer is unconditional), so each later
    // group's divider just gates on the group's own visibility.
    const showAppearanceGroup = boxed || target.type === 'arrow';
    const showContentGroup =
      target.type === 'arrow' ||
      target.type === 'table' ||
      target.type === 'image' ||
      target.type === 'link-card';
    const showCollaborateGroup = boxed;
    return (
      <ContextMenu position={position} onClose={onClose} flush anchorBottom={anchorBottom}>
        {/* Layer — pinned FIRST in the menu (before the type-specific
            categories, which render conditionally and so would otherwise
            shuffle Layer's position around). Groups front/back + opacity +
            (for boxed elements) the aspect-ratio lock. */}
        <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('layer')}>
          {/* Layer order tweaks keep the menu open so you can nudge
              front/back a few times in a row. */}
          <MenuTileGrid cols={2}>
            <MenuTile
              icon={<LayerUpIcon />}
              label="Bring to Front"
              onClick={props.onBringToFront}
            />
            <MenuTile icon={<LayerDownIcon />} label="Send to Back" onClick={props.onSendToBack} />
          </MenuTileGrid>
          <ContextMenuDivider />
          {/* Opacity slider — a non-closing row (dragging stays inside the
              menu, so the outside-click guard leaves it open). */}
          <OpacityRow
            value={(target as { opacity?: number }).opacity ?? 1}
            onChange={props.onSetOpacity}
          />
          {boxed ? (
            <>
              <ContextMenuDivider />
              {/* Lock aspect ratio — the whole row toggles (the switch is a
                  presentational <span> so we don't nest a button in a button). */}
              <button
                type="button"
                onClick={props.onToggleAspectLock}
                aria-pressed={!!(target as { aspectLocked?: boolean }).aspectLocked}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  <span className="text-slate-400 dark:text-slate-400">
                    <AspectLockMenuIcon />
                  </span>
                  Lock aspect ratio
                </span>
                <ToggleSwitch
                  presentational
                  checked={!!(target as { aspectLocked?: boolean }).aspectLocked}
                  label="Lock aspect ratio"
                />
              </button>
            </>
          ) : null}
        </MenuAccordionSection>
        {/* Shape — morph to another common kind, preserving size + colour. */}
        {morphable ? (
          <MenuAccordionSection title="Shape" icon={<SquareMenuIcon />} {...sectionProps('shape')}>
            <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
              {COMMON_SHAPES.map((kind) => (
                <SizeButton
                  key={kind}
                  active={target.type === 'shape' && target.shape === kind}
                  onClick={() => props.onSetShapeKind(kind)}
                >
                  <ShapeIcon kind={kind} />
                </SizeButton>
              ))}
            </div>
            <div className="px-2 pb-1.5 pt-0.5">
              <MenuActionButton
                label="Reset aspect ratio"
                onClick={() => {
                  props.onResetAspectRatio();
                  onClose();
                }}
              />
            </div>
          </MenuAccordionSection>
        ) : null}
        {/* Rotation — fixed snap angles. Each tile previews the orientation
            (an upright marker rotated by the angle) so the effect is legible
            before clicking; 0° resets to upright. */}
        {boxed ? (
          <MenuAccordionSection
            title="Rotation"
            icon={<RotationGlyph deg={45} />}
            {...sectionProps('rotation')}
          >
            <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
              {ROTATION_ANGLES.map((deg) => (
                <SizeButton
                  key={deg}
                  active={((target as { rotation?: number }).rotation ?? 0) % 360 === deg}
                  onClick={() => props.onCommitRotation(deg)}
                  onPointerEnter={onMouseHover(() => props.onPreviewRotation(deg))}
                  onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <RotationGlyph deg={deg} />
                    <span className="text-[9px] leading-none tabular-nums">{deg}°</span>
                  </span>
                </SizeButton>
              ))}
            </div>
          </MenuAccordionSection>
        ) : null}
        {/* ── Appearance group: Presets / Progress / Animation / Colours / Border ── */}
        {showAppearanceGroup ? <MenuGroupSeparator /> : null}
        {/* Presets (spec/48) — pinned at the top of the appearance group (above
            Animation): one-click theme-colour + border looks for a shape, plus
            a reset to the theme default. Regular shapes only — the dedicated
            icon glyph has no fill/border to preset, and the pie chart styles
            per-slice via its Data category, so both are excluded. */}
        {target.type === 'shape' && !isIcon && !isChart ? (
          <MenuAccordionSection
            title="Presets"
            icon={<PresetsMenuGlyph />}
            {...sectionProps('presets')}
          >
            <ShapePresets
              shape={target.shape}
              colorPresets={props.shapeColorPresets}
              current={{
                fillColor: (target as { fillColor?: string }).fillColor,
                strokeColor: (target as { strokeColor?: string }).strokeColor,
                textColor: (target as { textColor?: string }).textColor,
                colorPreset: (target as { colorPreset?: string }).colorPreset,
                strokeWidth: (target as { strokeWidth?: BorderStroke }).strokeWidth,
                strokeStyle: (target as { strokeStyle?: BorderStyle }).strokeStyle,
                borderRadius: (target as { borderRadius?: BorderRadius }).borderRadius,
              }}
              onApplyColor={(p) => props.onApplyShapeColorPreset(p)}
              onApplyBorder={(p) => props.onApplyShapeBorderPreset(p)}
              onPreviewColor={(p) => props.onPreviewShapeColorPreset(p)}
              onPreviewBorder={(p) => props.onPreviewShapeBorderPreset(p)}
              onPreviewEnd={props.onPreviewStyleEnd}
              onReset={() => {
                props.onResetShapeStyle();
                onClose();
              }}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Presets (spec/48) — one-click line looks for an arrow (pattern /
            thickness / optional flow animation, e.g. a dashed animated arrow),
            pinned above the arrow Animation. Arrows only. */}
        {target.type === 'arrow' ? (
          <MenuAccordionSection
            title="Presets"
            icon={<PresetsMenuGlyph />}
            {...sectionProps('presets')}
          >
            <ArrowPresets
              current={{ strokeStyle: target.strokeStyle, flow: target.flow }}
              onApply={(p) => props.onApplyArrowPreset(p)}
              onPreview={(p) => props.onPreviewArrowPreset(p)}
              onPreviewEnd={props.onPreviewStyleEnd}
              onReset={() => {
                props.onResetArrowStyle();
                onClose();
              }}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Progress (spec/46) — the percentage + how the fill animates. Only
            for progress bars / rings. */}
        {isProgress ? (
          <MenuAccordionSection
            title="Progress"
            icon={<ProgressMenuGlyph />}
            {...sectionProps('progress')}
          >
            <ProgressRow value={shapeTarget?.progress ?? 50} onChange={props.onSetProgress} />
            <ProgressAnimTiles
              anim={shapeTarget?.progressAnim ?? null}
              speed={shapeTarget?.progressAnimSpeed ?? 'normal'}
              repeat={animLoops(
                shapeTarget?.progressAnim,
                shapeTarget?.progressAnimRepeat,
                PROGRESS_LOOPING_ANIMS,
              )}
              onSet={props.onSetProgressAnim}
              onSetSpeed={props.onSetProgressAnimSpeed}
              onSetRepeat={props.onSetProgressAnimRepeat}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Timeline (spec/51) — how many points sit on the rail. The right-end
            "+" on the canvas adds one too; this is the precise control. */}
        {isRail ? (
          <MenuAccordionSection
            title="Timeline"
            icon={<ProgressMenuGlyph />}
            {...sectionProps('timeline')}
          >
            <RailPointsRow
              value={shapeTarget?.railCount ?? RAIL_DEFAULT_POINTS}
              onChange={props.onSetRailCount}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Rating (spec/52) — the star score + a star-specific animation. */}
        {isRating ? (
          <MenuAccordionSection
            title="Rating"
            icon={<RatingMenuGlyph />}
            {...sectionProps('rating')}
          >
            <RatingPickerRow
              value={shapeTarget?.rating ?? RATING_DEFAULT}
              onChange={props.onSetRating}
            />
            <RatingAnimTiles
              anim={shapeTarget?.ratingAnim ?? null}
              speed={shapeTarget?.ratingAnimSpeed ?? 'normal'}
              repeat={animLoops(
                shapeTarget?.ratingAnim,
                shapeTarget?.ratingAnimRepeat,
                RATING_LOOPING_ANIMS,
              )}
              onSet={props.onSetRatingAnim}
              onSetSpeed={props.onSetRatingAnimSpeed}
              onSetRepeat={props.onSetRatingAnimRepeat}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Data (spec/53) — the chart's data. Pie / bar edit a single row of
            label+value inline; the line chart's 2-D grid is too wide for the
            menu, so it summarises the series + opens a modal to edit. */}
        {isChart ? (
          <MenuAccordionSection title="Data" icon={<DataMenuGlyph />} {...sectionProps('pie-data')}>
            {isLine ? (
              <LineDataSummary
                series={
                  shapeTarget?.lineSeries ??
                  LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] }))
                }
                onEdit={() => target.type === 'shape' && props.onEditLineData(target.id)}
              />
            ) : (
              <PieDataEditor
                slices={shapeTarget?.pieSlices ?? PIE_DEFAULT_SLICES.map((s) => ({ ...s }))}
                onChange={props.onSetPieData}
              />
            )}
          </MenuAccordionSection>
        ) : null}
        {/* Chart (spec/53) — display options (the legend toggle today). */}
        {isChart ? (
          <MenuAccordionSection title="Chart" icon={<ChartMenuGlyph />} {...sectionProps('chart')}>
            <MenuToggleRow
              label="Legend"
              description="Show the label key beside the chart."
              checked={shapeTarget?.chartLegend !== false}
              onToggle={() => props.onSetChartLegend(shapeTarget?.chartLegend === false)}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Animation (spec/09) — a looping attention/status effect on the
            element. None clears it. Pie charts swap the boxed-element set for
            their own slice animations (the chart family's set). */}
        {boxed ? (
          <MenuAccordionSection
            title="Animation"
            icon={<AnimationMenuGlyph />}
            {...sectionProps('animation')}
          >
            {isChart ? (
              <PieAnimTiles
                anim={shapeTarget?.pieAnim ?? null}
                speed={shapeTarget?.pieAnimSpeed ?? 'normal'}
                repeat={animLoops(
                  shapeTarget?.pieAnim,
                  shapeTarget?.pieAnimRepeat,
                  PIE_LOOPING_ANIMS,
                )}
                onSet={props.onSetPieAnim}
                onSetSpeed={props.onSetPieAnimSpeed}
                onSetRepeat={props.onSetPieAnimRepeat}
              />
            ) : isIcon ? (
              // Icons get their own glyph-motion set (spin / beat / pulse / …)
              // instead of the boxed-element animation set.
              <IconAnimationTiles
                animation={(target as { iconAnimation?: IconAnimation }).iconAnimation ?? null}
                speed={
                  (target as { iconAnimationSpeed?: AnimationSpeed }).iconAnimationSpeed ?? 'normal'
                }
                onSet={props.onSetIconAnimation}
                onSetSpeed={props.onSetIconAnimationSpeed}
                onPreview={props.onPreviewIconAnimation}
                onPreviewEnd={props.onAnimationPreviewEnd}
              />
            ) : (
              <AnimationTiles
                animation={(target as { animation?: ElementAnimation }).animation ?? null}
                speed={(target as { animationSpeed?: AnimationSpeed }).animationSpeed ?? 'normal'}
                onSet={props.onSetAnimation}
                onSetSpeed={props.onSetAnimationSpeed}
                onPreview={props.onPreviewAnimation}
                onPreviewEnd={props.onAnimationPreviewEnd}
              />
            )}
          </MenuAccordionSection>
        ) : null}
        {/* Animation (spec/09) — animate an arrow to show direction: marching
            dashes, a travelling dot, beads, or an in-place pulse / grow / glow.
            None clears it. (Labelled "Animation" to match the boxed-element
            control; the field is still `flow`.) */}
        {target.type === 'arrow' ? (
          <MenuAccordionSection
            title="Animation"
            icon={<AnimationMenuGlyph />}
            {...sectionProps('flow')}
          >
            <FlowTiles
              flow={(target as { flow?: ArrowFlow }).flow ?? null}
              speed={(target as { flowSpeed?: AnimationSpeed }).flowSpeed ?? 'normal'}
              onSet={props.onSetArrowFlow}
              onSetSpeed={props.onSetFlowSpeed}
              onPreview={props.onPreviewArrowFlow}
              onPreviewEnd={props.onAnimationPreviewEnd}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Colours — text / background / border swatches. Boxed elements that
            support colours (excludes images). Icons included: Text tints a
            line-art glyph, Background / Border paint the icon's box. Pie charts
            colour per-slice via their Data category, so they're excluded. */}
        {boxed && supportsColours(target) && !isChart ? (
          <>
            <MenuAccordionSection
              title="Colours"
              icon={<PaletteMenuIcon />}
              {...sectionProps('colours')}
            >
              <ColourRow
                label="Text"
                value={
                  (target as { textColor?: string }).textColor ??
                  defaultTextColor(target as BoxedElement)
                }
                {...textColorHandlers}
                {...colorProps('text')}
                presets={props.presetColors}
              />
              {defaultFillColor(target as BoxedElement) !== 'transparent' ? (
                <ColourRow
                  label="Background"
                  value={
                    (target as { fillColor?: string }).fillColor ??
                    defaultFillColor(target as BoxedElement)
                  }
                  {...fillColorHandlers}
                  {...colorProps('background')}
                  presets={props.presetColors}
                />
              ) : null}
              {defaultStrokeColor(target as BoxedElement) !== 'transparent' ? (
                <ColourRow
                  label="Border"
                  value={
                    (target as { strokeColor?: string }).strokeColor ??
                    defaultStrokeColor(target as BoxedElement)
                  }
                  {...strokeColorHandlers}
                  {...colorProps('border')}
                  presets={props.presetColors}
                />
              ) : null}
              <div className="px-2 pb-1 pt-1.5">
                <MenuActionButton
                  label="Reset to theme"
                  onClick={() => {
                    props.onResetColors();
                    onClose();
                  }}
                />
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
        {/* Border — strength / pattern / radius. Pie charts have no box border
            to style, so they're excluded. */}
        {borderable && !isChart ? (
          <>
            <MenuAccordionSection title="Border" icon={<BorderGlyph />} {...sectionProps('border')}>
              <div className="px-2 py-1">
                <BorderGrid label="Strength" cols={5}>
                  {BORDER_STROKES.map((v) => (
                    <SizeButton
                      key={v}
                      active={borderStrokeVal === v}
                      onClick={() => props.onCommitBorderStroke(v)}
                      onPointerEnter={onMouseHover(() => props.onPreviewBorderStroke(v))}
                      onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
                    >
                      <BorderStrokeIcon value={v} />
                    </SizeButton>
                  ))}
                </BorderGrid>
                <BorderGrid label="Pattern" cols={3}>
                  {BORDER_STYLES.map((v) => (
                    <SizeButton
                      key={v}
                      active={borderStyleVal === v}
                      onClick={() => props.onCommitBorderStyle(v)}
                      onPointerEnter={onMouseHover(() => props.onPreviewBorderStyle(v))}
                      onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
                    >
                      <BorderStyleIcon value={v} />
                    </SizeButton>
                  ))}
                </BorderGrid>
                {supportsBorderRadius(target) ? (
                  <BorderGrid label="Radius" cols={5}>
                    {BORDER_RADII.map((v) => (
                      <SizeButton
                        key={v}
                        active={borderRadiusVal === v}
                        onClick={() => props.onCommitBorderRadius(v)}
                        onPointerEnter={onMouseHover(() => props.onPreviewBorderRadius(v))}
                        onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
                      >
                        <BorderRadiusIcon value={v} />
                      </SizeButton>
                    ))}
                  </BorderGrid>
                ) : null}
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
        {/* Icon — re-place or remove a shape's inline icon. Sits directly
            above Markers (both are shape-content controls); the Icon position
            grid here is now the only way to move the icon, since drag-to-
            reposition was removed. */}
        {hasInlineIcon ? (
          <>
            <MenuGroupSeparator />
            <MenuAccordionSection
              title="Icon"
              icon={<IconCategoryGlyph />}
              {...sectionProps('icon')}
            >
              <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Icon position
              </p>
              <IconPositionGrid
                current={(target as { iconPosition?: string }).iconPosition ?? 'left'}
                onPick={(pos) =>
                  props.onSetIconPosition(
                    target.id,
                    (target as { iconId?: string }).iconId ?? '',
                    pos,
                  )
                }
              />
              <ContextMenuDivider />
              <div className="px-2 py-1.5">
                <MenuTile
                  icon={<RemoveIconGlyph />}
                  label="Remove icon"
                  onClick={() => {
                    props.onRemoveIcon(target.id);
                    onClose();
                  }}
                />
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
        {/* ── Markers group (spec/49): its own band between Border and the
            content / collaborate groups. Regular shapes only — the self-drawing
            shapes (progress / rail / rating) have no label slot for a marker. ── */}
        {target.type === 'shape' && !isProgress && !isRail && !isRating && !isChart ? (
          <>
            <MenuGroupSeparator />
            <MenuAccordionSection
              title="Markers"
              icon={<MarkersMenuGlyph />}
              {...sectionProps('markers')}
            >
              <MarkerTiles
                marker={shapeTarget?.marker ?? null}
                size={shapeTarget?.markerSize ?? 'scale'}
                onSet={props.onSetMarker}
                onSetSize={props.onSetMarkerSize}
              />
            </MenuAccordionSection>
          </>
        ) : null}
        {/* ── Content group: Line / Pointer / Text / Icon / Image / Table / Link ── */}
        {showContentGroup ? <MenuGroupSeparator /> : null}
        {/* Line + Pointer — arrow stroke + arrowhead controls (shared
            ArrowLine/PointerControls). */}
        {target.type === 'arrow' ? (
          <>
            <MenuAccordionSection title="Line" icon={<LineGlyph />} {...sectionProps('line')}>
              <div className="px-3 py-1.5">
                <ArrowLineControls
                  thickness={arrowThicknessOf(target)}
                  style={arrowStyleOf(target)}
                  strokeStyle={target.strokeStyle ?? 'solid'}
                  onSetThickness={props.onSetArrowThickness}
                  onSetStyle={props.onSetArrowStyle}
                  onSetStrokeStyle={props.onSetArrowStrokeStyle}
                />
              </div>
            </MenuAccordionSection>
            <MenuAccordionSection
              title="Pointer"
              icon={<PointerGlyph />}
              {...sectionProps('pointer')}
            >
              <div className="px-3 py-1.5">
                <ArrowPointerControls
                  ends={target.arrowEnds ?? 'to'}
                  headSize={arrowheadSizeOf(target)}
                  headShape={arrowheadShapeOf(target)}
                  onSetEnds={props.onSetArrowEnds}
                  onSetHeadSize={props.onSetArrowheadSize}
                  onSetHeadShape={props.onSetArrowheadShape}
                />
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
        {/* Text — whole-element label formatting for a labelled arrow, or
            every cell of a table (other boxed elements format via the inline
            rich-text toolbar instead). */}
        {(target.type === 'arrow' && target.label) || target.type === 'table' ? (
          <MenuAccordionSection title="Text" icon={<TextGlyph />} {...sectionProps('text')}>
            {target.type === 'table' ? (
              <p className="px-3 pt-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Applies to every cell.
              </p>
            ) : null}
            <div className="flex gap-1 px-2 py-1.5">
              <TextToggle active={!!target.textBold} label="Bold" onClick={props.onToggleTextBold}>
                <BoldIcon />
              </TextToggle>
              <TextToggle
                active={!!target.textItalic}
                label="Italic"
                onClick={props.onToggleTextItalic}
              >
                <ItalicIcon />
              </TextToggle>
              <TextToggle
                active={!!target.textUnderline}
                label="Underline"
                onClick={props.onToggleTextUnderline}
              >
                <UnderlineIcon />
              </TextToggle>
              <TextToggle
                active={!!target.textStrikethrough}
                label="Strikethrough"
                onClick={props.onToggleTextStrikethrough}
              >
                <StrikethroughIcon />
              </TextToggle>
            </div>
            <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Size
            </p>
            <TextSizeTiles current={target.textSize ?? 'sm'} onSet={props.onSetTextSize} />
            <ContextMenuDivider />
            <ColourRow
              label="Colour"
              value={target.textColor ?? '#0f172a'}
              {...textColorHandlers}
              {...colorProps('text')}
              presets={props.presetColors}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Image — pick / change / clear the bitmap (spec/19). */}
        {target.type === 'image' ? (
          <MenuAccordionSection title="Image" icon={<ImageGlyph />} {...sectionProps('image')}>
            {hasImage ? (
              <MenuTileGrid cols={2}>
                <MenuTile
                  icon={<ImageGlyph />}
                  label="Change Image"
                  onClick={() => {
                    props.onOpenImagePicker(target.id);
                    onClose();
                  }}
                />
                <MenuTile
                  icon={<RemoveIconGlyph />}
                  label="Remove Image"
                  onClick={() => {
                    props.onRemoveImage(target.id);
                    onClose();
                  }}
                />
              </MenuTileGrid>
            ) : (
              <div className="px-2 py-1.5">
                <MenuTile
                  icon={<ImageGlyph />}
                  label="Select Image"
                  onClick={() => {
                    props.onOpenImagePicker(target.id);
                    onClose();
                  }}
                />
              </div>
            )}
          </MenuAccordionSection>
        ) : null}
        {/* Table — header row / column + zebra. */}
        {target.type === 'table' ? (
          <MenuAccordionSection title="Table" icon={<TableGlyph />} {...sectionProps('table')}>
            <MenuToggleRow
              label="Header row"
              description="Style the first row as a header."
              checked={target.headerRow ?? false}
              onToggle={props.onToggleTableHeaderRow}
            />
            <ContextMenuDivider />
            <MenuToggleRow
              label="Header column"
              description="Style the first column as a header."
              checked={target.headerColumn ?? false}
              onToggle={props.onToggleTableHeaderColumn}
            />
            <ContextMenuDivider />
            <MenuToggleRow
              label="Zebra striping"
              description="Tint alternate body rows."
              checked={target.zebra ?? false}
              onToggle={props.onToggleTableZebra}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Link — set / change / remove a link-card's destination (spec/40). */}
        {target.type === 'link-card' ? (
          <MenuAccordionSection title="Link" icon={<LinkMenuIcon />} {...sectionProps('link')}>
            {hasLink ? (
              <MenuTileGrid cols={2}>
                <MenuTile
                  icon={<LinkMenuIcon />}
                  label="Change Link"
                  onClick={() => {
                    props.onLinkElement(target.id);
                    onClose();
                  }}
                />
                <MenuTile
                  icon={<RemoveIconGlyph />}
                  label="Remove Link"
                  onClick={() => {
                    props.onRemoveLink();
                    onClose();
                  }}
                />
              </MenuTileGrid>
            ) : (
              <div className="px-2 py-1.5">
                <MenuTile
                  icon={<LinkMenuIcon />}
                  label="Set Link"
                  onClick={() => {
                    props.onLinkElement(target.id);
                    onClose();
                  }}
                />
              </div>
            )}
          </MenuAccordionSection>
        ) : null}
        {/* ── Collaboration group ── */}
        {showCollaborateGroup ? <MenuGroupSeparator /> : null}
        {/* Collaborate — link / note / comments. Boxed-only: arrows can't be
            linked, noted, or commented on. */}
        {boxed ? (
          <MenuAccordionSection
            title="Collaborate"
            icon={<CommentMenuIcon />}
            {...sectionProps('collaborate')}
          >
            {/* Link-cards have their own Link category (set / change / remove),
                so the generic "Add Link" is dropped here for them. */}
            <MenuTileGrid cols={target.type === 'link-card' ? 2 : 3}>
              {target.type !== 'link-card' ? (
                <MenuTile
                  icon={<LinkMenuIcon />}
                  label={target.link ? 'Edit Link' : 'Add Link'}
                  onClick={() => {
                    props.onLinkElement(target.id);
                    onClose();
                  }}
                />
              ) : null}
              <MenuTile
                icon={<NoteMenuIcon />}
                label={target.note ? 'Edit Note' : 'Add Note'}
                onClick={() => {
                  props.onOpenNote(target.id);
                  onClose();
                }}
              />
              <MenuTile
                icon={<CommentMenuIcon />}
                label="Comments"
                onClick={() => {
                  props.onOpenComments(target.id);
                  onClose();
                }}
              />
            </MenuTileGrid>
          </MenuAccordionSection>
        ) : null}
      </ContextMenu>
    );
  }

  // The canvas right-click menu moved to the tab menu (TabBar) so it reuses
  // every tab handler with the canvas sections folded in; this component now
  // only renders the element + multi menus. `menu.mode === 'canvas'` never
  // reaches here (the page routes it to the TabBar), so fall through to null.
  return null;
}
