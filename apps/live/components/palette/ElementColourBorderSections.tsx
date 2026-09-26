'use client';

// The element context menu's Colours + Border accordions, split out of
// ElementAppearanceSections: the text / background / border colour rows
// with Reset-to-theme, and the border strength / pattern / radius grids
// with their hover previews. Shares the host's accordion + colour
// scaffolding via props like the sibling section files.

import {
  BorderColourIcon,
  FillColourIcon,
  HeadingColourIcon,
  PointerColourIcon,
  TextColourIcon,
} from '@/components/palette/context-menu-icons';
import {
  defaultArrowStrokeColor,
  defaultFillColor,
  hasHeadingBand,
  supportsFillColor,
  defaultStrokeColor,
  defaultTextColor,
  supportsBorderRadius,
  supportsColours,
  supportsShadow,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type ElementShadow,
} from '@livediagram/diagram';
import { BorderGlyph, PaletteMenuIcon } from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuActionButton } from '@/components/primitives/PortalMenu';
import { isTechIconId } from '@/lib/tech-icons';
import { ColourRow } from '@/components/palette/context-menu-rows';
import { BorderControls } from '@/components/palette/BorderControls';
import { ShadowSection } from '@/components/palette/ShadowSection';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

export function ElementColourBorderSections({
  props,
  target,
  boxed,
  isIcon,
  isChart,
  borderable,
  onClose,
  sectionProps,
  colorProps,
  textColorHandlers,
  fillColorHandlers,
  headerFillHandlers,
  arrowheadColorHandlers,
  strokeColorHandlers,
}: {
  props: EditorContextMenuProps;
  target: EditorContextMenuProps['elements'][number];
  boxed: boolean;
  isIcon: boolean;
  isChart: boolean;
  borderable: boolean;
  onClose: () => void;
  sectionProps: Scaffold['sectionProps'];
  colorProps: Scaffold['colorProps'];
  textColorHandlers: Scaffold['textColorHandlers'];
  fillColorHandlers: Scaffold['fillColorHandlers'];
  headerFillHandlers: Scaffold['headerFillHandlers'];
  arrowheadColorHandlers: Scaffold['arrowheadColorHandlers'];
  strokeColorHandlers: Scaffold['strokeColorHandlers'];
}) {
  // A swatch shows the colour the element is ACTUALLY drawn in, so an element
  // that carries no colour of its own must read the canvas's ink here too
  // (docs/specs/007-editor/live-app.md) — otherwise the menu offers a light-canvas blue beside a grey
  // shape.
  const surface = useCanvasSurface();
  const borderStrokeVal: BorderStroke =
    (target as { strokeWidth?: BorderStroke }).strokeWidth ??
    (target.type === 'table' ? 'thin' : 'medium');
  const borderStyleVal: BorderStyle =
    (target as { strokeStyle?: BorderStyle }).strokeStyle ?? 'solid';
  const borderRadiusVal: BorderRadius =
    (target as { borderRadius?: BorderRadius }).borderRadius ?? 'sm';
  return (
    <>
      {/* Arrow Colours: the line colour swatch. Arrows lived in the old
          editor side panel's Colours accordion via their strokeColor; the
          menu rewrite gated Colours on `boxed`, silently dropping them —
          this restores the control (label colour stays in the content Text
          section, which needs a label to exist). */}
      {target.type === 'arrow' ? (
        <MenuAccordionSection
          title="Colours"
          icon={<PaletteMenuIcon />}
          {...sectionProps('colours')}
        >
          <ColourRow
            label="Line"
            icon={<BorderColourIcon />}
            value={target.strokeColor ?? defaultArrowStrokeColor(surface)}
            {...strokeColorHandlers}
            {...colorProps('border')}
            {...props.colourPalette}
          />
          {/* The heads, separately from the line: a grey connector with a red
              head is one arrow saying two things, and doing it with a second
              element would break the moment either end moved. Unset means the
              heads take the line's colour, as they always have. */}
          <ColourRow
            label="Pointer"
            icon={<PointerColourIcon />}
            value={target.arrowheadColor ?? target.strokeColor ?? defaultArrowStrokeColor(surface)}
            {...arrowheadColorHandlers}
            {...colorProps('pointer')}
            {...props.colourPalette}
          />
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
      {boxed && supportsColours(target) && !isChart ? (
        <>
          <MenuAccordionSection
            title="Colours"
            icon={<PaletteMenuIcon />}
            {...sectionProps('colours')}
          >
            <ColourRow
              label="Text"
              icon={<TextColourIcon />}
              value={
                (target as { textColor?: string }).textColor ??
                defaultTextColor(target as BoxedElement, surface)
              }
              {...textColorHandlers}
              {...colorProps('text')}
              {...props.colourPalette}
            />
            {supportsFillColor(target) ? (
              <ColourRow
                label="Background"
                icon={<FillColourIcon />}
                value={
                  (target as { fillColor?: string }).fillColor ??
                  defaultFillColor(target as BoxedElement, surface)
                }
                {...fillColorHandlers}
                {...colorProps('background')}
                {...props.colourPalette}
              />
            ) : null}
            {/* Heading band: only for the elements that have one distinct
                from their body (a lane's title gutter, a table's header
                row). Unset falls back to each one's historical default, so
                the row reads as empty until you choose. */}
            {hasHeadingBand(target) ? (
              <ColourRow
                label="Heading"
                icon={<HeadingColourIcon />}
                value={(target as { headerFill?: string }).headerFill ?? 'transparent'}
                {...headerFillHandlers}
                {...colorProps('heading')}
                {...props.colourPalette}
              />
            ) : null}
            {/* Stroke swatch: hidden for Technology icons (the brand mark
                  carries fixed colours, so strokeColor paints nothing) and
                  relabelled "Icon" for line-art icons, whose stroke is the
                  glyph tint rather than a border. */}
            {defaultStrokeColor(target as BoxedElement) !== 'transparent' &&
            !(isIcon && isTechIconId((target as { iconId?: string }).iconId)) ? (
              <ColourRow
                label={isIcon ? 'Icon' : 'Border'}
                icon={<BorderColourIcon />}
                value={
                  (target as { strokeColor?: string }).strokeColor ??
                  defaultStrokeColor(target as BoxedElement, surface)
                }
                {...strokeColorHandlers}
                {...colorProps('border')}
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
        </>
      ) : null}
      {/* Border — strength / pattern / radius. Pie charts have no box border
            to style, so they're excluded. */}
      {borderable && !isChart ? (
        <>
          <MenuAccordionSection title="Border" icon={<BorderGlyph />} {...sectionProps('border')}>
            <BorderControls
              strokeWidth={borderStrokeVal}
              strokeStyle={borderStyleVal}
              radius={supportsBorderRadius(target) ? borderRadiusVal : null}
              onCommitBorderStroke={props.onCommitBorderStroke}
              onPreviewBorderStroke={props.onPreviewBorderStroke}
              onCommitBorderStyle={props.onCommitBorderStyle}
              onPreviewBorderStyle={props.onPreviewBorderStyle}
              onCommitBorderRadius={props.onCommitBorderRadius}
              onPreviewBorderRadius={props.onPreviewBorderRadius}
              onPreviewStyleEnd={props.onPreviewStyleEnd}
            />
          </MenuAccordionSection>
        </>
      ) : null}
      {/* Shadow (docs/specs/008-canvas/element-shadows.md) — presets + sliders, for the body-drawing boxed
          types. Sits after Border in the style band. */}
      {supportsShadow(target) ? (
        <ShadowSection
          shadow={(target as { shadow?: ElementShadow }).shadow}
          section={sectionProps('shadow')}
          onSetShadow={props.onSetShadow}
          onCommitPreset={props.onCommitShadow}
          onPreviewPreset={props.onPreviewShadow}
          onPreviewEnd={props.onPreviewStyleEnd}
        />
      ) : null}
    </>
  );
}
