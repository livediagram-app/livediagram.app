// Pure element transforms for the one-click style presets (docs/specs/010-palette/style-presets.md). Kept
// separate from both the commit setters (`hooks/useElementStyle.ts`) and the
// hover-preview hook (`hooks/useStylePreview.ts`) so the two share ONE
// definition of what each preset does to an element — the preview a user sees
// on hover is byte-for-byte the change a click commits.
//
// Colour presets also stamp the preset's stable id onto the shape's
// `colorPreset` so a later theme change can re-derive the variant (see
// `rederiveColorPresetForTheme` in lib/themes). Border presets carry no
// theme binding, so they only touch their own fields. A retired element
// (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements", the stored arrows, pen strokes,
// paths and annotations among them) keeps what it stored: every transform here leaves it as it is.

import {
  INK_PEN_COLOUR,
  isPenColourName,
  penColourHex,
  type PenColourName,
  clampShadow,
  isBoxed,
  isRetiredElement,
  supportsBorder,
  supportsShadow,
  supportsFinish,
  type Finish,
  type ElementShadow,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type IconPosition,
  type IconSize,
  type IconWeight,
  type Padding,
  type ShapeKind,
  supportsRotation,
  type ShapeMarker,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
  type TextSizePreset,
} from '@livehuddle/document';
import type { ShapeColorPreset } from './themes';
import { isTechIconId } from '@liveworkspace/workbench/lib/tech-icons';

// A boxed element the style controls may write to: not a retired one. Every setter here leaves a retired element
// exactly as stored (docs/specs/002-project-scope/blueprints/element-engine.md): its placeholder draws the same
// whatever it holds.
export const isStyleable = (el: Element): el is BoxedElement =>
  isBoxed(el) && !isRetiredElement(el);
const styleable = isStyleable;

// Apply a theme-derived style preset to a shape: its colours (fill + stroke +
// text) AND its border weight / pattern together — a preset is one complete
// look (docs/specs/010-palette/style-presets.md). Border RADIUS is deliberately untouched: it's a silhouette
// choice the user makes separately, and a preset clobbering it read as the
// preset breaking the shape. Records the preset id so theme changes can
// re-derive it.
export function applyColorPresetToEl(el: Element, p: ShapeColorPreset): Element {
  if (isRetiredElement(el)) return el;
  // A sticky takes the paper and the ink and nothing else: its edge against
  // the peel shadow IS its border, so a stroke here would draw a hairline box
  // around the note. Any hand-set one is cleared with the pick, which is what
  // "one complete look" means for a note.
  if (el.type === 'sticky')
    return { ...el, fillColor: p.fill, textColor: p.text, strokeColor: undefined };
  if (el.type !== 'shape') return el;
  return {
    ...el,
    fillColor: p.fill,
    strokeColor: p.stroke,
    textColor: p.text,
    strokeWidth: p.borderStroke,
    strokeStyle: p.borderStyle,
    colorPreset: p.id,
    // A preset is a whole look: it replaces any quick-swatch binding
    // (docs/specs/008-canvas/quick-style-panel.md) along with the colours it bound.
    strokeSwatch: undefined,
    fillSwatch: undefined,
  };
}

// ── Granular single-field transforms ────────────────────────────────────
//
// The individual colour / border / rotation controls in the context menu hover-
// preview the same way the presets do (docs/specs/010-palette/style-presets.md). These are the pure field
// setters behind that flow, shared by the commit setters (useElementStyle) and
// the preview hook (useStylePreview) so a hovered swatch shows byte-for-byte the
// change its click commits. Each MUST match the per-type rules in
// useElementStyle exactly.

// Hand-editing any colour breaks the element's preset binding (docs/specs/010-palette/style-presets.md), so
// setting fill / stroke / text clears `colorPreset` on a shape: past that point the colours are the user's, and a
// theme change must preserve them rather than re-deriving a look they have
// already edited away from. Fill applies to shapes + stickies.
export function applyFillColorToEl(el: Element, color: string): Element {
  if (isRetiredElement(el)) return el;
  // Also drops the quick-swatch binding (docs/specs/008-canvas/quick-style-panel.md): the slot no longer
  // describes the colour.
  if (el.type === 'shape')
    return { ...el, fillColor: color, colorPreset: undefined, fillSwatch: undefined };
  if (el.type === 'sticky') return { ...el, fillColor: color };
  return el;
}

