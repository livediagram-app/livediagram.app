'use client';

// The "Presets" accordion sections (spec/48), shared by the single-element
// context menu (ElementAppearanceSections) and the multi-selection menu
// (MultiSelectionContextMenu) so there is one implementation of each. The
// apply / reset handlers on EditorContextMenuProps are already selection-wide
// (applyShapeColorPresetSelected / applyArrowPresetSelected walk every selected
// id), so the same section works for one element or many.

import {
  isChartShape,
  isCodeBlockShape,
  STICKY_PRESETS,
  supportsColours,
  type ArrowFlow,
  type BorderStyle,
  type Element,
  type ShapeColorPreset,
  type ShapeElement,
  type ShapeKind,
} from '@livediagram/diagram';
import { PresetsMenuGlyph } from '@/components/palette/context-menu-icons';
import {
  ArrowPresets,
  ChartPalettePresets,
  CodeThemePresets,
  ShapePresets,
  TablePresets,
} from '@/components/palette/StylePresets';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// The accordion open/toggle bundle a caller gets from `sectionProps(key)`.
type AccordionProps = { open: boolean; onToggle: () => void; flush: boolean };

// A shape carries presets unless it's the dedicated icon glyph (no fill / border
// to preset) or a pie / line chart (which styles per-slice via its Data
// category). The single and multi menus share this eligibility test.
export function shapeSupportsPresets(el: Element): el is ShapeElement {
  if (el.type !== 'shape') return false;
  // A preset is nothing but fill + stroke + text colours, so a shape that
  // takes no element colour has nothing for it to set. Asking the shared
  // predicate rather than keeping a second exclusion list here: a sticker
  // (spec/116) paints its own plate and showed a full Presets grid where every
  // tile did nothing, because this list had never heard of stickers.
  if (!supportsColours(el)) return false;
  // The ones that DO take colours but still can't show a preset: an icon is
  // line art with no fill, a chart paints its series from its own palette,
  // and a reveal (spec/106) is an opaque cover whose whole job is to be
  // unreadable — every preset tile changed nothing a viewer could see.
  return el.shape !== 'icon' && el.shape !== 'reveal' && !isChartShape(el.shape);
}

// Presets (spec/48) — one-click theme-colour + border looks for a shape, plus a
// reset to the theme default.
export function ShapePresetsSection({
  shape,
  current,
  presets,
  props,
  accordion,
  onClose,
  title = 'Presets',
}: {
  // The shape's kind, so the preview tiles match it (a circle as a circle).
  shape: ShapeKind;
  // The grid to show. Defaults to the theme-derived shape looks; a sticky
  // passes its own pad of note colours instead, since a note is exempt from
  // theme recolouring and wants paper colours rather than the board's.
  presets?: ShapeColorPreset[];
  // The shape's current style, to highlight a matching preset tile. In a
  // multi-selection this reads off the first selected shape.
  current: {
    fillColor?: string;
    strokeColor?: string;
    textColor?: string;
    colorPreset?: string;
  };
  props: EditorContextMenuProps;
  accordion: AccordionProps;
  onClose: () => void;
  // Section label. A mixed shape + arrow selection shows BOTH preset
  // sections, so the caller disambiguates ("Shape Presets") the same way
  // the Animation sections do; alone, the plain "Presets" reads fine.
  title?: string;
}) {
  return (
    <MenuAccordionSection title={title} icon={<PresetsMenuGlyph />} {...accordion}>
      <ShapePresets
        shape={shape}
        colorPresets={presets ?? props.shapeColorPresets}
        current={current}
        onApplyColor={(p) => props.onApplyShapeColorPreset(p)}
        onPreviewColor={(p) => props.onPreviewShapeColorPreset(p)}
        onPreviewEnd={props.onPreviewStyleEnd}
        onReset={() => {
          props.onResetShapeStyle();
          onClose();
        }}
      />
    </MenuAccordionSection>
  );
}

// Presets (spec/48) — one-click line looks for an arrow (pattern / thickness /
// optional flow animation), plus a reset.
export function ArrowPresetsSection({
  current,
  props,
  accordion,
  onClose,
  title = 'Presets',
}: {
  // The arrow's current line style, to highlight a matching preset
  // (strokeWidth disambiguates the Fine / Plain / Bold weight tiers).
  current: { strokeStyle?: BorderStyle; strokeWidth?: number; flow?: ArrowFlow };
  props: EditorContextMenuProps;
  accordion: AccordionProps;
  onClose: () => void;
  // See ShapePresetsSection: "Arrow Presets" when both sections show.
  title?: string;
}) {
  return (
    <MenuAccordionSection title={title} icon={<PresetsMenuGlyph />} {...accordion}>
      <ArrowPresets
        current={current}
        onApply={(p) => props.onApplyArrowPreset(p)}
        onPreview={(p) => props.onPreviewArrowPreset(p)}
        onPreviewEnd={props.onPreviewStyleEnd}
        onReset={() => {
          props.onResetArrowStyle();
          onClose();
        }}
      />
    </MenuAccordionSection>
  );
}

// Code-block schemes (spec/82). A code block paints its own card and takes no
// element colours, so its Presets grid is the colour SCHEME rather than the
// shape looks: same accordion, same hover-preview, different vocabulary.
export function CodeThemePresetsSection({
  current,
  props,
  accordion,
}: {
  current: string | undefined;
  props: EditorContextMenuProps;
  accordion: AccordionProps;
}) {
  return (
    <MenuAccordionSection title="Presets" icon={<PresetsMenuGlyph />} {...accordion}>
      <CodeThemePresets
        current={current}
        onApply={props.onApplyCodeTheme}
        onPreview={props.onPreviewCodeTheme}
        onPreviewEnd={props.onPreviewStyleEnd}
      />
    </MenuAccordionSection>
  );
}

