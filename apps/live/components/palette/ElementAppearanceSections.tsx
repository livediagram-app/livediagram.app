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

import {
  DEFAULT_ICON_SIZE,
  defaultPadding,
  isBoxed,
  isChartShape,
  isLineShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
  isSelfDrawingShape,
  supportsBorderControls,
  supportsColours,
  type IconSize,
  type Padding,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { ContextMenuDivider } from '@/components/palette/ContextMenu';
import {
  IconCategoryGlyph,
  RemoveIconGlyph,
  StyleMenuGlyph,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
} from '@/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { TypographySections } from './TypographySections';

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
  IconPositionGrid,
  MarkersMenuGlyph,
  MarkerTiles,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';
import { ElementDataSections } from './ElementDataSections';
import { ElementColourBorderSections } from './ElementColourBorderSections';

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
  flyoutProps: Scaffold['flyoutProps'];
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
  flyoutProps,
  colorProps,
  textColorHandlers,
  fillColorHandlers,
  strokeColorHandlers,
}: ElementAppearanceSectionsProps) {
  const boxed = isBoxed(target);
  const isIcon = target.type === 'shape' && target.shape === 'icon';
  // Border controls apply only where a wrapper border actually renders
  // (shapes / freehand / tables — supportsBorderControls excludes icons,
  // the actor, and the self-drawing data shapes, whose controls were dead).
  const borderable = supportsBorderControls(target);
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
  // Markers decorate the LABEL (spec/49), so the category only shows once
  // the element actually has text — or while its text is being TYPED: in
  // edit mode the label is still uncommitted (text commits on blur), and
  // the menu riding alongside the editor (spec/09) must offer the text
  // options for the words on screen, not the empty committed label.
  const hasText =
    ((target as { label?: string }).label ?? '').trim().length > 0 || props.editingId === target.id;
  const showMarkers =
    target.type === 'shape' && !isProgress && !isRail && !isRating && !isChart && hasText;
  // Like Markers, Text Alignment only shows once there's text to align.
  const showAlignment =
    boxed &&
    target.type !== 'image' &&
    !(target.type === 'shape' && isSelfDrawingShape(target.shape)) &&
    hasText;
  // The shape-only sections below (Marker / Progress / Rail / Rating / Data)
  // all render under a `target.type === 'shape'` guard, so this is non-null
  // wherever they read it — `shapeTarget?.field ?? default` reads the shape
  // fields without an `as ShapeElement` assertion at each site.
  const shapeTarget = target.type === 'shape' ? target : null;
  // The appearance group's divider shows whenever any appearance section will
  // render — boxed elements (shapes / freehand / tables / images) and arrows.
  const showAppearanceGroup = boxed || target.type === 'arrow';
  // The Style flyout shows when any of its children would: presets
  // (shapes with looks / arrow line looks), Colours, or Border — the
  // same gates the sections carry inside.
  const showStyle =
    shapeSupportsPresets(target) ||
    target.type === 'arrow' ||
    (boxed && supportsColours(target) && !isChart) ||
    (borderable && !isChart);
  return (
    <>
      {showAppearanceGroup ? <MenuGroupSeparator /> : null}
      {/* ── Style band (spec/09): Presets (spec/48) + Colours + Border,
            grouped under one "Style" row that opens them in a side flyout —
            the same fold the Text band uses — so the three style categories
            take one slot in the menu's vertical stack. Inside the flyout
            they're the same collapsible sections as before (shared with the
            multi-selection menu, which still stacks them inline), all
            starting closed. ── */}
      {showStyle ? (
        <MenuFlyoutSection title="Style" icon={<StyleMenuGlyph />} {...flyoutProps('style')}>
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
          {/* Colours + Border accordions — see ElementColourBorderSections. */}
          <ElementColourBorderSections
            props={props}
            target={target}
            boxed={boxed}
            isIcon={isIcon}
            isChart={isChart}
            borderable={borderable}
            onClose={onClose}
            sectionProps={sectionProps}
            colorProps={colorProps}
            textColorHandlers={textColorHandlers}
            fillColorHandlers={fillColorHandlers}
            strokeColorHandlers={strokeColorHandlers}
          />
        </MenuFlyoutSection>
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
        flyoutProps={flyoutProps}
      />
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
              onPreview={props.onPreviewIconSize}
              onPreviewEnd={props.onPreviewStyleEnd}
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
              onPreview={(pos) =>
                props.onPreviewIconPosition(
                  target.id,
                  (target as { iconId?: string }).iconId ?? '',
                  pos,
                )
              }
              onPreviewEnd={props.onPreviewStyleEnd}
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
      {/* ── Text band (spec/09): every text control for the element —
            typography (Font / Size / Padding / Alignment) plus Markers
            (spec/49) — grouped under one "Text" row that opens them in a side
            flyout, so they don't lengthen the menu's vertical stack. The row
            only shows when the element has text (showMarkers / showAlignment
            both require a non-empty label). Sub-categories all start closed:
            auto-expanding the first one flipped the shared one-open-section
            scaffold, collapsing whichever inline accordion the user had open
            in the host menu behind the flyout. Sits in the style band
            (no separator of its own), beside Style + Animation. ── */}
      {showMarkers || showAlignment ? (
        <MenuFlyoutSection title="Text" icon={<TextGlyph />} {...flyoutProps('text')}>
          {/* Typography — Font / Size / Padding, shared with the rich-text
              toolbar's overflow menu. Applies to the element's whole label. */}
          {showAlignment ? (
            <TypographySections
              currentFont={(target as { font?: string }).font ?? null}
              currentSize={(target as { textSize?: TextSize }).textSize ?? 'sm'}
              padding={(target as { padding?: Padding }).padding ?? defaultPadding(target)}
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
          {/* Alignment — the text toolbar's 3×3 grid, here too for discovery. */}
          {showAlignment ? (
            <MenuAccordionSection
              title="Alignment"
              icon={
                <AlignLinesIcon
                  dir={(target as { textAlignX?: TextAlignX }).textAlignX ?? 'center'}
                />
              }
              {...sectionProps('text-align')}
            >
              <div className="px-2 py-1.5">
                <AlignmentGrid
                  alignX={(target as { textAlignX?: TextAlignX }).textAlignX ?? 'center'}
                  alignY={(target as { textAlignY?: TextAlignY }).textAlignY ?? 'middle'}
                  onChange={props.onSetTextAlign}
                  onPreview={props.onPreviewTextAlign}
                  onPreviewEnd={props.onPreviewStyleEnd}
                />
              </div>
            </MenuAccordionSection>
          ) : null}
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
                onPreview={props.onPreviewMarker}
                onPreviewSize={props.onPreviewMarkerSize}
                onPreviewEnd={props.onPreviewStyleEnd}
              />
            </MenuAccordionSection>
          ) : null}
        </MenuFlyoutSection>
      ) : null}
      {/* ── Content group: Line / Pointer / Text / Icon / Image / Table / Link ── */}
    </>
  );
}
