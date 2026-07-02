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

import { onMouseHover } from '@/components/primitives/hover-preview';
import {
  DEFAULT_ICON_SIZE,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  isBoxed,
  isChartShape,
  isLineShape,
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
  type IconSize,
  type TextAlignX,
  type TextAlignY,
} from '@livediagram/diagram';
import { ContextMenuDivider } from '@/components/palette/ContextMenu';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
} from '@/components/palette/palette-icons';
import {
  BorderGlyph,
  IconCategoryGlyph,
  PaletteMenuIcon,
  RemoveIconGlyph,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
  MenuGroupSeparator,
  MenuTile,
} from '@/components/primitives/PortalMenu';

import { IconSizeTiles } from '@/components/palette/context-menu-tiles';
import { isTechIconId } from '@/lib/tech-icons';
import { AlignIcon as AlignLinesIcon } from '@/components/canvas/table-icons';
import { AlignmentGrid } from '@/components/palette/palette-controls';
import {
  ArrowPresetsSection,
  ShapePresetsSection,
  shapeSupportsPresets,
} from '@/components/palette/PresetSections';
import {
  BorderGrid,
  ColourRow,
  IconPositionGrid,
  MarkersMenuGlyph,
  MarkerTiles,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';
import { ElementDataSections } from './ElementDataSections';

import { BORDER_RADII, BORDER_STROKES, BORDER_STYLES } from './context-menu-constants';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The element menu's appearance group: type-specific style sections — Presets,
// Progress / Rail / Rating, Animation, Colours, Border, Data / Chart. Derives
// its own type flags off `target` and shares the accordion + colour
// scaffolding via props. Split out of EditorContextMenu.
type ElementAppearanceSectionsProps = {
  props: EditorContextMenuProps;
  target: EditorContextMenuProps['elements'][number];
  onClose: () => void;
  sectionProps: Scaffold['sectionProps'];
  colorProps: Scaffold['colorProps'];
  textColorHandlers: Scaffold['textColorHandlers'];
  fillColorHandlers: Scaffold['fillColorHandlers'];
  strokeColorHandlers: Scaffold['strokeColorHandlers'];
};

export function ElementAppearanceSections({
  props,
  target,
  onClose,
  sectionProps,
  colorProps,
  textColorHandlers,
  fillColorHandlers,
  strokeColorHandlers,
}: ElementAppearanceSectionsProps) {
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
  const isProgress = target.type === 'shape' && isProgressShape(target.shape);
  const isRail = target.type === 'shape' && isRailShape(target.shape);
  const isRating = target.type === 'shape' && isRatingShape(target.shape);
  const isChart = target.type === 'shape' && isChartShape(target.shape);
  const isLine = target.type === 'shape' && isLineShape(target.shape);
  // The Text band (spec/09): Markers + Alignment. Markers are regular-shape
  // only (self-drawing shapes have no label slot); Alignment applies to any
  // boxed element with a text slot.
  const showMarkers = target.type === 'shape' && !isProgress && !isRail && !isRating && !isChart;
  const showAlignment =
    boxed &&
    target.type !== 'image' &&
    !(target.type === 'shape' && isSelfDrawingShape(target.shape));
  // The shape-only sections below (Marker / Progress / Rail / Rating / Data)
  // all render under a `target.type === 'shape'` guard, so this is non-null
  // wherever they read it — `shapeTarget?.field ?? default` reads the shape
  // fields without an `as ShapeElement` assertion at each site.
  const shapeTarget = target.type === 'shape' ? target : null;
  // The appearance group's divider shows whenever any appearance section will
  // render — boxed elements (shapes / freehand / tables / images) and arrows.
  const showAppearanceGroup = boxed || target.type === 'arrow';
  return (
    <>
      {showAppearanceGroup ? <MenuGroupSeparator /> : null}
      {/* Presets (spec/48) — pinned at the top of the appearance group (above
            Animation). Regular shapes only (icon glyph / charts excluded, see
            shapeSupportsPresets); arrows get their own line-look presets. Both
            share the PresetSections components with the multi-selection menu. */}
      {shapeSupportsPresets(target) ? (
        <ShapePresetsSection
          shape={target.shape}
          current={{
            fillColor: target.fillColor,
            strokeColor: target.strokeColor,
            textColor: target.textColor,
            colorPreset: target.colorPreset,
          }}
          props={props}
          accordion={sectionProps('presets')}
          onClose={onClose}
        />
      ) : null}
      {target.type === 'arrow' ? (
        <ArrowPresetsSection
          current={{ strokeStyle: target.strokeStyle, flow: target.flow }}
          props={props}
          accordion={sectionProps('presets')}
          onClose={onClose}
        />
      ) : null}
      <ElementDataSections
        props={props}
        target={target}
        isProgress={isProgress}
        isRail={isRail}
        isRating={isRating}
        isChart={isChart}
        isLine={isLine}
        isIcon={isIcon}
        boxed={boxed}
        sectionProps={sectionProps}
      />
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
      {/* Icon — a Technology icon element's fixed tile size (spec/41).
            The mark renders at a preset pixel size regardless of the box;
            these tiles pick the preset. */}
      {isIcon && isTechIconId((target as { iconId?: string }).iconId) ? (
        <>
          <MenuGroupSeparator />
          <MenuAccordionSection
            title="Icon"
            icon={<IconCategoryGlyph />}
            {...sectionProps('icon-size')}
          >
            <IconSizeTiles
              value={(target as { iconSize?: IconSize }).iconSize ?? DEFAULT_ICON_SIZE}
              onSet={props.onSetIconSize}
            />
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
          <MenuAccordionSection title="Icon" icon={<IconCategoryGlyph />} {...sectionProps('icon')}>
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
      {/* ── Text band (spec/09): Markers (spec/49) + Alignment, between the
            Style band and the content / collaborate groups. ── */}
      {showMarkers || showAlignment ? <MenuGroupSeparator /> : null}
      {showMarkers ? (
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
      ) : null}
      {/* Alignment — the text toolbar's 3×3 grid, here too for discovery. */}
      {showAlignment ? (
        <MenuAccordionSection
          title="Text Alignment"
          icon={
            <AlignLinesIcon dir={(target as { textAlignX?: TextAlignX }).textAlignX ?? 'center'} />
          }
          {...sectionProps('text-align')}
        >
          <div className="px-2 py-1.5">
            <AlignmentGrid
              alignX={(target as { textAlignX?: TextAlignX }).textAlignX ?? 'center'}
              alignY={(target as { textAlignY?: TextAlignY }).textAlignY ?? 'middle'}
              onChange={props.onSetTextAlign}
            />
          </div>
        </MenuAccordionSection>
      ) : null}
      {/* ── Content group: Line / Pointer / Text / Icon / Image / Table / Link ── */}
    </>
  );
}
