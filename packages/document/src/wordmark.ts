// Wordmark type (docs/specs/007-editor/logo-pages.md "Wordmark type"): a text element's tracking,
// weight, case and arc, and the arc's geometry. Pure: the canvas face, the SVG export and the
// controls all read these, so a wordmark looks the same wherever it is drawn.
import type { TextElement } from './element-types';

// Tracking: the space added between letters, in em.
export const LETTER_SPACING_MIN = -0.2;
export const LETTER_SPACING_MAX = 1;
// Arc: the degrees the text bends through, either way.
export const TEXT_ARC_MAX = 360;
// The weights every catalogue font loads (fonts.ts), so a weight never fetches more font bytes.
export const FONT_WEIGHTS = [400, 500, 700] as const;
export type FontWeight = (typeof FONT_WEIGHTS)[number];
export type TextCase = 'upper' | 'lower';
export const TEXT_CASES: readonly TextCase[] = ['upper', 'lower'];
// Room kept for the glyphs outside a circle's baseline: above it on a positive arc (the letters
// stand outward), below it on a negative one (their descenders), in em.
export const ARC_ASCENT = 0.8;
export const ARC_DESCENT = 0.25;
// How far a glyph's middle sits above its baseline, in em: centres a shallow arc in its box.
const GLYPH_MIDDLE = 0.35;

type Wordmark = Pick<TextElement, 'letterSpacing' | 'fontWeight' | 'textCase' | 'textArc'>;

export function isFontWeight(v: unknown): v is FontWeight {
  return (FONT_WEIGHTS as readonly unknown[]).includes(v);
}

export function isTextCase(v: unknown): v is TextCase {
  return v === 'upper' || v === 'lower';
}

/** Whether a text element carries any wordmark type. */
export function hasWordmarkType(el: Wordmark): boolean {
  return (
    el.letterSpacing !== undefined ||
    el.fontWeight !== undefined ||
    el.textCase !== undefined ||
    el.textArc !== undefined
  );
}

/** The text as it is shown: in capitals or lower case when the case says so. What was typed is
 *  kept; only its display changes. */
export function wordmarkDisplayText(text: string, textCase: TextCase | undefined): string {
  if (textCase === 'upper') return text.toLocaleUpperCase();
  if (textCase === 'lower') return text.toLocaleLowerCase();
  return text;
}

/** The weight a text paints in: its own weight, else bold's 700, else regular. */
export function resolvedFontWeight(el: Pick<TextElement, 'fontWeight' | 'textBold'>): number {
  return el.fontWeight ?? (el.textBold ? 700 : 400);
}

/** Tracking clamped to its range and to hundredths of an em; 0 (none) is undefined. */
export function clampLetterSpacing(v: number): number | undefined {
  if (!Number.isFinite(v)) return undefined;
  const c = Math.round(Math.min(LETTER_SPACING_MAX, Math.max(LETTER_SPACING_MIN, v)) * 100) / 100;
  return c === 0 ? undefined : c;
}

/** An arc clamped to whole degrees in range; 0 (flat) is undefined. */
export function clampTextArc(v: number): number | undefined {
  if (!Number.isFinite(v)) return undefined;
  const c = Math.round(Math.min(TEXT_ARC_MAX, Math.max(-TEXT_ARC_MAX, v)));
  return c === 0 ? undefined : c;
}

/** Arched text is one line: line breaks read as spaces. */
export function arcText(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ');
}

const n = (v: number) => Math.round(v * 100) / 100;

/**
 * The baseline arched text sits on, in the element's own px (its top-left at 0,0), traversed left
 * to right as it reads; the text goes on it centred (startOffset 50%, anchor middle). Under 180
 * degrees the arc's ends meet the box's sides (less padding) and the arc's band is centred in the
 * box; from 180 the arc is part of the largest circle that fits the box, less room for the glyphs,
 * centred on the top (bowing up) or the bottom (bowing down). `length` is the baseline's length.
 */
export function arcGeometry(
  box: { width: number; height: number; padding?: number },
  arcDeg: number,
  fontPx: number,
): { d: string; length: number } {
  const pad = box.padding ?? 0;
  const w = Math.max(1, box.width - 2 * pad);
  const h = Math.max(1, box.height - 2 * pad);
  const up = arcDeg > 0;
  const theta = (Math.min(TEXT_ARC_MAX, Math.abs(arcDeg)) * Math.PI) / 180;
  if (theta < Math.PI) {
    const r = w / 2 / Math.sin(theta / 2);
    const sag = r * (1 - Math.cos(theta / 2));
    const y = up
      ? pad + h / 2 + sag / 2 + GLYPH_MIDDLE * fontPx
      : pad + h / 2 - sag / 2 + GLYPH_MIDDLE * fontPx;
    return {
      d: `M ${n(pad)} ${n(y)} A ${n(r)} ${n(r)} 0 0 ${up ? 1 : 0} ${n(pad + w)} ${n(y)}`,
      length: r * theta,
    };
  }
  const cx = box.width / 2;
  const cy = box.height / 2;
  const R = Math.max(fontPx, Math.min(w, h) / 2 - (up ? ARC_ASCENT : ARC_DESCENT) * fontPx);
  // Angles in screen degrees (0 is to the right, 90 is down). Bowing up the arc is centred on the
  // top (-90) and runs clockwise; bowing down it is centred on the bottom (90), anticlockwise, so
  // both read left to right.
  const mid = up ? -90 : 90;
  const half = (theta * 180) / Math.PI / 2;
  const from = up ? mid - half : mid + half;
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${n(cx + R * Math.cos(rad))} ${n(cy + R * Math.sin(rad))}`;
  };
  const sweep = up ? 1 : 0;
  const step = up ? half : -half;
  // Two halves: one SVG arc command cannot draw a whole circle.
  const d =
    `M ${at(from)} A ${n(R)} ${n(R)} 0 0 ${sweep} ${at(from + step)}` +
    ` A ${n(R)} ${n(R)} 0 0 ${sweep} ${at(from + 2 * step)}`;
  return { d, length: R * theta };
}
