// The quick style panel's model (docs/specs/008-canvas/quick-style-panel.md): which sections a selection
// gets, the value each shows, and the pure transform behind each choice. The
// hook (useQuickStyle) commits these; nothing here touches state.
import {
  ARROW_THICKNESS_PX,
  DEFAULT_ANIMATION_SPEED,
  acceptsInlineIcon,
  arrowThicknessOf,
  canvasSurface,
  defaultArrowStrokeColor,
  supportsTextAlign,
  quickSwatches,
  supportsBorderControls,
  supportsColours,
  supportsFillColor,
  type ArrowElement,
  type Element,
  type QuickSwatchRole,
  type QuickSwatchSlot,
  type ShapeElement,
  type TextAlignX,
  type TextElement,
  type ThemeDefinition,
} from '@livediagram/diagram';
import { applySwatchOverrides, type ShownSwatch, type SwatchOverrides } from './swatch-overrides';

export type QuickStyleTarget = ShapeElement | ArrowElement | TextElement;
export type QuickSectionId =
  'stroke' | 'background' | 'textColour' | 'width' | 'style' | 'textAlign' | 'iconAlign';
export type QuickSwatchValue = 0 | QuickSwatchSlot;
export type QuickWidth = 'thin' | 'medium' | 'thick';
export type QuickStrokeStyle = 'solid' | 'dashed' | 'dotted' | 'flowing';
export type QuickIconAlign = 'left' | 'above' | 'right';

export const QUICK_WIDTHS: readonly QuickWidth[] = ['thin', 'medium', 'thick'];
export const QUICK_TEXT_ALIGNS: readonly TextAlignX[] = ['left', 'center', 'right'];
export const QUICK_ICON_ALIGNS: readonly QuickIconAlign[] = ['left', 'above', 'right'];
const SHAPE_STYLES: readonly QuickStrokeStyle[] = ['solid', 'dashed', 'dotted'];
const ARROW_STYLES: readonly QuickStrokeStyle[] = ['solid', 'dashed', 'flowing'];

export type QuickStyleView = {
  // The elements the panel styles, in selection order.
  targetIds: string[];
  sections: {
    stroke?: { value: QuickSwatchValue | null; swatches: ShownSwatch[] };
    background?: { value: QuickSwatchValue | null; swatches: ShownSwatch[] };
    textColour?: { value: QuickSwatchValue | null; swatches: ShownSwatch[] };
    width?: { value: QuickWidth | null };
    style?: { value: QuickStrokeStyle | null; options: readonly QuickStrokeStyle[] };
    textAlign?: { value: TextAlignX | null };
    iconAlign?: { value: QuickIconAlign | null };
  };
};

// An unlocked shape, arrow or text element: the only elements the panel styles.
export function isQuickStyleTarget(el: Element): el is QuickStyleTarget {
  return (el.type === 'shape' || el.type === 'arrow' || el.type === 'text') && el.locked !== true;
}

export function supportsQuickSection(el: QuickStyleTarget, section: QuickSectionId): boolean {
  switch (section) {
    case 'stroke':
      return el.type === 'arrow' || (el.type === 'shape' && supportsColours(el));
    case 'background':
      return el.type === 'shape' && supportsFillColor(el);
    case 'textColour':
      return el.type === 'text';
    case 'width':
    case 'style':
      return el.type === 'arrow' || (el.type === 'shape' && supportsBorderControls(el));
    case 'textAlign':
      return el.type === 'shape' && supportsTextAlign(el.shape);
    case 'iconAlign':
      return el.type === 'shape' && acceptsInlineIcon(el) && !!el.iconId;
  }
}

// The one value every supporting element shares, else null.
function shared<T>(values: (T | null)[]): T | null {
  if (values.length === 0) return null;
  const [first] = values;
  return first !== null && first !== undefined && values.every((v) => v === first) ? first : null;
}

function swatchValue(
  el: QuickStyleTarget,
  theme: ThemeDefinition,
  role: QuickSwatchRole,
  swatches: ShownSwatch[],
): QuickSwatchValue | null {
  const bound = boundSlot(el, role);
  // A bound slot counts only while the row still shows its theme colour.
  if (bound && !swatches[bound]?.override) return bound;
  const colour = role === 'stroke' ? el.strokeColor : role === 'text' ? el.textColor : fillOf(el);
  if (colour === undefined) return 0;
  const own = themeOwn(theme, role);
  const lower = colour.toLowerCase();
  if (lower === swatches[0]!.color.toLowerCase() || lower === own?.toLowerCase()) return 0;
  const shown = swatches.find((s) => s.slot !== 0 && s.color.toLowerCase() === lower);
  return shown && shown.slot !== 0 ? shown.slot : null;
}

