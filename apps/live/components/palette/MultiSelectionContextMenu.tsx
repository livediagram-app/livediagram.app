import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  isBoxed,
  supportsBorderControls,
  supportsColours,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type TextSize,
} from '@livediagram/diagram';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { ArrowLineControls, ArrowPointerControls } from '@/components/canvas/arrow-controls';
import { ContextMenu } from '@/components/palette/ContextMenu';
import { SizeButton } from '@/components/palette/palette-controls';
import { BorderStrokeIcon, BorderStyleIcon } from '@/components/palette/palette-icons';
import {
  AnimationMenuGlyph,
  BorderGlyph,
  LineGlyph,
  PaletteMenuIcon,
  PointerGlyph,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuGroupSeparator } from '@/components/primitives/PortalMenu';
import { AnimationTiles, FlowTiles } from '@/components/palette/context-menu-tiles';
import { BorderGrid, ColourRow, TextSizeTiles } from '@/components/palette/context-menu-rows';
import { BORDER_STROKES, BORDER_STYLES } from './context-menu-constants';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
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
