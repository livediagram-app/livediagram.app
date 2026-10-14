// Badges and step numbers (docs/specs/009-elements/badge.md, docs/specs/009-elements/step-number.md): the small
// marks a diagram pins to its nodes. "Chip" is the code's word for the two of them; the product never says it.
// Pure: their looks, a badge's size from its text, and step numbering. Attachment lives in attachment.ts.
//
// A LEAF module (types only from './index').

import { colorWash } from './color-wash';
import { labelOn } from './readable-colour';
import { labelFontPx } from './label-font';
import { isLightColor } from './colors';
import type { Element, ShapeElement, TextSize } from './index';

export type ChipShape = 'badge' | 'step';
export type ChipLook = 'solid' | 'ink' | 'outline' | 'tinted' | 'quiet';
export const CHIP_LOOKS: readonly ChipLook[] = ['solid', 'ink', 'outline', 'tinted', 'quiet'];

export const BADGE_LABEL_MAX = 24;
export const STEP_LABEL_MAX = 3;
export const STEP_SIZE_PX = 28;
export const STEP_SEQUENCE_BEAT_S = 0.4;

export function isChipShape(kind: string): kind is ChipShape {
  return kind === 'badge' || kind === 'step';
}

export function isChipLook(v: unknown): v is ChipLook {
  return typeof v === 'string' && (CHIP_LOOKS as readonly string[]).includes(v);
}

export function isChip(el: Element): el is ShapeElement & { shape: ChipShape } {
  return el.type === 'shape' && isChipShape(el.shape);
}

/** The look a chip draws in: its own, else a badge's Solid and a step's Ink. */
export function chipLookOf(el: ShapeElement): ChipLook {
  if (isChipLook(el.chipLook)) return el.chipLook;
  return el.shape === 'step' ? 'ink' : 'solid';
}

/**
 * A look's colours from the element's resolved ones: `accent` its stroke (the theme accent on a fresh chip),
 * `surface` its fill and `ink` its text colour.
 */
export function chipColours(
  look: ChipLook,
  c: { accent: string; surface: string; ink: string },
): {
  fill: string;
  text: string;
  border: string | null;
  textOpacity: number;
  // An opaque ground under a translucent fill, so a tinted chip on a host's border still reads as one pill.
  base: string | null;
} {
  switch (look) {
    case 'solid':
      return { fill: c.accent, text: labelOn(c.accent), border: null, textOpacity: 1, base: null };
    case 'ink': {
      // Always a dark disc with a light number: on dark paper the ink is the light one.
      const inkIsLight = isLightColor(c.ink);
      return {
        fill: inkIsLight ? c.surface : c.ink,
        text: inkIsLight ? c.ink : c.surface,
        border: null,
        textOpacity: 1,
        base: null,
      };
    }
    case 'outline':
      return { fill: c.surface, text: c.accent, border: c.accent, textOpacity: 1, base: null };
    case 'tinted':
      return {
        fill: colorWash(c.accent, 0.15),
        text: c.accent,
        border: null,
        textOpacity: 1,
        base: c.surface,
      };
    case 'quiet':
      return {
        fill: colorWash(c.ink, 0.08),
        text: c.ink,
        border: null,
        textOpacity: 0.75,
        base: c.surface,
      };
  }
}

/** A badge's box from its text: as tall as 1.7 lines of its label's own font, as wide as its characters (no DOM
 *  headless, so the canvas and the export size from the same estimate) plus padding, never narrower than tall. The
 *  label draws through the ordinary label path at that font, centred. */
export function badgeSize(
  label: string,
  textSize: TextSize | undefined,
): { width: number; height: number; fontPx: number } {
  const fontPx = labelFontPx(textSize ?? 'sm');
  const height = Math.round(fontPx * 1.7);
  const width = Math.max(height, Math.ceil(label.length * fontPx * 0.6) + Math.round(height * 0.6));
  return { width, height, fontPx };
}

/** A step's number, half the disc tall, so resizing the disc grows the number with it. */
export function stepFontPx(size: number): number {
  return Math.max(8, Math.round(size * 0.5));
}

// --- Steps ----------------------------------------------------------------------------------------

const wholeNumber = (label: string | undefined): number | null =>
  label !== undefined && /^\d+$/.test(label.trim()) ? Number(label.trim()) : null;

/** The number a new step takes: one more than the highest whole-number step on the tab, else 1. */
export function nextStepNumber(elements: readonly Element[]): string {
  let max = 0;
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'step') continue;
    const n = wholeNumber(el.label);
    if (n !== null && n > max) max = n;
  }
  return String(max + 1);
}

/** A step's position in its sequence (its whole-number label), for Play in Order; null when it has none. */
export function stepOrdinal(el: ShapeElement): number | null {
  return el.shape === 'step' ? wholeNumber(el.label) : null;
}

/**
 * Every step on the tab numbered 1, 2, 3 … in reading order: rows top to bottom (a row is the steps whose centres
 * sit within half a step's height of the row's first), then left to right in each row.
 */
export function renumberSteps(elements: Element[]): Element[] {
  const steps = elements.filter(
    (el): el is ShapeElement => el.type === 'shape' && el.shape === 'step',
  );
  if (steps.length === 0) return elements;
  const centre = (el: ShapeElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
  const byY = [...steps].sort((a, b) => centre(a).y - centre(b).y || centre(a).x - centre(b).x);
  const rows: ShapeElement[][] = [];
  for (const step of byY) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(centre(step).y - centre(row[0]!).y) <= row[0]!.height / 2) row.push(step);
    else rows.push([step]);
  }
  const numbers = new Map<string, string>();
  let n = 0;
  for (const row of rows)
    for (const step of row.sort((a, b) => centre(a).x - centre(b).x))
      numbers.set(step.id, String(++n));
  return elements.map((el) => {
    const label = numbers.get(el.id);
    if (label === undefined || (el as ShapeElement).label === label) return el;
    // The number is the label; a formatted label's runs would still say the old one.
    const { richText: _runs, ...rest } = el as ShapeElement;
    return { ...rest, label } as Element;
  });
}

/** Set (or clear back to the kind's default, with `null`) a chip's look. */
export function withChipLook<T extends Element>(el: T, look: ChipLook | null): T {
  if (!isChip(el)) return el;
  const next = { ...el } as T & { chipLook?: ChipLook };
  if (look) next.chipLook = look;
  else delete next.chipLook;
  return next;
}

/** Play in Order on (or off) for every step on the tab: order is a property of the set. */
export function withStepSequence(elements: Element[], on: boolean): Element[] {
  return elements.map((el) => {
    if (el.type !== 'shape' || el.shape !== 'step' || !!el.stepSequence === on) return el;
    if (on) return { ...el, stepSequence: true };
    const { stepSequence: _off, ...rest } = el;
    return rest as Element;
  });
}
