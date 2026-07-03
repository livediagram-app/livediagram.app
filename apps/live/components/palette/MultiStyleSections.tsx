import {
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  type ArrowElement,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type ShapeElement,
} from '@livediagram/diagram';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { SizeButton } from '@/components/palette/palette-controls';
import { BorderStrokeIcon, BorderStyleIcon } from '@/components/palette/palette-icons';
import {
  AnimationMenuGlyph,
  BorderGlyph,
  IconCategoryGlyph,
  PaletteMenuIcon,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { AnimationTiles, FlowTiles, IconSizeTiles } from '@/components/palette/context-menu-tiles';
import { BorderGrid, ColourRow } from '@/components/palette/context-menu-rows';
import { BORDER_STROKES, BORDER_STYLES } from './context-menu-constants';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';

// The multi-selection menu's style band (spec/09): Animation (boxed) /
// arrow Animation / Colours / Border / tech-icon size, each applying
// selection-wide with display values read off the first matching
// member. Lifted out of MultiSelectionContextMenu; the parent derives
// the per-kind sources once and passes them with the shared accordion /
// colour scaffold so these sections fold into the same exclusive set.
export function MultiStyleSections({
  props,
  scaffold,
  boxedSel,
  arrowSrc,
  bothAnimated,
  colourable,
  textSrc,
  fillSrc,
  strokeSrc,
  borderableSel,
  borderSrc,
  techIconSrc,
}: {
  props: EditorContextMenuProps;
  scaffold: ReturnType<typeof useContextMenuScaffold>;
  boxedSel: BoxedElement[];
  arrowSrc: ArrowElement | undefined;
  bothAnimated: boolean;
  colourable: boolean;
  textSrc: Element | undefined;
  fillSrc: BoxedElement | undefined;
  strokeSrc: BoxedElement | undefined;
  borderableSel: boolean;
  borderSrc: { strokeWidth?: BorderStroke; strokeStyle?: BorderStyle; type: string } | undefined;
  techIconSrc: ShapeElement | undefined;
}) {
  const { sectionProps, colorProps, textColorHandlers, fillColorHandlers, strokeColorHandlers } =
    scaffold;
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
      {/* Icon — a Technology icon's fixed tile size (spec/41), when
          the selection holds any; applies to every tech icon in it. */}
      {techIconSrc ? (
        <MenuAccordionSection
          title="Icon"
          icon={<IconCategoryGlyph />}
          {...sectionProps('m-icon-size')}
        >
          <IconSizeTiles
            value={techIconSrc.iconSize ?? 'md'}
            onSet={props.onSetIconSize}
            onPreview={props.onPreviewIconSize}
            onPreviewEnd={props.onPreviewStyleEnd}
          />
        </MenuAccordionSection>
      ) : null}
    </>
  );
}
