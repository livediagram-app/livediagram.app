import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultStrokeColor,
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
import { AlignmentGrid } from '@/components/palette/palette-controls';
import { ArrowLineControls, ArrowPointerControls } from '@/components/canvas/arrow-controls';
import { ContextMenu } from '@/components/palette/ContextMenu';
import {
  LineGlyph,
  PointerGlyph,
  StyleMenuGlyph,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuGroupSeparator } from '@/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import {
  MarkersMenuGlyph,
  MarkerTiles,
  TextSizeTiles,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { ArrowPresetsSection, ShapePresetsSection, shapeSupportsPresets } from './PresetSections';
import { MultiPlacementSections } from './MultiPlacementSections';
import { MultiStyleSections } from './MultiStyleSections';
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
  const scaffold = useContextMenuScaffold(props);
  const { sectionProps } = scaffold;
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
        // A mixed shape + arrow selection would otherwise show two
        // "Animation" categories (boxed animation + arrow flow). Disambiguate
        // by kind only when both are present; on a single-kind selection the
        // plain "Animation" reads fine.
        const bothAnimated = boxedSel.length > 0 && !!arrowSrc;
        // Menu parity with the single-element menu (spec/09): everything you
        // can restyle on ONE element works on a selection / group too. Each
        // section reads its display value off the first matching member and
        // writes selection-wide (the setters already are).
        const morphable = boxedSel.filter(
          (el) =>
            el.type === 'shape' &&
            el.shape !== 'icon' &&
            el.shape !== 'frame' &&
            !isSelfDrawingShape(el.shape),
        ) as ShapeElement[];
        const markerSrc = boxedSel.find(
          (el) =>
            el.type === 'shape' &&
            !isProgressShape(el.shape) &&
            !isRailShape(el.shape) &&
            !isRatingShape(el.shape) &&
            !isChartShape(el.shape) &&
            // Markers decorate the label (spec/49): only offer them when a
            // member actually has text.
            (el.label ?? '').trim().length > 0,
        ) as ShapeElement | undefined;
        const techIconSrc = boxedSel.find(
          (el) => el.type === 'shape' && el.shape === 'icon' && isTechIconId(el.iconId),
        ) as ShapeElement | undefined;
        const alignSrc = boxedSel.find(
          (el) =>
            el.type !== 'image' &&
            !(el.type === 'shape' && isSelfDrawingShape(el.shape)) &&
            // Only offer alignment when a member actually has text.
            ((el as { label?: string }).label ?? '').trim().length > 0,
        );
        // The Style flyout shows when any of its children would — the
        // preset sections, Colours, or Border (spec/09, mirroring the
        // single-element menu's Style band).
        const showStyleFlyout = !!presetShapeSrc || !!arrowSrc || colourable || borderableSel;
        // The Text flyout groups Size + Alignment + Markers, mirroring
        // the single-element menu's Text band.
        const showTextFlyout = !!textSrc || !!markerSrc || !!alignSrc;
        return (
          <>
            {/* Placement group (Layer / Shape / Rotation) — see
                  MultiPlacementSections. */}
            <MultiPlacementSections
              props={props}
              sel={sel}
              boxedSel={boxedSel}
              morphable={morphable}
              sectionProps={sectionProps}
            />
            <MenuGroupSeparator />
            {/* ── Style band (spec/09): Presets + Colours + Border behind one
                  "Style" flyout row, matching the single-element menu. ── */}
            {showStyleFlyout ? (
              <MenuFlyoutSection title="Style" icon={<StyleMenuGlyph />} flush>
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
                <MultiStyleSections
                  part="style"
                  props={props}
                  scaffold={scaffold}
                  boxedSel={boxedSel}
                  arrowSrc={arrowSrc}
                  bothAnimated={bothAnimated}
                  colourable={colourable}
                  textSrc={textSrc}
                  fillSrc={fillSrc}
                  strokeSrc={strokeSrc}
                  borderableSel={borderableSel}
                  borderSrc={borderSrc}
                  techIconSrc={techIconSrc}
                />
              </MenuFlyoutSection>
            ) : null}
            {/* Motion band (Animation / arrow Animation / tech-icon size) —
                  top-level rows, same as the single-element menu. */}
            <MultiStyleSections
              part="motion"
              props={props}
              scaffold={scaffold}
              boxedSel={boxedSel}
              arrowSrc={arrowSrc}
              bothAnimated={bothAnimated}
              colourable={colourable}
              textSrc={textSrc}
              fillSrc={fillSrc}
              strokeSrc={strokeSrc}
              borderableSel={borderableSel}
              borderSrc={borderSrc}
              techIconSrc={techIconSrc}
            />
            {/* ── Text band (spec/09): Size + Alignment + Markers behind one
                  "Text" flyout row, matching the single-element menu. ── */}
            {showTextFlyout ? <MenuGroupSeparator /> : null}
            {showTextFlyout ? (
              <MenuFlyoutSection title="Text" icon={<TextGlyph />} flush>
                {textSrc ? (
                  <MenuAccordionSection
                    title="Size"
                    icon={<TextGlyph />}
                    {...sectionProps('m-text-size')}
                  >
                    <TextSizeTiles
                      current={(textSrc as { textSize?: TextSize }).textSize}
                      onSet={props.onSetTextSize}
                      onPreview={props.onPreviewTextSize}
                      onPreviewEnd={props.onPreviewStyleEnd}
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
                        onPreview={props.onPreviewTextAlign}
                        onPreviewEnd={props.onPreviewStyleEnd}
                      />
                    </div>
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
                      onPreview={props.onPreviewMarker}
                      onPreviewSize={props.onPreviewMarkerSize}
                      onPreviewEnd={props.onPreviewStyleEnd}
                    />
                  </MenuAccordionSection>
                ) : null}
              </MenuFlyoutSection>
            ) : null}
            {/* ── Content group: Line / Pointer ── */}
            {arrowSrc && showMultiAppearance ? <MenuGroupSeparator /> : null}
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
          </>
        );
      })()}
    </ContextMenu>
  );
}
