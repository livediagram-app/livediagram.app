import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  isBoxed,
  isChartShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
  isSelfDrawingShape,
  supportsBorderControls,
  supportsBorderRadius,
  supportsColours,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Padding,
  type ShapeElement,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { isTechIconId } from '@/lib/tech-icons';
import { AlignIcon as AlignLinesIcon } from '@/components/canvas/table-icons';
import { AlignmentGrid } from '@/components/palette/palette-controls';
import { ArrowLineControls, ArrowPointerControls } from '@/components/canvas/arrow-controls';
import { ContextMenu, ContextMenuDivider } from '@/components/palette/ContextMenu';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import {
  LineGlyph,
  PointerGlyph,
  StyleMenuGlyph,
  TableGlyph,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuGroupSeparator } from '@/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import {
  ColourRow,
  MarkersMenuGlyph,
  MarkerTiles,
  MenuToggleRow,
  TextSizeTiles,
  TextToggle,
} from '@/components/palette/context-menu-rows';
import { TypographySections } from './TypographySections';
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
  const { sectionProps, flyoutProps, colorProps, textColorHandlers } = scaffold;
  // The selection toolbar carries Duplicate / Group / Lock / Export /
  // Delete, so this menu is purely the type-aware formatting categories
  // its ellipsis opens. It always renders: the placement band (Layer /
  // opacity / Rotation) applies to every element kind — an image-only
  // marquee used to get NO menu at all, which read as broken.
  if (props.selectionElements.length === 0) return null;
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
        // Colour swatches show for the members whose SINGLE menus would
        // show Colours: boxed, colour-supporting, not a chart (charts
        // colour per-slice via their Data category). Arrows colour their
        // label via the content Text section, matching the single menu.
        const colourSrcs = boxedSel.filter(
          (el) => supportsColours(el) && !(el.type === 'shape' && isChartShape(el.shape)),
        );
        const colourable = colourSrcs.length > 0;
        const textSrc = colourSrcs[0];
        const fillSrc = colourSrcs.find((el) => defaultFillColor(el) !== 'transparent');
        const strokeSrc = colourSrcs.find((el) => defaultStrokeColor(el) !== 'transparent');
        const borderableSel = sel.some((el) => supportsBorderControls(el));
        const borderSrc = sel.find((el) => supportsBorderControls(el)) as
          | { strokeWidth?: BorderStroke; strokeStyle?: BorderStyle; type: string }
          | undefined;
        const radiusSrc = sel.find((el) => supportsBorderRadius(el)) as
          | { borderRadius?: BorderRadius }
          | undefined;
        const arrowSrc = arrowSel[0];
        // Arrow-with-label / table members get the content Text section
        // (B / I / U / S + size + colour), same as their single menus.
        const contentTextSrc =
          arrowSel.find((a) => a.label) ?? sel.find((el) => el.type === 'table');
        const tableSrc = sel.find((el) => el.type === 'table');
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
        // The Text flyout groups Typography (Font / Size / Padding) +
        // Alignment + Markers, mirroring the single-element menu; arrow
        // and table text formats via the content Text section instead.
        const showTextFlyout = !!markerSrc || !!alignSrc;
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
              onClose={onClose}
            />
            <MenuGroupSeparator />
            {/* ── Style band (spec/09): Presets + Colours + Border behind one
                  "Style" flyout row, matching the single-element menu. ── */}
            {showStyleFlyout ? (
              <MenuFlyoutSection title="Style" icon={<StyleMenuGlyph />} {...flyoutProps('style')}>
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
                    current={{
                      strokeStyle: arrowSrc.strokeStyle,
                      strokeWidth: arrowSrc.strokeWidth,
                      flow: arrowSrc.flow,
                    }}
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
                  radiusSrc={radiusSrc}
                  techIconSrc={techIconSrc}
                  onClose={onClose}
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
              radiusSrc={radiusSrc}
              techIconSrc={techIconSrc}
              onClose={onClose}
            />
            {/* ── Text row (spec/09): Typography + Alignment + Markers behind
                  one "Text" flyout, matching the single-element menu. Sits in
                  the style band (no separator) like its single counterpart. ── */}
            {showTextFlyout ? (
              <MenuFlyoutSection title="Text" icon={<TextGlyph />} {...flyoutProps('text')}>
                {alignSrc ? (
                  <TypographySections
                    currentFont={(alignSrc as { font?: string }).font ?? null}
                    currentSize={(alignSrc as { textSize?: TextSize }).textSize ?? 'sm'}
                    padding={
                      (alignSrc as { padding?: Padding }).padding ??
                      defaultPadding(alignSrc as BoxedElement)
                    }
                    onSetFont={props.onSetFont}
                    onSetSize={props.onSetTextSize}
                    onSetPadding={props.onSetPadding}
                    onPreviewFont={props.onPreviewFont}
                    onPreviewSize={props.onPreviewTextSize}
                    onPreviewPadding={props.onPreviewPadding}
                    onPreviewEnd={props.onPreviewStyleEnd}
                    sectionProps={sectionProps}
                  />
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
            {/* ── Content group: Line / Pointer / Text / Table ── */}
            {(arrowSrc || contentTextSrc || tableSrc) && showMultiAppearance ? (
              <MenuGroupSeparator />
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
            {/* Text — whole-element label formatting for labelled arrows /
                  every cell of the selection's tables, mirroring the single
                  menu's content Text section. */}
            {contentTextSrc ? (
              <MenuAccordionSection title="Text" icon={<TextGlyph />} {...sectionProps('m-text')}>
                {contentTextSrc.type === 'table' ? (
                  <p className="px-3 pt-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Applies to every cell.
                  </p>
                ) : null}
                <div className="flex gap-1 px-2 py-1.5">
                  <TextToggle
                    active={!!contentTextSrc.textBold}
                    label="Bold"
                    onClick={props.onToggleTextBold}
                  >
                    <BoldIcon />
                  </TextToggle>
                  <TextToggle
                    active={!!contentTextSrc.textItalic}
                    label="Italic"
                    onClick={props.onToggleTextItalic}
                  >
                    <ItalicIcon />
                  </TextToggle>
                  <TextToggle
                    active={!!contentTextSrc.textUnderline}
                    label="Underline"
                    onClick={props.onToggleTextUnderline}
                  >
                    <UnderlineIcon />
                  </TextToggle>
                  <TextToggle
                    active={!!contentTextSrc.textStrikethrough}
                    label="Strikethrough"
                    onClick={props.onToggleTextStrikethrough}
                  >
                    <StrikethroughIcon />
                  </TextToggle>
                </div>
                <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Size
                </p>
                <TextSizeTiles
                  current={contentTextSrc.textSize ?? 'sm'}
                  onSet={props.onSetTextSize}
                  onPreview={props.onPreviewTextSize}
                  onPreviewEnd={props.onPreviewStyleEnd}
                />
                <ContextMenuDivider />
                <ColourRow
                  label="Colour"
                  value={contentTextSrc.textColor ?? '#0f172a'}
                  {...textColorHandlers}
                  {...colorProps('m-content-text')}
                  presets={props.presetColors}
                />
              </MenuAccordionSection>
            ) : null}
            {/* Table — header row / column + zebra, applied to every table
                  in the selection (the single menu's Table section,
                  selection-wide). */}
            {tableSrc ? (
              <MenuAccordionSection
                title="Table"
                icon={<TableGlyph />}
                {...sectionProps('m-table')}
              >
                <MenuToggleRow
                  label="Header row"
                  description="Style the first row as a header."
                  checked={tableSrc.headerRow ?? false}
                  onToggle={props.onToggleTableHeaderRow}
                />
                <ContextMenuDivider />
                <MenuToggleRow
                  label="Header column"
                  description="Style the first column as a header."
                  checked={tableSrc.headerColumn ?? false}
                  onToggle={props.onToggleTableHeaderColumn}
                />
                <ContextMenuDivider />
                <MenuToggleRow
                  label="Zebra striping"
                  description="Tint alternate body rows."
                  checked={tableSrc.zebra ?? false}
                  onToggle={props.onToggleTableZebra}
                />
              </MenuAccordionSection>
            ) : null}
          </>
        );
      })()}
    </ContextMenu>
  );
}
