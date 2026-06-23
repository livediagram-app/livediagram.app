// Pure element transforms for the one-click style presets (spec/48). Kept
// separate from both the commit setters (`hooks/useElementStyle.ts`) and the
// hover-preview hook (`hooks/useStylePreview.ts`) so the two share ONE
// definition of what each preset does to an element — the preview a user sees
// on hover is byte-for-byte the change a click commits.
//
// Colour presets also stamp the preset's stable id onto the shape's
// `colorPreset` so a later theme change can re-derive the variant (see
// `rederiveColorPresetForTheme` in lib/themes). Border + arrow presets carry no
// theme binding, so they only touch their own fields.

import {
  ARROW_THICKNESS_PX,
  isBoxed,
  supportsBorder,
  type ArrowFlow,
  type ArrowThickness,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type Element,
} from '@livediagram/diagram';
import type { ShapeColorPreset } from './themes';

// Apply a theme-derived colour preset to a shape (fill + stroke + text), and
// record the preset id so theme changes can re-derive it. No-op on non-shapes.
export function applyColorPresetToEl(el: Element, p: ShapeColorPreset): Element {
  if (el.type !== 'shape') return el;
  return { ...el, fillColor: p.fill, strokeColor: p.stroke, textColor: p.text, colorPreset: p.id };
}

// Apply a border preset (weight × pattern × radius) to a shape. Independent of
// the colour preset, so it leaves `colorPreset` (and the colours) alone.
export function applyBorderPresetToEl(
  el: Element,
  p: { stroke: BorderStroke; style: BorderStyle; radius: BorderRadius },
): Element {
  if (el.type !== 'shape') return el;
  return { ...el, strokeWidth: p.stroke, strokeStyle: p.style, borderRadius: p.radius };
}

// ── Granular single-field transforms ────────────────────────────────────
//
// The individual colour / border / rotation controls in the context menu hover-
// preview the same way the presets do (spec/48). These are the pure field
// setters behind that flow, shared by the commit setters (useElementStyle) and
// the preview hook (useStylePreview) so a hovered swatch shows byte-for-byte the
// change its click commits. Each MUST match the per-type rules in
// useElementStyle exactly.

// Hand-editing any colour breaks a shape's colour-preset binding (spec/48), so
// setting fill / stroke / text on a shape clears `colorPreset` (a no-op field on
// other types). Fill applies to shapes + sticky / freehand / table.
export function applyFillColorToEl(el: Element, color: string): Element {
  if (el.type === 'shape') return { ...el, fillColor: color, colorPreset: undefined };
  if (el.type === 'sticky' || el.type === 'freehand' || el.type === 'table')
    return { ...el, fillColor: color };
  return el;
}

export function applyStrokeColorToEl(el: Element, color: string): Element {
  if (el.type === 'shape') return { ...el, strokeColor: color, colorPreset: undefined };
  if (el.type === 'sticky' || el.type === 'arrow' || el.type === 'freehand' || el.type === 'table')
    return { ...el, strokeColor: color };
  return el;
}

export function applyTextColorToEl(el: Element, color: string): Element {
  if (el.type === 'shape') return { ...el, textColor: color, colorPreset: undefined };
  if (isBoxed(el) || el.type === 'arrow') return { ...el, textColor: color };
  return el;
}

// Border weight / pattern apply to any border-bearing element (shapes + the
// freehand pen) plus tables; radius is shape-only.
export function applyBorderStrokeToEl(el: Element, value: BorderStroke): Element {
  return supportsBorder(el) || el.type === 'table' ? { ...el, strokeWidth: value } : el;
}

export function applyBorderStyleToEl(el: Element, value: BorderStyle): Element {
  return supportsBorder(el) || el.type === 'table' ? { ...el, strokeStyle: value } : el;
}

export function applyBorderRadiusToEl(el: Element, value: BorderRadius): Element {
  return el.type === 'shape' ? { ...el, borderRadius: value } : el;
}

// Rotation in degrees clockwise about the centre, normalised to 0..359; 0 is
// stored as undefined (upright). Boxed elements only.
export function applyRotationToEl(el: Element, deg: number): Element {
  if (!isBoxed(el)) return el;
  const next = ((Math.round(deg) % 360) + 360) % 360;
  return { ...el, rotation: next === 0 ? undefined : next };
}

// Apply a line preset (pattern × thickness × optional flow) to an arrow. A
// preset without a flow clears any existing animation; one with a flow defaults
// its speed to normal when the arrow had none. No-op on non-arrows.
export function applyArrowPresetToEl(
  el: Element,
  p: { style: BorderStyle; thickness: ArrowThickness; flow?: ArrowFlow },
): Element {
  if (el.type !== 'arrow') return el;
  return {
    ...el,
    strokeStyle: p.style,
    strokeWidth: ARROW_THICKNESS_PX[p.thickness],
    flow: p.flow,
    flowSpeed: p.flow ? (el.flowSpeed ?? 'normal') : el.flowSpeed,
  };
}
