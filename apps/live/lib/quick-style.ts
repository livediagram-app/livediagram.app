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
  type PathElement,
  type QuickSwatchRole,
  type QuickSwatchSlot,
  type ShapeElement,
  type TextAlignX,
  type TextElement,
  type ThemeDefinition,
} from '@livediagram/document';
import { applySwatchOverrides, type ShownSwatch, type SwatchOverrides } from './swatch-overrides';
import type { PenColourChoice, PenColourOption, QuickPenStyle } from './quick-style-pen';

// The whiteboard's colours as a row: the choice the targets share, the stock options, the tab's own.
export type BoardColourSection = {
  value: PenColourChoice | null;
  options: PenColourOption[];
  custom: PenColourOption[];
};

export type QuickStyleTarget = ShapeElement | ArrowElement | TextElement | PathElement;
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
    // A whiteboard's Stroke and Text colour rows (lib/quick-style-whiteboard): the whiteboard's
    // colours in place of `stroke` and `textColour`.
    boardStroke?: BoardColourSection;
    boardText?: BoardColourSection;
  };
  // A whiteboard's pen rows (lib/quick-style-pen): the selected strokes, or the pen in hand.
  pen?: QuickPenStyle;
  // Names whose style this is when it is not a selection: a tool's next mark.
  caption?: string;
};

// An unlocked shape, arrow, text element or path (docs/specs/023-whiteboard/path-tool.md "Style"):
// the only elements the panel styles.
export function isQuickStyleTarget(el: Element): el is QuickStyleTarget {
  return (
    (el.type === 'shape' || el.type === 'arrow' || el.type === 'text' || el.type === 'path') &&
    el.locked !== true
  );
}

export function supportsQuickSection(el: QuickStyleTarget, section: QuickSectionId): boolean {
  switch (section) {
    case 'stroke':
      return (
        el.type === 'arrow' || el.type === 'path' || (el.type === 'shape' && supportsColours(el))
      );
    case 'background':
      // A path fills only when closed.
      if (el.type === 'path') return el.closed;
      return el.type === 'shape' && supportsFillColor(el);
    case 'textColour':
      return el.type === 'text';
    case 'width':
    case 'style':
      return (
        el.type === 'arrow' ||
        el.type === 'path' ||
        (el.type === 'shape' && supportsBorderControls(el))
      );
    case 'textAlign':
      // Only once the shape has words to align: an empty label has nothing to move.
      return el.type === 'shape' && supportsTextAlign(el.shape) && !!el.label?.trim();
    case 'iconAlign':
      return el.type === 'shape' && acceptsInlineIcon(el) && !!el.iconId;
  }
}

// A target that draws a line (shape or arrow), in a section that styles it.
// One narrowing guard, so the line rows' readers and writers never see text.
function isLinedTarget(
  el: Element,
  section: 'stroke' | 'width' | 'style',
): el is ShapeElement | ArrowElement | PathElement {
  return isQuickStyleTarget(el) && el.type !== 'text' && supportsQuickSection(el, section);
}

// Each colour row's fields: the colour it writes, the slot binding beside it,
// and the theme value slot 0 stands for.
const ROLE_FIELDS = {
  stroke: { colour: 'strokeColor', swatch: 'strokeSwatch', theme: 'elementStroke' },
  fill: { colour: 'fillColor', swatch: 'fillSwatch', theme: 'elementFill' },
  text: { colour: 'textColor', swatch: 'textSwatch', theme: 'elementText' },
} as const satisfies Record<
  QuickSwatchRole,
  { colour: string; swatch: string; theme: keyof ThemeDefinition }
>;
type RoleFields = (typeof ROLE_FIELDS)[QuickSwatchRole];
type RoleValues = Partial<Record<RoleFields['colour'], string>> &
  Partial<Record<RoleFields['swatch'], QuickSwatchSlot>>;

// The field a whiteboard stock colour is stored in by name, per role (fills have none).
const NAMED_FIELD: Record<QuickSwatchRole, 'penColour' | 'penTextColour' | null> = {
  stroke: 'penColour',
  fill: null,
  text: 'penTextColour',
};

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
  const fields = ROLE_FIELDS[role];
  const values = el as RoleValues;
  const bound = values[fields.swatch];
  // A bound slot counts only while the row still shows its theme colour.
  if (bound && !swatches[bound]?.override) return bound;
  const colour = values[fields.colour];
  // A whiteboard stock colour stored by name is no theme swatch (docs/specs/008-canvas/quick-style-panel.md
  // "Multi-selection").
  const named = NAMED_FIELD[role];
  if (colour === undefined && named && (el as Record<string, unknown>)[named] !== undefined) {
    return null;
  }
  if (colour === undefined) return 0;
  const own = theme[fields.theme];
  const lower = colour.toLowerCase();
  if (lower === swatches[0]!.color.toLowerCase() || lower === own?.toLowerCase()) return 0;
  const shown = swatches.find((s) => s.slot !== 0 && s.color.toLowerCase() === lower);
  return shown && shown.slot !== 0 ? shown.slot : null;
}