function boundSlot(el: QuickStyleTarget, role: QuickSwatchRole): QuickSwatchSlot | undefined {
  if (role === 'text') return el.type === 'text' ? el.textSwatch : undefined;
  if (el.type === 'text') return undefined;
  return role === 'stroke' ? el.strokeSwatch : el.type === 'shape' ? el.fillSwatch : undefined;
}

const fillOf = (el: QuickStyleTarget) => (el.type === 'shape' ? el.fillColor : undefined);

// The theme's own value for a row: what slot 0 writes.
function themeOwn(theme: ThemeDefinition, role: QuickSwatchRole): string | null {
  return role === 'stroke'
    ? theme.elementStroke
    : role === 'text'
      ? theme.elementText
      : theme.elementFill;
}

function widthOf(el: QuickStyleTarget): QuickWidth | null {
  if (el.type === 'text') return null;
  const w = el.type === 'arrow' ? arrowThicknessOf(el) : (el.strokeWidth ?? 'medium');
  return (QUICK_WIDTHS as readonly string[]).includes(w) ? (w as QuickWidth) : null;
}

function styleOf(el: QuickStyleTarget): QuickStrokeStyle | null {
  if (el.type === 'text') return null;
  const style = el.strokeStyle ?? 'solid';
  if (el.type === 'arrow' && el.flow)
    return el.flow === 'dashes' && style === 'dashed' ? 'flowing' : null;
  return style === 'solid' || style === 'dashed' || style === 'dotted' ? style : null;
}

function iconAlignOf(el: QuickStyleTarget): QuickIconAlign | null {
  if (el.type !== 'shape') return null;
  const pos = el.iconPosition ?? 'left';
  return pos === 'below' ? null : pos;
}

export function quickStyleView(
  elements: readonly Element[],
  theme: ThemeDefinition,
  overrides: SwatchOverrides = {},
): QuickStyleView | null {
  const targets = elements.filter(isQuickStyleTarget);
  const supporting = (s: QuickSectionId) => targets.filter((el) => supportsQuickSection(el, s));
  const sections: QuickStyleView['sections'] = {};

  const stroke = supporting('stroke');
  if (stroke.length > 0) {
    const swatches = applySwatchOverrides(quickSwatches(theme, 'stroke'), overrides.stroke);
    // An arrow's unpainted line is its own ink, not a shape's: show that when
    // only arrows are being stroked and the theme paints none.
    if (theme.elementStroke === null && stroke.every((el) => el.type === 'arrow')) {
      swatches[0] = {
        ...swatches[0]!,
        color: defaultArrowStrokeColor(canvasSurface(theme.backgroundColor)),
      };
    }
    sections.stroke = {
      swatches,
      value: shared(stroke.map((el) => swatchValue(el, theme, 'stroke', swatches))),
    };
  }
  const background = supporting('background');
  if (background.length > 0) {
    const swatches = applySwatchOverrides(quickSwatches(theme, 'fill'), overrides.fill);
    sections.background = {
      swatches,
      value: shared(background.map((el) => swatchValue(el, theme, 'fill', swatches))),
    };
  }
  const textColour = supporting('textColour');
  if (textColour.length > 0) {
    const swatches = applySwatchOverrides(quickSwatches(theme, 'text'), overrides.text);
    sections.textColour = {
      swatches,
      value: shared(textColour.map((el) => swatchValue(el, theme, 'text', swatches))),
    };
  }
  const width = supporting('width');
  if (width.length > 0) sections.width = { value: shared(width.map(widthOf)) };
  const style = supporting('style');
  if (style.length > 0) {
    const options = style.every((el) => el.type === 'arrow') ? ARROW_STYLES : SHAPE_STYLES;
    const value = shared(style.map(styleOf));
    sections.style = { options, value: value && options.includes(value) ? value : null };
  }
  const textAlign = supporting('textAlign');
  if (textAlign.length > 0) {
    sections.textAlign = {
      value: shared(
        textAlign.map((el) => (el.type === 'shape' ? (el.textAlignX ?? 'center') : null)),
      ),
    };
  }
  const iconAlign = supporting('iconAlign');
  if (iconAlign.length > 0) sections.iconAlign = { value: shared(iconAlign.map(iconAlignOf)) };

  if (Object.keys(sections).length === 0) return null;
  return { targetIds: targets.map((el) => el.id), sections };
}

// --- Apply ------------------------------------------------------------------
// Each transform is a no-op (returns `el`) on an element the section does not
// support, so a whole selection can be mapped through it.

