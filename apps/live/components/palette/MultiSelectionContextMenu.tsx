import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  isBoxed,
  isChartShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
  isSelfDrawingShape,
  supportsBorderControls,
  supportsColours,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type ShapeElement,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { isTechIconId } from '@/lib/tech-icons';
import { AlignIcon as AlignLinesIcon } from '@/components/canvas/table-icons';
import { AlignmentGrid, ToggleSwitch } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { ArrowLineControls, ArrowPointerControls } from '@/components/canvas/arrow-controls';
import { ContextMenu } from '@/components/palette/ContextMenu';
import { SizeButton } from '@/components/palette/palette-controls';
import { BorderStrokeIcon, BorderStyleIcon } from '@/components/palette/palette-icons';
import {
  AnimationMenuGlyph,
  AspectLockMenuIcon,
  BorderGlyph,
  IconCategoryGlyph,
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  LineGlyph,
  PaletteMenuIcon,
  PointerGlyph,
  RotationGlyph,
  SquareMenuIcon,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupLabel,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import { AnimationTiles, FlowTiles, IconSizeTiles } from '@/components/palette/context-menu-tiles';
import {
  BorderGrid,
  ColourRow,
  MarkersMenuGlyph,
  MarkerTiles,
  OpacityRow,
  TextSizeTiles,
} from '@/components/palette/context-menu-rows';
import { ShapeIcon } from '@/components/primitives/shape-icon';
import {
  BORDER_STROKES,
  BORDER_STYLES,
  COMMON_SHAPES,
  ROTATION_ANGLES,
} from './context-menu-constants';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { ArrowPresetsSection, ShapePresetsSection, shapeSupportsPresets } from './PresetSections';
import { useContextMenuScaffold } from './useContextMenuScaffold';

type MultiSelectionContextMenuProps = {
  props: EditorContextMenuProps;
  position: { x: number; y: number };
  onClose: () => void;
  anchorBottom: boolean;
};

// The whole-selection ('multi') context menu: type-aware formatting categories
// (Animation / Colours / Border + arrow Line / Pointer + Text) that apply to
// every matching member of a marquee selection. Extracted from
// EditorContextMenu; shares the accordion/colour scaffolding via the hook.
export function MultiSelectionContextMenu({
  props,
  position,
  onClose,
  anchorBottom,
}: MultiSelectionContextMenuProps) {
  const { sectionProps, colorProps, textColorHandlers, fillColorHandlers, strokeColorHandlers } =
    useContextMenuScaffold(props);
  // carries Duplicate / Group / Lock / Export / Delete, so this menu is
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
        // Presets (spec/48) apply selection-wide: a shape preset to every
        // preset-eligible shape, an arrow preset to every arrow. The
        // active-tile highlight reads off the first matching member.
        const presetShapeSrc = sel.find(shapeSupportsPresets);
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
        // Same grouping as the single-element menu: placement (Layer / Shape
        // / Rotation) · appearance (Presets / Animation / Colours / Border /
        // Icon / Markers / Alignment) · content (Line / Pointer / Text).
        // Image / Table / Link / Note / Comments stay excluded — those are
        // per-element identity or content, not formatting.
        const showMultiAppearance =
          boxedSel.length > 0 || !!arrowSrc || colourable || borderableSel;
        const showMultiContent = !!arrowSrc || !!textSrc;
        // A mixed shape + arrow selection would otherwise show two
        // "Animation" categories (boxed animation + arrow flow). Disambiguate
        // by kind only when both are present; on a single-kind selection the
        // plain "Animation" reads fine.
        const bothAnimated = boxedSel.length > 0 && !!arrowSrc;
        // Menu parity with the single-element menu (spec/09): everything you
        // can restyle on ONE element works on a selection / group too. Each
        // section reads its display value off the first matching member and
        // writes selection-wide (the setters already are).
        const morphSrc = boxedSel.find(
          (el) =>
            el.type === 'shape' &&
            el.shape !== 'icon' &&
            el.shape !== 'frame' &&
            !isSelfDrawingShape(el.shape),
        ) as ShapeElement | undefined;
        const markerSrc = boxedSel.find(
          (el) =>
            el.type === 'shape' &&
            !isProgressShape(el.shape) &&
            !isRailShape(el.shape) &&
            !isRatingShape(el.shape) &&
            !isChartShape(el.shape),
        ) as ShapeElement | undefined;
        const techIconSrc = boxedSel.find(
          (el) => el.type === 'shape' && el.shape === 'icon' && isTechIconId(el.iconId),
        ) as ShapeElement | undefined;
        const alignSrc = boxedSel.find(
          (el) => el.type !== 'image' && !(el.type === 'shape' && isSelfDrawingShape(el.shape)),
        );
        return (
          <>
            <MenuGroupLabel>Placement</MenuGroupLabel>
            {/* Layer — front/back, opacity and (for boxed members) the
                  aspect-ratio lock, selection-wide, mirroring the single
                  menu's pinned-first Layer section. */}
            <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('m-layer')}>
              <MenuTileGrid cols={2}>
                <MenuTile
                  icon={<LayerUpIcon />}
                  label="Bring to Front"
                  onClick={props.onBringToFront}
                />
                <MenuTile
                  icon={<LayerDownIcon />}
                  label="Send to Back"
                  onClick={props.onSendToBack}
                />
              </MenuTileGrid>
              <OpacityRow
                value={(sel[0] as { opacity?: number } | undefined)?.opacity ?? 1}
                onChange={props.onSetOpacity}
              />
              {boxedSel.length ? (
                <button
                  type="button"
                  onClick={props.onToggleAspectLock}
                  aria-pressed={!!boxedSel[0]!.aspectLocked}
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
                    checked={!!boxedSel[0]!.aspectLocked}
                    label="Lock aspect ratio"
                  />
                </button>
              ) : null}
            </MenuAccordionSection>
            {/* Shape — morph every morphable member to a common kind. */}
            {morphSrc ? (
              <MenuAccordionSection
                title="Shape"
                icon={<SquareMenuIcon />}
                {...sectionProps('m-shape')}
              >
                <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
                  {COMMON_SHAPES.map((kind) => (
                    <SizeButton
                      key={kind}
                      active={morphSrc.shape === kind}
                      onClick={() => props.onSetShapeKind(kind)}
                    >
                      <ShapeIcon kind={kind} />
                    </SizeButton>
                  ))}
                </div>
              </MenuAccordionSection>
            ) : null}
            {/* Rotation — snap angles for every boxed member. */}
            {boxedSel.length ? (
              <MenuAccordionSection
                title="Rotation"
                icon={<RotationGlyph deg={45} />}
                {...sectionProps('m-rotation')}
              >
                <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
                  {ROTATION_ANGLES.map((deg) => (
                    <SizeButton
                      key={deg}
                      active={(boxedSel[0]!.rotation ?? 0) % 360 === deg}
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
            <MenuGroupSeparator label="Style" />
            {/* Presets (spec/48) — pinned at the top of the appearance group,
                  same as the single-element menu; applies to every matching
                  member of the selection. */}
            {presetShapeSrc ? (
              <ShapePresetsSection
                shape={presetShapeSrc.shape}
                current={{
                  fillColor: presetShapeSrc.fillColor,
                  strokeColor: presetShapeSrc.strokeColor,
                  textColor: presetShapeSrc.textColor,
                  colorPreset: presetShapeSrc.colorPreset,
                }}
                props={props}
                accordion={sectionProps('m-shape-presets')}
                onClose={onClose}
                // Mixed selection shows both preset sections — disambiguate
                // by kind, same as the Animation sections below.
                title={presetShapeSrc && arrowSrc ? 'Shape Presets' : 'Presets'}
              />
            ) : null}
            {arrowSrc ? (
              <ArrowPresetsSection
                current={{ strokeStyle: arrowSrc.strokeStyle, flow: arrowSrc.flow }}
                props={props}
                accordion={sectionProps('m-arrow-presets')}
                onClose={onClose}
                title={presetShapeSrc && arrowSrc ? 'Arrow Presets' : 'Presets'}
              />
            ) : null}
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
            {/* Icon — a Technology icon's fixed tile size (spec/41), when
                  the selection holds any; applies to every tech icon in it. */}
            {techIconSrc ? (
              <MenuAccordionSection
                title="Icon"
                icon={<IconCategoryGlyph />}
                {...sectionProps('m-icon-size')}
              >
                <IconSizeTiles value={techIconSrc.iconSize ?? 'md'} onSet={props.onSetIconSize} />
              </MenuAccordionSection>
            ) : null}
            {/* Markers (spec/49) — for every marker-capable shape in the
                  selection. */}
            {markerSrc ? (
              <MenuAccordionSection
                title="Markers"
                icon={<MarkersMenuGlyph />}
                {...sectionProps('m-markers')}
              >
                <MarkerTiles
                  marker={markerSrc.marker ?? null}
                  size={markerSrc.markerSize ?? 'scale'}
                  onSet={props.onSetMarker}
                  onSetSize={props.onSetMarkerSize}
                />
              </MenuAccordionSection>
            ) : null}
            {/* Alignment — the text toolbar's 3x3 grid, selection-wide. */}
            {alignSrc ? (
              <MenuAccordionSection
                title="Alignment"
                icon={
                  <AlignLinesIcon
                    dir={(alignSrc as { textAlignX?: TextAlignX }).textAlignX ?? 'center'}
                  />
                }
                {...sectionProps('m-text-align')}
              >
                <div className="px-2 py-1.5">
                  <AlignmentGrid
                    alignX={(alignSrc as { textAlignX?: TextAlignX }).textAlignX ?? 'center'}
                    alignY={(alignSrc as { textAlignY?: TextAlignY }).textAlignY ?? 'middle'}
                    onChange={props.onSetTextAlign}
                  />
                </div>
              </MenuAccordionSection>
            ) : null}
            {/* ── Content group: Line / Pointer / Text ── */}
            {showMultiContent && showMultiAppearance ? (
              <MenuGroupSeparator label="Content" />
            ) : null}
            {arrowSrc ? (
              <>
                <MenuAccordionSection title="Line" icon={<LineGlyph />} {...sectionProps('m-line')}>
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
