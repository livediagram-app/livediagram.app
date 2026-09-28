// The property maps every draw.io vertex shares
// (docs/specs/020-import-export/blueprints/drawio-import.md step 10): colours,
// stroke, corners, opacity, rotation, shadow, lock, link, note, and the text.

import {
  ARROWHEAD_SIZE_PX,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  FONTS,
  LABEL_FONT_PX,
  isLightColor,
  NOTE_FONT_PX,
  arrowLabelFontSize,
  type ArrowheadSize,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type ElementLink,
  type TextAlignX,
  type TextAlignY,
  type TextRun,
  type TextSize,
} from '@livediagram/diagram';
import type { ReportTally } from '@/lib/import-report';
import type { DrawioCell } from './cells';
import { readColour } from './colour';
import { readLabel } from './label';
import { DRAWIO_DEFAULT_ARC_SIZE, DRAWIO_SHADOW } from './limits';
import type { DrawioStyle } from './style';

export type ConvertContext = {
  tally: ReportTally;
  /** draw.io page id → the livediagram tab it became. */
  pageIdToTab: ReadonlyMap<string, string>;
};

/** Nearest entry of a px table; ties go to the earlier (smaller) entry. */
function nearest<K extends string>(table: Record<K, number>, keys: readonly K[], px: number): K {
  let best = keys[0]!;
  for (const k of keys) {
    if (Math.abs(table[k] - px) < Math.abs(table[best] - px)) best = k;
  }
  return best;
}

const STROKES: readonly BorderStroke[] = ['thin', 'medium', 'thick', 'extra-thick'];

/** A stroke width in px as a border preset (D17, D18: absent is draw.io's 1 px). */
export function strokePreset(px: number | undefined): BorderStroke {
  if (px === undefined) return 'thin';
  if (px <= 0) return 'none';
  return nearest(BORDER_STROKE_PX, STROKES, px);
}

/** `dashed` / `dashPattern` as a line style; undefined when solid. */
export function dashStyle(style: DrawioStyle): BorderStyle | undefined {
  if (!style.flag('dashed')) return undefined;
  const pattern = (style.str('dashPattern') ?? '')
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (pattern.length >= 2) {
    const dotted = pattern.every((n, i) => i % 2 === 1 || n <= (pattern[i + 1] ?? n));
    if (dotted) return 'dotted';
  }
  return 'dashed';
}

const RADII: readonly BorderRadius[] = ['none', 'sm', 'md', 'lg'];

/** `rounded` / `arcSize` as a corner preset for a box of this size. */
export function radiusPreset(style: DrawioStyle, width: number, height: number): BorderRadius {
  if (!style.flag('rounded')) return 'none';
  const arc = style.num('arcSize') ?? DRAWIO_DEFAULT_ARC_SIZE;
  const shorter = Math.min(width, height);
  const radius = style.flag('absoluteArcSize') ? arc : (arc / 100) * shorter;
  if (radius >= shorter / 2) return 'full';
  return nearest(BORDER_RADIUS_PX, RADII, radius);
}

export type TextScale = 'label' | 'note' | 'arrow';
const SIZES: readonly TextSize[] = ['sm', 'md', 'lg'];
const ARROW_PX = {
  sm: arrowLabelFontSize('sm'),
  md: arrowLabelFontSize('md'),
  lg: arrowLabelFontSize('lg'),
};

/** A draw.io font size as the preset nearest on the element's own scale (D26). */
export function fontSizePreset(px: number, scale: TextScale): TextSize {
  const table = scale === 'note' ? NOTE_FONT_PX : scale === 'arrow' ? ARROW_PX : LABEL_FONT_PX;
  return nearest(table as Record<TextSize, number>, SIZES, px);
}

export function arrowheadSizePreset(px: number): ArrowheadSize {
  return nearest(ARROWHEAD_SIZE_PX, ['small', 'medium', 'large', 'extra-large'] as const, px);
}

const SKETCHY = ['comic', 'architects daughter', 'xkcd', 'caveat', 'indie flower'];
const MONO = ['mono', 'courier', 'consol'];