// A slot's colour for applying: the custom one when overridden (unbound: a
// custom colour does not follow the theme), else the theme's, bound to its slot.
function pickFor(
  theme: ThemeDefinition,
  role: QuickSwatchRole,
  slot: QuickSwatchValue,
  overrides: SwatchOverrides,
): { colour: string | undefined; bind: QuickSwatchSlot | undefined } {
  if (slot === 0) return { colour: themeOwn(theme, role) ?? undefined, bind: undefined };
  const custom = overrides[role]?.[slot];
  if (custom) return { colour: custom, bind: undefined };
  return { colour: quickSwatches(theme, role)[slot]!.color, bind: slot };
}

export function applyQuickStroke(
  el: Element,
  theme: ThemeDefinition,
  slot: QuickSwatchValue,
  overrides: SwatchOverrides = {},
): Element {
  if (!isQuickStyleTarget(el) || el.type === 'text' || !supportsQuickSection(el, 'stroke'))
    return el;
  const { colour, bind } = pickFor(theme, 'stroke', slot, overrides);
  return el.type === 'shape'
    ? { ...el, strokeColor: colour, strokeSwatch: bind, colorPreset: undefined }
    : { ...el, strokeColor: colour, strokeSwatch: bind };
}

export function applyQuickFill(
  el: Element,
  theme: ThemeDefinition,
  slot: QuickSwatchValue,
  overrides: SwatchOverrides = {},
): Element {
  if (el.type !== 'shape' || !isQuickStyleTarget(el) || !supportsQuickSection(el, 'background'))
    return el;
  const { colour, bind } = pickFor(theme, 'fill', slot, overrides);
  return { ...el, fillColor: colour, fillSwatch: bind, colorPreset: undefined };
}

export function applyQuickTextColour(
  el: Element,
  theme: ThemeDefinition,
  slot: QuickSwatchValue,
  overrides: SwatchOverrides = {},
): Element {
  if (el.type !== 'text' || !isQuickStyleTarget(el)) return el;
  const { colour, bind } = pickFor(theme, 'text', slot, overrides);
  return { ...el, textColor: colour, textSwatch: bind };
}

export function applyQuickWidth(el: Element, width: QuickWidth): Element {
  if (!isQuickStyleTarget(el) || el.type === 'text' || !supportsQuickSection(el, 'width'))
    return el;
  return el.type === 'arrow'
    ? { ...el, strokeWidth: ARROW_THICKNESS_PX[width] }
    : { ...el, strokeWidth: width };
}

export function applyQuickStrokeStyle(el: Element, style: QuickStrokeStyle): Element {
  if (!isQuickStyleTarget(el) || el.type === 'text' || !supportsQuickSection(el, 'style'))
    return el;
  if (el.type === 'shape') return { ...el, strokeStyle: style === 'flowing' ? 'dashed' : style };
  if (style === 'flowing') {
    return {
      ...el,
      strokeStyle: 'dashed',
      flow: 'dashes',
      flowSpeed: el.flowSpeed ?? DEFAULT_ANIMATION_SPEED,
    };
  }
  const { flow: _flow, flowSpeed: _speed, ...rest } = el;
  return { ...rest, strokeStyle: style };
}

export function applyQuickTextAlign(el: Element, align: TextAlignX): Element {
  if (el.type !== 'shape' || !isQuickStyleTarget(el) || !supportsQuickSection(el, 'textAlign'))
    return el;
  return { ...el, textAlignX: align };
}

export function applyQuickIconAlign(el: Element, align: QuickIconAlign): Element {
  if (el.type !== 'shape' || !isQuickStyleTarget(el) || !supportsQuickSection(el, 'iconAlign'))
    return el;
  return { ...el, iconPosition: align };
}

// Clear styles: the quick-style fields back to the theme's default.
export function clearQuickStyle(el: Element, theme: ThemeDefinition): Element {
  if (!isQuickStyleTarget(el)) return el;
  if (el.type === 'text') {
    const { textSwatch: _ts, textColor: _tc, ...rest } = el;
    return theme.elementText ? { ...rest, textColor: theme.elementText } : rest;
  }
  if (el.type === 'arrow') {
    const {
      strokeSwatch: _sw,
      strokeWidth: _w,
      strokeStyle: _st,
      flow: _f,
      flowSpeed: _fs,
      strokeColor: _c,
      ...rest
    } = el;
    return theme.elementStroke ? { ...rest, strokeColor: theme.elementStroke } : rest;
  }
  const {
    strokeSwatch: _sw,
    fillSwatch: _fw,
    colorPreset: _p,
    strokeWidth: _w,
    strokeStyle: _st,
    textAlignX: _ta,
    iconPosition: _ip,
    strokeColor: _sc,
    fillColor: _fc,
    textColor: _tc,
    ...rest
  } = el;
  return {
    ...rest,
    ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
    ...(theme.elementFill ? { fillColor: theme.elementFill } : {}),
    ...(theme.elementText ? { textColor: theme.elementText } : {}),
  };
}
