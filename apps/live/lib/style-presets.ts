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
  clampShadow,
  DEFAULT_ANIMATION_SPEED,
  isBoxed,
  supportsBorder,
  supportsShadow,
  type ArrowFlow,
  type ElementShadow,
  type ArrowThickness,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type Element,
  type IconPosition,
  type IconSize,
  type Padding,
  type ShapeKind,
  type ShapeMarker,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import type { ShapeColorPreset } from './themes';

// Apply a theme-derived style preset to a shape: its colours (fill + stroke +
// text) AND its border weight / pattern together — a preset is one complete
// look (spec/48). Border RADIUS is deliberately untouched: it's a silhouette
// choice the user makes separately, and a preset clobbering it read as the
// preset breaking the shape. Records the preset id so theme changes can
// re-derive it. No-op on non-shapes.
export function applyColorPresetToEl(el: Element, p: ShapeColorPreset): Element {
  if (el.type !== 'shape') return el;
  return {
    ...el,
    fillColor: p.fill,
    strokeColor: p.stroke,
    textColor: p.text,
    strokeWidth: p.borderStroke,
    strokeStyle: p.borderStyle,
    colorPreset: p.id,
  };
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

// Element drop shadow (spec/86). `null` clears the field; values clamp to
// the slider limits so a preview / commit can never write an out-of-range
// shadow. Gated to the body-drawing boxed types (shape / sticky / image /
// link-card) via the shared supportsShadow predicate.
export function applyShadowToEl(el: Element, shadow: ElementShadow | null): Element {
  return supportsShadow(el) ? { ...el, shadow: shadow ? clampShadow(shadow) : undefined } : el;
}

// Rotation in degrees clockwise about the centre, normalised to 0..359; 0 is
// stored as undefined (upright). Boxed elements only.
export function applyRotationToEl(el: Element, deg: number): Element {
  if (!isBoxed(el)) return el;
  const next = ((Math.round(deg) % 360) + 360) % 360;
  return { ...el, rotation: next === 0 ? undefined : next };
}

// Morph a shape into a different kind, preserving width / height / label /
// colour overrides. Circle and diamond are 1:1 shapes — coming from a
// non-square box, snap to the larger side so the result fits the original
// footprint. No-op on non-shapes.
export function applyShapeKindToEl(el: Element, kind: ShapeKind): Element {
  if (el.type !== 'shape') return el;
  const oneToOne = kind === 'circle' || kind === 'diamond';
  if (oneToOne) {
    const side = Math.max(el.width, el.height);
    return { ...el, shape: kind, width: side, height: side };
  }
  return { ...el, shape: kind };
}

// A Technology icon's fixed tile-size preset (spec/41). Icon shapes only.
export function applyIconSizeToEl(el: Element, iconSize: IconSize): Element {
  return el.type === 'shape' && el.shape === 'icon' ? { ...el, iconSize } : el;
}

// Status markers (spec/49): the glyph shown inside the shape, left of its
// label; `null` clears it. Shapes only.
export function applyMarkerToEl(el: Element, marker: ShapeMarker | null): Element {
  return el.type === 'shape' ? { ...el, marker: marker ?? undefined } : el;
}

export function applyMarkerSizeToEl(el: Element, size: TextSize): Element {
  return el.type === 'shape' ? { ...el, markerSize: size } : el;
}

// Text alignment inside the box (the toolbar's 3×3 grid). Boxed elements only.
export function applyTextAlignToEl(el: Element, x: TextAlignX, y: TextAlignY): Element {
  return isBoxed(el) ? { ...el, textAlignX: x, textAlignY: y } : el;
}

// Label size preset. Boxed elements + arrows (arrow labels size too).
export function applyTextSizeToEl(el: Element, size: TextSize): Element {
  return isBoxed(el) || el.type === 'arrow' ? { ...el, textSize: size } : el;
}

// Label font. Boxed elements + arrows; `null` clears the override back to the
// tab default. Mirrors setFontSelected so the hover-preview + click-commit path
// applies the same change.
export function applyFontToEl(el: Element, font: string | null): Element {
  if (!(isBoxed(el) || el.type === 'arrow')) return el;
  if (!font) {
    const copy = { ...el };
    delete (copy as { font?: string }).font;
    return copy;
  }
  return { ...el, font };
}

// Box padding preset (space between the label and the element edge). Boxed
// elements only.
export function applyPaddingToEl(el: Element, padding: Padding): Element {
  return isBoxed(el) ? { ...el, padding } : el;
}

// Re-place a shape's inline icon on another side (spec/09 icons). Regular
// shapes only — the dedicated 'icon' shape has no inline-icon slot. Mirrors
// dropIconOnElement in useInlineIconMutators.
export function applyInlineIconToEl(el: Element, iconId: string, position: IconPosition): Element {
  return el.type === 'shape' && el.shape !== 'icon'
    ? { ...el, iconId, iconPosition: position }
    : el;
}

// Apply a line preset (pattern × thickness × optional flow) to an arrow. A
// preset without a flow clears any existing animation; one with a flow defaults
// its speed to the shared default when the arrow had none. No-op on non-arrows.
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
    flowSpeed: p.flow ? (el.flowSpeed ?? DEFAULT_ANIMATION_SPEED) : el.flowSpeed,
  };
}