/** Whether `TargetPresetsSection` would render anything for this element. */
export function hasStylePresets(el: Element): boolean {
  // The code-block test leads for the same reason it does in the component:
  // `shapeSupportsPresets` narrows shapes away when it fails.
  return (
    (el.type === 'shape' && (isCodeBlockShape(el.shape) || isChartShape(el.shape))) ||
    shapeSupportsPresets(el) ||
    el.type === 'table' ||
    el.type === 'sticky' ||
    el.type === 'arrow'
  );
}

// Table looks (spec/48): the four surfaces a table paints plus its banding,
// theme-derived like the shape presets. Reset goes through the shared
// reset-colours handler, which is what the Colours section's own reset uses.
export function TablePresetsSection({
  current,
  props,
  accordion,
  onClose,
}: {
  current: { fillColor?: string; strokeColor?: string; headerFill?: string; zebra?: boolean };
  props: EditorContextMenuProps;
  accordion: AccordionProps;
  onClose: () => void;
}) {
  return (
    <MenuAccordionSection title="Presets" icon={<PresetsMenuGlyph />} {...accordion}>
      <TablePresets
        presets={props.tableColorPresets}
        current={current}
        onApply={props.onApplyTablePreset}
        onPreview={props.onPreviewTablePreset}
        onPreviewEnd={props.onPreviewStyleEnd}
        onReset={() => {
          props.onResetColors();
          onClose();
        }}
      />
    </MenuAccordionSection>
  );
}

// Chart palettes (spec/53). A chart styles per slice / series from its Data
// category, so its Presets grid is the RAMP those fall back to: one pick for
// the whole chart, and it keeps applying as rows are added.
export function ChartPalettePresetsSection({
  current,
  props,
  accordion,
  onClose,
}: {
  current: string | undefined;
  props: EditorContextMenuProps;
  accordion: AccordionProps;
  onClose: () => void;
}) {
  return (
    <MenuAccordionSection title="Presets" icon={<PresetsMenuGlyph />} {...accordion}>
      <ChartPalettePresets
        current={current}
        onApply={props.onApplyChartPalette}
        onPreview={props.onPreviewChartPalette}
        onPreviewEnd={props.onPreviewStyleEnd}
        onReset={() => {
          props.onResetColors();
          onClose();
        }}
      />
    </MenuAccordionSection>
  );
}

// Which Presets grid an element gets. Four answers, and the choice is its own
// question, so it lives with the sections rather than inside the appearance
// menu's render: a shape's theme looks, a sticky's pad of note colours, a code
// block's colour scheme, or an arrow's line looks. Elements with none of them
// render nothing, which is why the caller can mount this unconditionally.
export function TargetPresetsSection({
  target,
  props,
  accordion,
  onClose,
}: {
  target: Element;
  props: EditorContextMenuProps;
  accordion: AccordionProps;
  onClose: () => void;
}) {
  // Checked before the shape branch: `shapeSupportsPresets` is a type
  // predicate, so a failing call narrows every shape out of `target` and a
  // later `type === 'shape'` test would be unreachable.
  if (target.type === 'shape' && isCodeBlockShape(target.shape)) {
    return (
      <CodeThemePresetsSection current={target.codeTheme} props={props} accordion={accordion} />
    );
  }
  // Charts style per slice, so the grid is their palette rather than a look.
  if (target.type === 'shape' && isChartShape(target.shape)) {
    return (
      <ChartPalettePresetsSection
        current={target.chartPalette}
        props={props}
        accordion={accordion}
        onClose={onClose}
      />
    );
  }
  if (target.type === 'table') {
    return (
      <TablePresetsSection
        current={{
          fillColor: target.fillColor,
          strokeColor: target.strokeColor,
          headerFill: target.headerFill,
          zebra: target.zebra,
        }}
        props={props}
        accordion={accordion}
        onClose={onClose}
      />
    );
  }
  if (shapeSupportsPresets(target)) {
    return (
      <ShapePresetsSection
        shape={target.shape}
        current={{
          fillColor: target.fillColor,
          strokeColor: target.strokeColor,
          textColor: target.textColor,
          colorPreset: target.colorPreset,
        }}
        props={props}
        accordion={accordion}
        onClose={onClose}
      />
    );
  }
  // A sticky's own grid rather than the theme-derived shape looks: a note is
  // exempt from theme recolouring, so the board's palette is the wrong
  // vocabulary for it. Previewed as a square, which is what a note is.
  if (target.type === 'sticky') {
    return (
      <ShapePresetsSection
        shape="square"
        presets={[...STICKY_PRESETS]}
        current={{
          fillColor: target.fillColor,
          strokeColor: target.strokeColor,
          textColor: target.textColor,
        }}
        props={props}
        accordion={accordion}
        onClose={onClose}
      />
    );
  }
  if (target.type === 'arrow') {
    return (
      <ArrowPresetsSection
        current={{
          strokeStyle: target.strokeStyle,
          strokeWidth: target.strokeWidth,
          flow: target.flow,
        }}
        props={props}
        accordion={accordion}
        onClose={onClose}
      />
    );
  }
  return null;
}
