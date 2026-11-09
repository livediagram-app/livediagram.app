import {
  supportsFillColor,
  defaultPadding,
  defaultStrokeColor,
  isBoxed,
  isRetiredElement,
  isSelfDrawingShape,
  supportsMarkers,
  supportsTextAlign,
  supportsBorderControls,
  supportsBorderRadius,
  supportsColours,
  supportsShadow,
  type BorderStroke,
  type BorderStyle,
  type ElementShadow,
  type Padding,
  type ShapeElement,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livehuddle/document';
import { isTechIconId } from '@liveworkspace/workbench/lib/tech-icons';
import { AlignIcon as AlignLinesIcon } from '@liveworkspace/workbench/components/canvas/table-icons';
import { AlignmentGrid } from '@/components/palette/palette-controls';
import { ContextMenu } from '@liveworkspace/workbench/components/palette/ContextMenu';
import { StyleMenuGlyph, TextGlyph } from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { MarkersMenuGlyph, MarkerTiles } from '@/components/palette/context-menu-rows';
import { presetPxFor } from '@/components/palette/TextSizeControl';
import { TypographySections } from './TypographySections';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { ShapePresetsSection, shapeSupportsPresets } from './PresetSections';
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
// (Animation / Colours / Border + Text) that apply to
// every matching member of a marquee selection. Extracted from
// EditorContextMenu; shares the accordion/colour scaffolding via the hook.
export function MultiSelectionContextMenu({
  props,
  position,
  onClose,
  anchorBottom,
}: MultiSelectionContextMenuProps) {
  const scaffold = useContextMenuScaffold(props);
  const { sectionProps, flyoutProps } = scaffold;
  // The selection toolbar carries Duplicate / Group / Export /
  // Delete, so this menu is purely the type-aware formatting categories
  // its ellipsis opens. It always renders: the placement band (Layer /
  // opacity / Rotation) applies to every element kind — an image-only
  // marquee used to get NO menu at all, which read as broken.
  if (props.selectionElements.length === 0) return null;
  return (
    <ContextMenu
      position={position}
      label="Selection menu"
      onClose={onClose}
      flush
      anchorBottom={anchorBottom}
    >
      {(() => {
        // Type-aware formatting for the whole selection: only the categories
        // that match the selected element types show, and each control
        // applies to every matching member (the setters are selection-wide).
        // Display values read off the first matching member.
        const all = props.selectionElements;
        const allBoxed = all.filter(isBoxed);
        // A retired member (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") moves, turns and
        // reorders with the rest, so the placement band takes it, but it keeps its stored look and kind: the
        // formatting sections read and write only the members livehuddle still has.
        const sel = all.filter((el) => !isRetiredElement(el));
        const boxedSel = sel.filter(isBoxed);
        // Presets (docs/specs/010-palette/style-presets.md) apply selection-wide, to every preset-eligible
        // shape. The active-tile highlight reads off the first matching member.
        const presetShapeSrc = sel.find(shapeSupportsPresets);
        // Colour swatches show for the members whose SINGLE menus would
        // show Colours: boxed and colour-supporting.
        const colourSrcs = boxedSel.filter((el) => supportsColours(el));
        const colourable = colourSrcs.length > 0;
        const textSrc = colourSrcs[0];
        const fillSrc = colourSrcs.find((el) => supportsFillColor(el));
        const strokeSrc = colourSrcs.find((el) => defaultStrokeColor(el) !== 'transparent');
        const borderableSel = sel.some((el) => supportsBorderControls(el));
        const borderSrc = sel.find((el) => supportsBorderControls(el)) as
          { strokeWidth?: BorderStroke; strokeStyle?: BorderStyle; type: string } | undefined;
        const radiusSrc = sel.find((el) => supportsBorderRadius(el));
        // Shadow (docs/specs/008-canvas/element-shadows.md): the section shows when any member supports it;
        // the sliders/active-tile read off the first such member, and the
        // setters apply selection-wide (unsupported members no-op).
        const shadowSrc = sel.find((el) => supportsShadow(el)) as
          { shadow?: ElementShadow } | undefined;
        // Same grouping as the single-element menu: placement (Layer / Shape
        // / Rotation) then appearance (Presets / Animation / Colours / Border /
        // Icon / Markers / Alignment). Image / Link / Note / Comments stay excluded: those are
        // per-element identity or content, not formatting.
        // Menu parity with the single-element menu (docs/specs/008-canvas/canvas-and-palette.md): everything you
        // can restyle on ONE element works on a selection / group too. Each
        // section reads its display value off the first matching member and
        // writes selection-wide (the setters already are).
        const morphable = boxedSel.filter(
          (el) => el.type === 'shape' && el.shape !== 'icon' && !isSelfDrawingShape(el.shape),
        ) as ShapeElement[];
        const markerSrc = boxedSel.find(
          (el) =>
            el.type === 'shape' &&
            supportsMarkers(el.shape) &&
            // Markers decorate the label (docs/specs/009-elements/shape-markers.md): only offer them when a
            // member actually has text.
            (el.label ?? '').trim().length > 0,
        ) as ShapeElement | undefined;
        const techIconSrc = boxedSel.find(
          (el) => el.type === 'shape' && el.shape === 'icon' && isTechIconId(el.iconId),
        ) as ShapeElement | undefined;
        const alignSrc = boxedSel.find(
          (el) =>
            el.type !== 'image' &&
            !(el.type === 'shape' && !supportsTextAlign(el.shape)) &&
            // Only offer alignment when a member actually has text.
            ((el as { label?: string }).label ?? '').trim().length > 0,
        );
        // The Style flyout shows when any of its children would — the
        // preset sections, Colours, or Border (docs/specs/008-canvas/canvas-and-palette.md, mirroring the
        // single-element menu's Style band).
        const showStyleFlyout = !!presetShapeSrc || colourable || borderableSel;
        // The Text flyout groups Typography (Font / Size / Padding) +
        // Alignment + Markers, mirroring the single-element menu.
        const showTextFlyout = !!markerSrc || !!alignSrc;
        return (
          <>
            {/* Placement group (Layer / Shape / Rotation) — see
                  MultiPlacementSections. */}
            <MultiPlacementSections
              props={props}
              sel={all}
              boxedSel={allBoxed}
              morphable={morphable}
              sectionProps={sectionProps}
              onClose={onClose}
            />
            <MenuGroupSeparator />
            {/* ── Style band (docs/specs/008-canvas/canvas-and-palette.md): Presets + Colours + Border behind one
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
                  />
                ) : null}
                <MultiStyleSections
                  part="style"
                  props={props}
                  scaffold={scaffold}
                  boxedSel={boxedSel}
                  colourable={colourable}
                  textSrc={textSrc}
                  fillSrc={fillSrc}
                  strokeSrc={strokeSrc}
                  borderableSel={borderableSel}
                  borderSrc={borderSrc}
                  radiusSrc={radiusSrc}
                  shadowSrc={shadowSrc}
                  techIconSrc={techIconSrc}
                  onClose={onClose}
                />
              </MenuFlyoutSection>
            ) : null}
            {/* Motion band (Animation / tech-icon size):
                  top-level rows, same as the single-element menu. */}
            <MultiStyleSections
              part="motion"
              props={props}
              scaffold={scaffold}
              boxedSel={boxedSel}
              colourable={colourable}
              textSrc={textSrc}
              fillSrc={fillSrc}
              strokeSrc={strokeSrc}
              borderableSel={borderableSel}
              borderSrc={borderSrc}
              radiusSrc={radiusSrc}
              shadowSrc={shadowSrc}
              techIconSrc={techIconSrc}
              onClose={onClose}
            />
            {/* ── Text row (docs/specs/008-canvas/canvas-and-palette.md): Typography + Alignment + Markers behind
                  one "Text" flyout, matching the single-element menu. Sits in
                  the style band (no separator) like its single counterpart. ── */}
            {showTextFlyout ? (
              <MenuFlyoutSection title="Text" icon={<TextGlyph />} {...flyoutProps('text')}>
                {alignSrc ? (
                  <TypographySections
                    currentFont={(alignSrc as { font?: string }).font ?? null}
                    currentSize={(alignSrc as { textSize?: TextSize }).textSize ?? 'sm'}
                    presetPx={presetPxFor(alignSrc.type)}
                    padding={
                      (alignSrc as { padding?: Padding }).padding ?? defaultPadding(alignSrc)
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
                {/* Markers (docs/specs/009-elements/shape-markers.md) — for every marker-capable shape in the
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
          </>
        );
      })()}
    </ContextMenu>
  );
}
