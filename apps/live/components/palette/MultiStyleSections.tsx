import {
  BorderColourIcon,
  FillColourIcon,
  TextColourIcon,
} from '@/components/palette/context-menu-icons';
import {
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultStrokeColor,
  DEFAULT_ICON_WEIGHT,
  defaultTextColor,
  shownBorderRadius,
  type ArrowElement,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type ElementShadow,
  type ShapeElement,
} from '@livediagram/document';
import { isTechIconId } from '@/lib/tech-icons';
import {
  BorderGlyph,
  IconCategoryGlyph,
  PaletteMenuIcon,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuActionButton } from '@/components/primitives/PortalMenu';
import { IconSizeTiles, IconWeightTiles } from '@/components/palette/context-menu-tiles';
import { ColourRow } from '@/components/palette/context-menu-rows';
import { AnimationSections } from '@/components/palette/AnimationSections';
import { ShadowSection } from '@/components/palette/ShadowSection';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';
import { BorderControls } from '@/components/palette/BorderControls';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { inkSwatch, shownColour } from '@/components/palette/ink-row';

// The multi-selection menu's style + motion sections (docs/specs/008-canvas/canvas-and-palette.md), each
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
  colourable: boolean;
  textSrc: Element | undefined;
  fillSrc: BoxedElement | undefined;
  strokeSrc: BoxedElement | undefined;
  borderableSel: boolean;
  borderSrc: { strokeWidth?: BorderStroke; strokeStyle?: BorderStyle; type: string } | undefined;
  // First member whose kind rounds corners — gates + feeds the Radius
  // grid, mirroring the single menu's supportsBorderRadius branch.
  radiusSrc: ShapeElement | undefined;
  // First shadow-supporting member (docs/specs/008-canvas/element-shadows.md) — gates + feeds the Shadow
  // section, mirroring the single menu's supportsShadow branch.
  shadowSrc: { shadow?: ElementShadow } | undefined;
  techIconSrc: ShapeElement | undefined;
  onClose: () => void;
}) {
  const { sectionProps, colorProps, textColorHandlers, fillColorHandlers, strokeColorHandlers } =
    scaffold;
  // As in the single-element menu: a swatch reads the canvas's ink for any
  // element that carries no colour of its own (docs/specs/007-editor/live-app.md).
  const surface = useCanvasSurface();
  // First line-art icon: gates + feeds the Weight row, which applies to every line-art icon.
  const lineIconSrc = boxedSel.find(
    (el): el is ShapeElement =>
      el.type === 'shape' && el.shape === 'icon' && !isTechIconId(el.iconId),
  );
  return (
    <>
      {/* Animation (docs/specs/028-animation/element-animations.md): one category per animation set in
          the selection, each applying to that set's members only. */}
      {part === 'motion' ? (
        <AnimationSections
          elements={arrowSrc ? [...boxedSel, arrowSrc] : boxedSel}
          keyPrefix="m-"
          sectionProps={sectionProps}
          flyoutProps={scaffold.flyoutProps}
          handlers={props}
        />
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
              icon={<TextColourIcon />}
              value={shownColour(
                textSrc,
                'text',
                surface,
                defaultTextColor(textSrc as BoxedElement, surface),
              )}
              ink={inkSwatch(textSrc, 'text', surface)}
              {...textColorHandlers}
              {...colorProps('m-text')}
              {...props.colourPalette}
            />
          ) : null}
          {fillSrc ? (
            <ColourRow
              label="Background"
              icon={<FillColourIcon />}
              value={fillSrc.fillColor ?? defaultFillColor(fillSrc, surface)}
              {...fillColorHandlers}
              {...colorProps('m-bg')}
              {...props.colourPalette}
            />
          ) : null}
          {strokeSrc ? (
            <ColourRow
              label="Border"
              icon={<BorderColourIcon />}
              value={shownColour(
                strokeSrc,
                'line',
                surface,
                defaultStrokeColor(strokeSrc, surface),
              )}
              ink={inkSwatch(strokeSrc, 'line', surface)}
              {...strokeColorHandlers}
              {...colorProps('m-border')}
              {...props.colourPalette}
            />
          ) : arrowSrc ? (
            // Arrow-only selection: no boxed stroke member, so the stroke
            // setter surfaces as the arrows' Line swatch (same control the
            // single-arrow menu shows). Mixed selections use the Border row
            // above — its setter recolours the arrows too.
            <ColourRow
              label="Line"
              icon={<BorderColourIcon />}
              value={shownColour(arrowSrc, 'line', surface, defaultArrowStrokeColor(surface))}
              ink={inkSwatch(arrowSrc, 'line', surface)}
              {...strokeColorHandlers}
              {...colorProps('m-border')}
              {...props.colourPalette}
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
          <BorderControls
            strokeWidth={borderSrc?.strokeWidth ?? 'medium'}
            strokeStyle={borderSrc?.strokeStyle ?? 'solid'}
            radius={radiusSrc ? shownBorderRadius(radiusSrc) : null}
            onCommitBorderStroke={props.onCommitBorderStroke}
            onPreviewBorderStroke={props.onPreviewBorderStroke}
            onCommitBorderStyle={props.onCommitBorderStyle}
            onPreviewBorderStyle={props.onPreviewBorderStyle}
            onCommitBorderRadius={props.onCommitBorderRadius}
            onPreviewBorderRadius={props.onPreviewBorderRadius}
            onPreviewStyleEnd={props.onPreviewStyleEnd}
          />
        </MenuAccordionSection>
      ) : null}
      {/* Shadow (docs/specs/008-canvas/element-shadows.md) — presets + sliders, selection-wide like Border.
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
      {/* Icon — a Technology icon's fixed tile size (docs/specs/010-palette/technology-icons.md), when
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
      {/* Weight — every line-art icon in the selection (docs/specs/004-interface-design/iconography.md). */}
      {part === 'motion' && lineIconSrc ? (
        <MenuAccordionSection
          title="Weight"
          icon={<IconCategoryGlyph />}
          {...sectionProps('m-icon-weight')}
        >
          <IconWeightTiles
            iconId={lineIconSrc.iconId}
            value={lineIconSrc.iconWeight ?? DEFAULT_ICON_WEIGHT}
            onSet={props.onSetIconWeight}
            onPreview={props.onPreviewIconWeight}
            onPreviewEnd={props.onPreviewStyleEnd}
          />
        </MenuAccordionSection>
      ) : null}
    </>
  );
}