// A colour row's choice on an element that stores stock colours by name (docs/specs/007-editor/
// editor-modes.md "One look"): a standard colour (Ink, Grey, Red ...) is stored as its name and
// drawn in its version for the canvas; any other colour replaces the name.
const lineColour = (color: string): { strokeColor?: string; penColour?: PenColourName } =>
  isPenColourName(color)
    ? { strokeColor: undefined, penColour: color }
    : { strokeColor: color, penColour: undefined };
const textColour = (color: string): { textColor?: string; penTextColour?: PenColourName } =>
  isPenColourName(color)
    ? { textColor: undefined, penTextColour: color }
    : { textColor: color, penTextColour: undefined };
// Where an element stores no name (a note's border), a standard colour lands as its
// light-paper hex; Ink, the canvas's own drawing colour, leaves it as it is.
const asHex = (color: string): string | null =>
  color === INK_PEN_COLOUR ? null : isPenColourName(color) ? penColourHex(color, 'light') : color;

export function applyStrokeColorToEl(el: Element, color: string): Element {
  if (isRetiredElement(el)) return el;
  if (el.type === 'shape')
    return { ...el, ...lineColour(color), colorPreset: undefined, strokeSwatch: undefined };
  const hex = asHex(color);
  if (hex === null) return el;
  if (el.type === 'sticky') return { ...el, strokeColor: hex };
  return el;
}

export function applyTextColorToEl(el: Element, color: string): Element {
  if (isRetiredElement(el)) return el;
  if (el.type === 'shape') return { ...el, ...textColour(color), colorPreset: undefined };
  // A hand-picked colour is no longer the quick-swatch slot it came from.
  if (el.type === 'text') return { ...el, ...textColour(color), textSwatch: undefined };
  if (el.type === 'sticky') return { ...el, ...textColour(color) };
  const hex = asHex(color);
  if (hex === null) return el;
  if (styleable(el)) return { ...el, textColor: hex };
  return el;
}

// Border weight / pattern apply to any border-bearing element; radius is shape-only.
export function applyBorderStrokeToEl(el: Element, value: BorderStroke): Element {
  if (isRetiredElement(el)) return el;
  return supportsBorder(el) ? { ...el, strokeWidth: value } : el;
}

export function applyBorderStyleToEl(el: Element, value: BorderStyle): Element {
  if (isRetiredElement(el)) return el;
  return supportsBorder(el) ? { ...el, strokeStyle: value } : el;
}

export function applyBorderRadiusToEl(el: Element, value: BorderRadius): Element {
  if (isRetiredElement(el)) return el;
  return el.type === 'shape' ? { ...el, borderRadius: value } : el;
}

// Element drop shadow (docs/specs/008-canvas/element-shadows.md). `null` clears the field; values clamp to
// the slider limits so a preview / commit can never write an out-of-range
// shadow. Gated to the body-drawing boxed types (shape / sticky / image /
// link-card) via the shared supportsShadow predicate.
export function applyShadowToEl(el: Element, shadow: ElementShadow | null): Element {
  if (isRetiredElement(el)) return el;
  return supportsShadow(el) ? { ...el, shadow: shadow ? clampShadow(shadow) : undefined } : el;
}

// An element's own finish (docs/specs/008-canvas/finish.md). `null` is Follow Tab: the key is removed, never
// stored as the tab's value, so the element follows a later tab change. Shapes, text and stickies only.
export function applyFinishToEl(el: Element, finish: Finish | null): Element {
  if (isRetiredElement(el)) return el;
  if (!supportsFinish(el)) return el;
  if (finish) return { ...el, finish } as Element;
  if (!('finish' in el)) return el;
  const { finish: _cleared, ...rest } = el as Element & { finish?: Finish };
  return rest;
}