function widthOf(el: ShapeElement | ArrowElement | PathElement): QuickWidth | null {
  const w = el.type === 'arrow' ? arrowThicknessOf(el) : (el.strokeWidth ?? 'medium');
  return (QUICK_WIDTHS as readonly string[]).includes(w) ? (w as QuickWidth) : null;
}

function styleOf(el: ShapeElement | ArrowElement | PathElement): QuickStrokeStyle | null {
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
  const lined = (s: 'stroke' | 'width' | 'style') => targets.filter((el) => isLinedTarget(el, s));
  const sections: QuickStyleView['sections'] = {};

  const stroke = lined('stroke');
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
  const width = lined('width');
  if (width.length > 0) sections.width = { value: shared(width.map(widthOf)) };
  const style = lined('style');
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
  if (slot === 0) return { colour: theme[ROLE_FIELDS[role].theme] ?? undefined, bind: undefined };
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
  if (!isLinedTarget(el, 'stroke')) return el;
  const { colour, bind } = pickFor(theme, 'stroke', slot, overrides);
  // The swatch replaces a stock colour stored by name.
  const { penColour: _named, ...rest } = el;
  return rest.type === 'shape'
    ? { ...rest, strokeColor: colour, strokeSwatch: bind, colorPreset: undefined }
    : { ...rest, strokeColor: colour, strokeSwatch: bind };
}

export function applyQuickFill(
  el: Element,
  theme: ThemeDefinition,
  slot: QuickSwatchValue,
  overrides: SwatchOverrides = {},
): Element {
  if (
    (el.type !== 'shape' && el.type !== 'path') ||
    !isQuickStyleTarget(el) ||
    !supportsQuickSection(el, 'background')
  )
    return el;
  const { colour, bind } = pickFor(theme, 'fill', slot, overrides);
  return el.type === 'path'
    ? { ...el, fillColor: colour, fillSwatch: bind }
    : { ...el, fillColor: colour, fillSwatch: bind, colorPreset: undefined };
}

export function applyQuickTextColour(
  el: Element,
  theme: ThemeDefinition,
  slot: QuickSwatchValue,
  overrides: SwatchOverrides = {},
): Element {
  if (el.type !== 'text' || !isQuickStyleTarget(el) || !supportsQuickSection(el, 'textColour'))
    return el;
  const { colour, bind } = pickFor(theme, 'text', slot, overrides);
  const { penTextColour: _named, ...rest } = el;
  return { ...rest, textColor: colour, textSwatch: bind };
}

export function applyQuickWidth(el: Element, width: QuickWidth): Element {
  if (!isLinedTarget(el, 'width')) return el;
  return el.type === 'arrow'
    ? { ...el, strokeWidth: ARROW_THICKNESS_PX[width] }
    : { ...el, strokeWidth: width };
}

export function applyQuickStrokeStyle(el: Element, style: QuickStrokeStyle): Element {
  if (!isLinedTarget(el, 'style')) return el;
  if (el.type === 'shape' || el.type === 'path')
    return { ...el, strokeStyle: style === 'flowing' ? 'dashed' : style };
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
    const { textSwatch: _ts, textColor: _tc, penTextColour: _ptc, ...rest } = el;
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
      penColour: _pc,
      penTextColour: _ptc,
      ...rest
    } = el;
    return theme.elementStroke ? { ...rest, strokeColor: theme.elementStroke } : rest;
  }
  if (el.type === 'path') {
    // Back to plain ink: a path takes the theme's line, never a fill (path-tool.md "Style").
    const {
      strokeSwatch: _sw,
      fillSwatch: _fw,
      strokeWidth: _w,
      strokeStyle: _st,
      strokeColor: _sc,
      fillColor: _fc,
      penColour: _pc,
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
    penColour: _pc,
    penTextColour: _ptc,
    ...rest
  } = el;
  return {
    ...rest,
    ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
    ...(theme.elementFill ? { fillColor: theme.elementFill } : {}),
    ...(theme.elementText ? { textColor: theme.elementText } : {}),
  };
}
