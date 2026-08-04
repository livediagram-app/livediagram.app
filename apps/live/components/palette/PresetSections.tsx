'use client';

// The "Presets" accordion sections (spec/48), shared by the single-element
// context menu (ElementAppearanceSections) and the multi-selection menu
// (MultiSelectionContextMenu) so there is one implementation of each. The
// apply / reset handlers on EditorContextMenuProps are already selection-wide
// (applyShapeColorPresetSelected / applyArrowPresetSelected walk every selected
// id), so the same section works for one element or many.

import {
  isChartShape,
  supportsColours,
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
