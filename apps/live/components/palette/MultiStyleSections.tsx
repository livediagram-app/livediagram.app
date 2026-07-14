import {
  animLoops,
  DEFAULT_ANIMATION_SPEED,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  isChartShape,
  PIE_LOOPING_ANIMS,
  type ArrowElement,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type ElementShadow,
  type ShapeElement,
} from '@livediagram/diagram';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
} from '@/components/palette/palette-icons';
import {
  AnimationMenuGlyph,
  BorderGlyph,
  IconCategoryGlyph,
  PaletteMenuIcon,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuActionButton } from '@/components/primitives/PortalMenu';
import {
  AnimationTiles,
  FlowTiles,
  IconAnimationTiles,
  IconSizeTiles,
} from '@/components/palette/context-menu-tiles';
import { BorderGrid, ColourRow, PieAnimTiles } from '@/components/palette/context-menu-rows';
import { ShadowSection } from '@/components/palette/ShadowSection';
import { BORDER_RADII, BORDER_STROKES, BORDER_STYLES } from './context-menu-constants';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';

// The multi-selection menu's style + motion sections (spec/09), each
// applying selection-wide with display values read off the first
// matching member. Rendered in two parts so the parent can fold the
// 'style' half (Colours / Border) into the Style side-flyout alongside
// the preset sections — mirroring the single-element menu — while the
// 'motion' half (Animation / arrow Animation / tech-icon size) stays a
// top-level row set. The parent derives the per-kind sources once and
// passes them with the shared accordion / colour scaffold so every
// section folds into the same exclusive set.
export function MultiStyleSections({
  part,
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
  radiusSrc,
  shadowSrc,
  techIconSrc,
  onClose,
}: {
  part: 'style' | 'motion';
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
  // First member whose kind rounds corners — gates + feeds the Radius
  // grid, mirroring the single menu's supportsBorderRadius branch.
  radiusSrc: { borderRadius?: BorderRadius } | undefined;
  // First shadow-supporting member (spec/86) — gates + feeds the Shadow
  // section, mirroring the single menu's supportsShadow branch.
  shadowSrc: { shadow?: ElementShadow } | undefined;
  techIconSrc: ShapeElement | undefined;
  onClose: () => void;
}) {
  const { sectionProps, colorProps, textColorHandlers, fillColorHandlers, strokeColorHandlers } =
    scaffold;
  // Type-aware animation sets, mirroring the single menu: a selection
  // that is ALL charts gets the slice animations, ALL icons the glyph
  // animations; anything mixed falls back to the generic boxed set
  // (which is what a mixed selection can share).
  const allCharts =
    boxedSel.length > 0 && boxedSel.every((el) => el.type === 'shape' && isChartShape(el.shape));
  const allIcons =
    boxedSel.length > 0 && boxedSel.every((el) => el.type === 'shape' && el.shape === 'icon');
  const chartSrc = allCharts ? (boxedSel[0] as ShapeElement) : undefined;
  const iconSrc = allIcons ? (boxedSel[0] as ShapeElement) : undefined;
  return (
    <>
      {/* Animation (spec/09) — applies to every boxed member of the
          selection. */}
      {part === 'motion' && boxedSel.length ? (
        <MenuAccordionSection
          title={bothAnimated ? 'Shape Animation' : 'Animation'}
          icon={<AnimationMenuGlyph />}
          {...sectionProps('m-animation')}
        >
          {chartSrc ? (
            <PieAnimTiles
              anim={chartSrc.pieAnim ?? null}
              speed={chartSrc.pieAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
              repeat={animLoops(chartSrc.pieAnim, chartSrc.pieAnimRepeat, PIE_LOOPING_ANIMS)}
              onSet={props.onSetPieAnim}
              onSetSpeed={props.onSetPieAnimSpeed}
              onSetRepeat={props.onSetPieAnimRepeat}
            />
          ) : iconSrc ? (
            <IconAnimationTiles
              animation={iconSrc.iconAnimation ?? null}
              speed={iconSrc.iconAnimationSpeed ?? DEFAULT_ANIMATION_SPEED}
              repeat={iconSrc.iconAnimationRepeat ?? true}
              onSet={props.onSetIconAnimation}
              onSetSpeed={props.onSetIconAnimationSpeed}
              onSetRepeat={props.onSetIconAnimationRepeat}
              onPreview={props.onPreviewIconAnimation}
              onPreviewEnd={props.onAnimationPreviewEnd}
            />
          ) : (
            <AnimationTiles
              animation={boxedSel[0]!.animation ?? null}
              speed={boxedSel[0]!.animationSpeed ?? DEFAULT_ANIMATION_SPEED}
              repeat={boxedSel[0]!.animationRepeat ?? true}
              onSet={props.onSetAnimation}
              onSetSpeed={props.onSetAnimationSpeed}
              onSetRepeat={props.onSetAnimationRepeat}
              onPreview={props.onPreviewAnimation}
              onPreviewEnd={props.onAnimationPreviewEnd}
            />
          )}
        </MenuAccordionSection>
      ) : null}
      {part === 'motion' && arrowSrc ? (
        <MenuAccordionSection
          title={bothAnimated ? 'Arrow Animation' : 'Animation'}
          icon={<AnimationMenuGlyph />}
          {...sectionProps('m-flow')}
        >
          <FlowTiles
            flow={arrowSrc.flow ?? null}
            speed={arrowSrc.flowSpeed ?? DEFAULT_ANIMATION_SPEED}
            repeat={arrowSrc.flowRepeat ?? true}
            onSet={props.onSetArrowFlow}
            onSetSpeed={props.onSetFlowSpeed}
            onSetRepeat={props.onSetFlowRepeat}
            onPreview={props.onPreviewArrowFlow}
            onPreviewEnd={props.onAnimationPreviewEnd}
          />
        </MenuAccordionSection>
      ) : null}
      {part === 'style' && colourable ? (
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
      ) : null}
      {part === 'style' && borderableSel ? (
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
            {radiusSrc ? (
              <BorderGrid label="Radius" cols={5}>
                {BORDER_RADII.map((v) => (
                  <SizeButton
                    key={v}
                    active={(radiusSrc.borderRadius ?? 'sm') === v}
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
      ) : null}
      {/* Shadow (spec/86) — presets + sliders, selection-wide like Border.
          Reads off the first shadow-supporting member. */}
      {part === 'style' && shadowSrc ? (
        <ShadowSection
          shadow={shadowSrc.shadow}
          section={sectionProps('m-shadow')}
          onSetShadow={props.onSetShadow}
          onCommitPreset={props.onCommitShadow}
          onPreviewPreset={props.onPreviewShadow}
          onPreviewEnd={props.onPreviewStyleEnd}
        />
      ) : null}
      {/* Icon — a Technology icon's fixed tile size (spec/41), when
          the selection holds any; applies to every tech icon in it. */}
      {part === 'motion' && techIconSrc ? (
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
