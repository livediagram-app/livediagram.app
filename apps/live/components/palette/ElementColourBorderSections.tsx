'use client';

// The element context menu's Colours + Border accordions, split out of
// ElementAppearanceSections: the text / background / border colour rows
// with Reset-to-theme, and the border strength / pattern / radius grids
// with their hover previews. Shares the host's accordion + colour
// scaffolding via props like the sibling section files.

import { onMouseHover } from '@/components/primitives/hover-preview';
import {
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  supportsBorderRadius,
  supportsColours,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
} from '@livediagram/diagram';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
} from '@/components/palette/palette-icons';
import { BorderGlyph, PaletteMenuIcon } from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuActionButton } from '@/components/primitives/PortalMenu';
import { isTechIconId } from '@/lib/tech-icons';
import { BorderGrid, ColourRow } from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';
import { BORDER_RADII, BORDER_STROKES, BORDER_STYLES } from './context-menu-constants';

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
  strokeColorHandlers: Scaffold['strokeColorHandlers'];
}) {
  const borderStrokeVal: BorderStroke =
    (target as { strokeWidth?: BorderStroke }).strokeWidth ??
    (target.type === 'table' ? 'thin' : 'medium');
  const borderStyleVal: BorderStyle =
    (target as { strokeStyle?: BorderStyle }).strokeStyle ?? 'solid';
  const borderRadiusVal: BorderRadius =
    (target as { borderRadius?: BorderRadius }).borderRadius ?? 'sm';
  return (
    <>
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
            {/* Stroke swatch: hidden for Technology icons (the brand mark
                  carries fixed colours, so strokeColor paints nothing) and
                  relabelled "Icon" for line-art icons, whose stroke is the
                  glyph tint rather than a border. */}
            {defaultStrokeColor(target as BoxedElement) !== 'transparent' &&
            !(isIcon && isTechIconId((target as { iconId?: string }).iconId)) ? (
              <ColourRow
                label={isIcon ? 'Icon' : 'Border'}
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
    </>
  );
}