/** A draw.io font family as a livediagram font id, when one matches. */
export function fontIdFor(family: string | undefined): string | undefined {
  const first =
    family
      ?.split(',')[0]
      ?.trim()
      .replace(/^["']|["']$/g, '')
      .toLowerCase() ?? '';
  if (first === '') return undefined;
  const own = FONTS.find((f) => f.id === first || f.label.toLowerCase() === first);
  if (own) return own.id;
  if (MONO.some((m) => first.includes(m))) return 'roboto-mono';
  if (SKETCHY.some((s) => first.includes(s))) return 'caveat';
  return undefined;
}

const SAFE_URL = /^(https?:|mailto:)/i;
const PAGE_LINK = /^data:page\/id,(.+)$/;

/** A cell's link as an element link; anything unfollowable is dropped and counted. */
export function elementLink(
  link: string | undefined,
  ctx: ConvertContext,
): ElementLink | undefined {
  if (!link) return undefined;
  const trimmed = link.trim();
  if (SAFE_URL.test(trimmed)) return { kind: 'url', url: trimmed };
  const page = PAGE_LINK.exec(trimmed);
  const tabId = page ? ctx.pageIdToTab.get(page[1]!) : undefined;
  if (tabId) return { kind: 'tab', tabId };
  ctx.tally.add('link-dropped');
  return undefined;
}

/** The tooltip and custom properties as a note. */
export function noteOf(cell: DrawioCell): string | undefined {
  const lines = [
    ...(cell.tooltip ? [cell.tooltip] : []),
    ...cell.props.map(([k, v]) => `${k}: ${v}`),
  ];
  return lines.length > 0 ? lines.join('\n') : undefined;
}

/** Fields every boxed element takes from its cell. */
export function boxedProps(cell: DrawioCell, ctx: ConvertContext) {
  const s = cell.style;
  const fill = readColour(s.str('fillColor'));
  const stroke = readColour(s.str('strokeColor'));
  const opacity = s.num('opacity');
  const rotation = (((s.num('rotation') ?? 0) % 360) + 360) % 360;
  const link = elementLink(cell.link, ctx);
  const note = noteOf(cell);
  const strokeWidth = stroke.kind === 'none' ? 'none' : strokePreset(s.num('strokeWidth'));
  const strokeStyle = dashStyle(s);
  return {
    ...(fill.kind === 'hex' ? { fillColor: fill.value } : {}),
    ...(fill.kind === 'none' ? { fillColor: 'transparent' } : {}),
    ...(stroke.kind === 'hex' ? { strokeColor: stroke.value } : {}),
    strokeWidth,
    ...(strokeStyle ? { strokeStyle } : {}),
    ...(opacity !== undefined && opacity < 100 ? { opacity: Math.max(0, opacity) / 100 } : {}),
    ...(rotation !== 0 ? { rotation } : {}),
    ...(s.flag('shadow') ? { shadow: DRAWIO_SHADOW } : {}),
    ...(s.flag('locked') ? { locked: true } : {}),
    ...(link ? { link } : {}),
    ...(note ? { note } : {}),
  };
}

const ALIGN_X: Record<string, TextAlignX> = { left: 'left', center: 'center', right: 'right' };
const ALIGN_Y: Record<string, TextAlignY> = { top: 'top', middle: 'middle', bottom: 'bottom' };

// draw.io's default label ink is black on paper. On a fill of the element's own
// the theme's text colour no longer belongs (it pairs with the theme's fill),
// so an uncoloured label takes the ink that reads on that fill.
const INK_ON_LIGHT = '#1e293b';
const INK_ON_DARK = '#ffffff';

/** The ink for an uncoloured label on this fill; undefined without a fill. */
export function inkOnFill(fill: string | undefined): string | undefined {
  if (!fill || !fill.startsWith('#')) return undefined;
  return isLightColor(fill) ? INK_ON_LIGHT : INK_ON_DARK;
}

export type TextOptions = {
  scale: TextScale;
  /** The element's own fill behind the label, when it has one. */
  onFill?: string;
  /** Whether the element kind carries `richText`. */
  rich: boolean;
  /** Whether a label draw.io draws outside the box is moved in (and counted). */
  outsideMovesIn: boolean;
};

export type TextFields = {
  label?: string;
  richText?: TextRun[];
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  textColor?: string;
  textSize: TextSize;
  font?: string;
  textAlignX: TextAlignX;
  textAlignY: TextAlignY;
};

/** The label and its styling. */
export function textProps(cell: DrawioCell, ctx: ConvertContext, options: TextOptions): TextFields {
  const s = cell.style;
  const { plain, runs } = readLabel(cell.value, cell.html);
  const fontStyle = s.num('fontStyle') ?? 0;
  const color = readColour(s.str('fontColor'));
  const font = fontIdFor(s.str('fontFamily'));
  let alignX = ALIGN_X[s.str('align') ?? 'center'] ?? 'center';
  let alignY = ALIGN_Y[s.str('verticalAlign') ?? 'middle'] ?? 'middle';
  if (options.outsideMovesIn) {
    const side = s.str('labelPosition');
    const vside = s.str('verticalLabelPosition');
    const outside = side === 'left' || side === 'right' || vside === 'top' || vside === 'bottom';
    if (side === 'left' || side === 'right') alignX = side;
    if (vside === 'top' || vside === 'bottom') alignY = vside;
    if (outside && plain !== '') ctx.tally.add('label-moved');
  }
  return {
    ...(plain !== '' ? { label: plain } : {}),
    ...(options.rich && runs ? { richText: runs } : {}),
    ...(fontStyle & 1 ? { textBold: true } : {}),
    ...(fontStyle & 2 ? { textItalic: true } : {}),
    ...(fontStyle & 4 ? { textUnderline: true } : {}),
    ...(fontStyle & 8 ? { textStrikethrough: true } : {}),
    ...(color.kind === 'hex'
      ? { textColor: color.value }
      : inkOnFill(options.onFill) && plain !== ''
        ? { textColor: inkOnFill(options.onFill) }
        : {}),
    textSize: fontSizePreset(s.num('fontSize') ?? 12, options.scale),
    ...(font ? { font } : {}),
    textAlignX: alignX,
    textAlignY: alignY,
  };
}
