// Excalidraw style to board-scene style (docs/specs/020-import-export/excalidraw-import-export.md
// "Scene mapping"): colours stay light-reference (the landing decides ink and stock colours),
// element opacity multiplies into every colour, freedraw reports the width Excalidraw paints.

import type { SceneColour, SceneHead, SceneStroke, SceneText } from './board-scene/scene';
import { EXCALIDRAW_NOTE, type SceneNotes } from './excalidraw-scene-notes';
import type { ExcalidrawElement } from './excalidraw-types';

/**
 * Freedraw's painted width per unit of `strokeWidth` (Excalidraw `shape.ts`): constant strokes are
 * a laser-pointer outline of radius 1.4 w, variable ones a perfect-freehand stroke of size 4.25 w.
 */
export const EXCALIDRAW_FREEDRAW_WIDTH_FACTOR = { constant: 2.8, variable: 4.25 } as const;
/** Excalidraw's default `strokeWidth` and `fontSize`. */
export const EXCALIDRAW_DEFAULT_STROKE_WIDTH = 2;
export const EXCALIDRAW_DEFAULT_FONT_SIZE = 20;
/** Excalidraw `FONT_FAMILY`: Virgil 1, Excalifont 5 are hand-drawn; Cascadia 3, Comic Shanns 8 code. */
export const EXCALIDRAW_FONT_FAMILY = { hand: [1, 5], mono: [3, 8] } as const;

export type ReadColour =
  { kind: 'none' } | { kind: 'colour'; colour: SceneColour } | { kind: 'unreadable' };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function readColour(value: unknown): ReadColour {
  if (value === 'transparent') return { kind: 'none' };
  if (typeof value !== 'string' || !HEX.test(value)) return { kind: 'unreadable' };
  let digits = value.slice(1).toLowerCase();
  if (digits.length === 3) digits = [...digits].map((c) => c + c).join('');
  const hex = `#${digits.slice(0, 6)}`;
  if (digits.length === 8) {
    const alpha = parseInt(digits.slice(6), 16) / 255;
    return { kind: 'colour', colour: alpha < 1 ? { hex, alpha } : { hex } };
  }
  return { kind: 'colour', colour: { hex } };
}

/** Excalidraw `opacity` (0 to 100) as a 0..1 factor; absent or not finite is 1. */
export function opacityFactor(opacity: number | undefined): number {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) return 1;
  return Math.min(1, Math.max(0, opacity / 100));
}

const withFactor = (colour: SceneColour, factor: number): SceneColour => {
  const alpha = (colour.alpha ?? 1) * factor;
  return alpha < 1 ? { hex: colour.hex, alpha } : { hex: colour.hex };
};

const finite = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function widthPxOf(el: ExcalidrawElement): number {
  const w = Math.max(0, finite(el.strokeWidth, EXCALIDRAW_DEFAULT_STROKE_WIDTH));
  if (el.type !== 'freedraw') return w;
  const constant = el.strokeOptions?.variability === 'constant';
  return w * EXCALIDRAW_FREEDRAW_WIDTH_FACTOR[constant ? 'constant' : 'variable'];
}

/** An element's line; `null` when Excalidraw draws none (a `transparent` stroke). */
export function strokeOf(el: ExcalidrawElement, notes: SceneNotes): SceneStroke | null {
  const read = readColour(el.strokeColor);
  if (read.kind === 'none') return null;
  if (read.kind === 'unreadable') notes.add(EXCALIDRAW_NOTE.unreadableColour);
  const factor = opacityFactor(el.opacity);
  const stroke: SceneStroke = {
    colour: read.kind === 'colour' ? read.colour : 'ink',
    widthPx: widthPxOf(el),
  };
  if (el.strokeStyle === 'dashed' || el.strokeStyle === 'dotted') stroke.dash = el.strokeStyle;
  if (factor < 1) stroke.opacity = factor;
  return stroke;
}

/** An element's fill; undefined when unfilled (or unreadable, with a note). */
export function fillOf(el: ExcalidrawElement, notes: SceneNotes): SceneColour | undefined {
  const read = readColour(el.backgroundColor);
  if (read.kind === 'none') return undefined;
  if (read.kind === 'unreadable') {
    notes.add(EXCALIDRAW_NOTE.unreadableColour);
    return undefined;
  }
  return withFactor(read.colour, opacityFactor(el.opacity));
}

export function fontFamilyOf(family: number | undefined): SceneText['family'] {
  if ((EXCALIDRAW_FONT_FAMILY.hand as readonly unknown[]).includes(family)) return 'hand';
  if ((EXCALIDRAW_FONT_FAMILY.mono as readonly unknown[]).includes(family)) return 'mono';
  return 'sans';
}

const ALIGN_X = ['left', 'center', 'right'] as const;
const ALIGN_Y = ['top', 'middle', 'bottom'] as const;

/** A text element's content and look; its box is the caller's. */
export function sceneTextOf(el: ExcalidrawElement, notes: SceneNotes): SceneText {
  const read = readColour(el.strokeColor);
  if (read.kind === 'unreadable') notes.add(EXCALIDRAW_NOTE.unreadableColour);
  const text: SceneText = {
    // A file is untrusted: a `text` that is not a string (a number, an object) reads as none, never as
    // a value the landing steps would call string methods on.
    text:
      typeof el.originalText === 'string'
        ? el.originalText
        : typeof el.text === 'string'
          ? el.text
          : '',
    fontPx: Math.max(1, finite(el.fontSize, EXCALIDRAW_DEFAULT_FONT_SIZE)),
    family: fontFamilyOf(el.fontFamily),
    colour: read.kind === 'colour' ? withFactor(read.colour, opacityFactor(el.opacity)) : 'ink',
  };
  const alignX = ALIGN_X.find((a) => a === el.textAlign);
  const alignY = ALIGN_Y.find((a) => a === el.verticalAlign);
  if (alignX) text.alignX = alignX;
  if (alignY) text.alignY = alignY;
  return text;
}

const HEADS: Record<string, SceneHead> = {
  arrow: 'arrow',
  bar: 'bar',
  triangle: 'triangle',
  triangle_outline: 'triangle-hollow',
  dot: 'circle',
  circle: 'circle',
  circle_outline: 'circle-hollow',
  diamond: 'diamond',
  diamond_outline: 'diamond-hollow',
};

/** An arrowhead; one with no counterpart (crow's feet, unknown) is a plain arrow, noted. */
export function headOf(value: string | null | undefined, notes: SceneNotes): SceneHead | undefined {
  if (value === null || value === undefined) return undefined;
  const head = HEADS[value];
  if (head) return head;
  notes.add(EXCALIDRAW_NOTE.unmatchedHeads);
  return 'arrow';
}
