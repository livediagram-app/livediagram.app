// The property maps every draw.io vertex shares
// (docs/specs/020-import-export/blueprints/drawio-import.md step 10): colours,
// stroke, corners, opacity, rotation, shadow, lock, link, note, and the text.

import {
  arrowheadLengthPx,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  FONTS,
  isLightColor,
  normalizeRuns,
  type ArrowheadSize,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type ElementLink,
  type TextAlignX,
  type TextAlignY,
  type TextRun,
  type TextSize,
} from '@livediagram/document';
import type { ReportTally } from './notes';
import type { DrawioCell } from './cells';
import { readColour } from './colour';
import { cellLabel } from './label';
import { DRAWIO_DEFAULT_ARC_SIZE, DRAWIO_SHADOW } from './limits';
import { nearest } from './nearest';
import {
  belowExtraSmall,
  elementTextSize,
  labelIsExtraSmall,
  runTextSize,
  type TextScale,
} from './text-size';
import type { DrawioStyle } from './style';

export type ConvertContext = {
  tally: ReportTally;
  /** draw.io page id → the livediagram tab it became. */
  pageIdToTab: ReadonlyMap<string, string>;
  /** The page scale (spec "The page scale"); 1 when absent. */
  scale?: number;
};

const STROKES: readonly BorderStroke[] = ['thin', 'medium', 'thick', 'extra-thick'];

/** A stroke width in px as a border preset (D17, D18: absent is draw.io's 1 px). */
export function strokePreset(px: number | undefined): BorderStroke {
  if (px === undefined) return 'thin';
  if (px <= 0) return 'none';
  return nearest(BORDER_STROKE_PX, STROKES, px);
}

// A dash at most this many stroke widths long reads as a dot (D38).
export const DRAWIO_DOT_MAX_STROKES = 2;

/** `dashed` / `dashPattern` as a line style; undefined when solid. */
export function dashStyle(style: DrawioStyle): BorderStyle | undefined {
  if (!style.flag('dashed')) return undefined;
  const pattern = (style.str('dashPattern') ?? '')
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (pattern.length >= 2) {
    // draw.io scales the pattern by the stroke width unless `fixDash=1` keeps it in px.
    const width = style.num('strokeWidth') ?? 1;
    const unit = style.flag('fixDash') ? 1 : width;
    const dotted = pattern.every(
      (n, i) => i % 2 === 1 || n * unit <= DRAWIO_DOT_MAX_STROKES * width,
    );
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

const HEAD_SIZES = ['small', 'medium', 'large', 'extra-large'] as const;

/**
 * The head preset nearest the length draw.io draws (its marker size plus the stroke width), on the
 * canvas's own head length for this stroke; ties to the smaller.
 */
export function arrowheadSizePreset(markerSize: number, strokeWidth: number): ArrowheadSize {
  const target = markerSize + strokeWidth;
  let best: ArrowheadSize = HEAD_SIZES[0];
  for (const size of HEAD_SIZES) {
    const gap = Math.abs(arrowheadLengthPx(size, strokeWidth) - target);
    if (gap < Math.abs(arrowheadLengthPx(best, strokeWidth) - target)) best = size;
  }
  return best;
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
  const basePx = s.num('fontSize') ?? 12;
  // Text under what the extra-small run size shows, anywhere in the label (spec "Text size").
  let belowXs = belowExtraSmall(basePx);
  const read = cellLabel(cell, (px) => {
    if (belowExtraSmall(px)) belowXs = true;
    return runTextSize(px, basePx, options.scale);
  });
  const plain = read.plain;
  // An extra-small label's own runs take xs; only kinds with runs can show it.
  const smallLabel = options.rich && plain !== '' && labelIsExtraSmall(basePx, options.scale);
  const runs = smallLabel
    ? normalizeRuns(
        (read.runs ?? [{ text: plain }]).map((r) => (r.size ? r : { ...r, size: 'xs' as const })),
      )
    : read.runs;
  if (options.rich && plain !== '' && belowXs) ctx.tally.add('text-below-xs');
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
    textSize: elementTextSize(basePx, options.scale),
    ...(font ? { font } : {}),
    textAlignX: alignX,
    textAlignY: alignY,
  };
}