// Rotation in degrees clockwise about the centre, normalised to 0..359; 0 is
// stored as undefined (upright). Boxed elements only.
export function applyRotationToEl(el: Element, deg: number): Element {
  if (isRetiredElement(el)) return el;
  if (!supportsRotation(el)) return el;
  const next = ((Math.round(deg) % 360) + 360) % 360;
  return { ...el, rotation: next === 0 ? undefined : next };
}

// Morph a shape into a different kind, preserving width / height / label /
// colour overrides. Circle and diamond are 1:1 shapes — coming from a
// non-square box, snap to the larger side so the result fits the original
// footprint. No-op on non-shapes.
export function applyShapeKindToEl(el: Element, kind: ShapeKind): Element {
  if (isRetiredElement(el)) return el;
  if (el.type !== 'shape') return el;
  const oneToOne = kind === 'circle' || kind === 'diamond';
  if (oneToOne) {
    const side = Math.max(el.width, el.height);
    return { ...el, shape: kind, width: side, height: side };
  }
  return { ...el, shape: kind };
}

// A Technology icon's fixed tile-size preset (docs/specs/010-palette/technology-icons.md). Icon shapes only.
export function applyIconSizeToEl(el: Element, iconSize: IconSize): Element {
  if (isRetiredElement(el)) return el;
  return el.type === 'shape' && el.shape === 'icon' ? { ...el, iconSize } : el;
}

// A line-art icon's thin / regular / bold weight (docs/specs/004-interface-design/iconography.md). Technology
// marks are filled tiles and keep their art, so they are left alone.
export function applyIconWeightToEl(el: Element, iconWeight: IconWeight): Element {
  if (isRetiredElement(el)) return el;
  return el.type === 'shape' && el.shape === 'icon' && !isTechIconId(el.iconId)
    ? { ...el, iconWeight }
    : el;
}

// Status markers (docs/specs/009-elements/shape-markers.md): the glyph shown inside the shape, left of its
// label; `null` clears it. Shapes only.
export function applyMarkerToEl(el: Element, marker: ShapeMarker | null): Element {
  if (isRetiredElement(el)) return el;
  return el.type === 'shape' ? { ...el, marker: marker ?? undefined } : el;
}

export function applyMarkerSizeToEl(el: Element, size: TextSizePreset): Element {
  if (isRetiredElement(el)) return el;
  return el.type === 'shape' ? { ...el, markerSize: size } : el;
}

// Text alignment inside the box (the toolbar's 3×3 grid). Boxed elements only.
export function applyTextAlignToEl(el: Element, x: TextAlignX, y: TextAlignY): Element {
  return styleable(el) ? { ...el, textAlignX: x, textAlignY: y } : el;
}

// Label size preset. Boxed elements only.
export function applyTextSizeToEl(el: Element, size: TextSize): Element {
  return styleable(el) ? { ...el, textSize: size } : el;
}

// Label font. Boxed elements only; `null` clears the override back to the
// tab default. Mirrors setFontSelected so the hover-preview + click-commit path
// applies the same change.
export function applyFontToEl(el: Element, font: string | null): Element {
  if (!styleable(el)) return el;
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
  return styleable(el) ? { ...el, padding } : el;
}

// An inline icon set on a shape (dropped, picked or folded in), on the side asked when one is; anything but a shape
// is left as it is.
export function withInlineIcon<T extends Element>(
  el: T,
  iconId: string,
  position?: IconPosition,
): T {
  if (el.type !== 'shape') return el;
  return { ...el, iconId, ...(position ? { iconPosition: position } : {}) };
}

// Re-place a shape's inline icon on another side (docs/specs/008-canvas/canvas-and-palette.md icons). Regular
// shapes only: the dedicated 'icon' shape has no inline-icon slot.
export function applyInlineIconToEl(el: Element, iconId: string, position: IconPosition): Element {
  return el.type === 'shape' && el.shape !== 'icon' ? withInlineIcon(el, iconId, position) : el;
}
