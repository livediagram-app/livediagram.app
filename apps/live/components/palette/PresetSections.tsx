'use client';

// The "Presets" accordion sections (spec/48), shared by the single-element
// context menu (ElementAppearanceSections) and the multi-selection menu
// (MultiSelectionContextMenu) so there is one implementation of each. The
// apply / reset handlers on EditorContextMenuProps are already selection-wide
// (applyShapeColorPresetSelected / applyArrowPresetSelected walk every selected
// id), so the same section works for one element or many.

import {
  isChartShape,
  type ArrowFlow,
  type BorderStyle,
  type Element,
  type ShapeElement,
  type ShapeKind,
} from '@livediagram/diagram';
import { PresetsMenuGlyph } from '@/components/palette/context-menu-icons';
import { ArrowPresets, ShapePresets } from '@/components/palette/StylePresets';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// The accordion open/toggle bundle a caller gets from `sectionProps(key)`.
type AccordionProps = { open: boolean; onToggle: () => void; flush: boolean };

// A shape carries presets unless it's the dedicated icon glyph (no fill / border
// to preset) or a pie / line chart (which styles per-slice via its Data
// category). The single and multi menus share this eligibility test.
export function shapeSupportsPresets(el: Element): el is ShapeElement {
  return el.type === 'shape' && el.shape !== 'icon' && !isChartShape(el.shape);
}

// Presets (spec/48) — one-click theme-colour + border looks for a shape, plus a
// reset to the theme default.
export function ShapePresetsSection({
  shape,
  current,
  props,
  accordion,
  onClose,
  title = 'Presets',
}: {
  // The shape's kind, so the preview tiles match it (a circle as a circle).
  shape: ShapeKind;
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
        colorPresets={props.shapeColorPresets}
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
  // The arrow's current line style, to highlight a matching preset.
  current: { strokeStyle?: BorderStyle; flow?: ArrowFlow };
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
