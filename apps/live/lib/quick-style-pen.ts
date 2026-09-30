// The quick style panel's pen rows on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "The
// quick style panel stays"): the colour and width of the selected pen strokes, or, with nothing
// selected, of the pen in hand. In the pens' own palette and named widths, never the theme swatches.
import type { Element, FreehandElement } from '@livediagram/document';
import {
  PEN_NAMES,
  WHITEBOARD_PEN_COLOURS,
  WHITEBOARD_PEN_WIDTHS,
  penAdjustsColour,
  type WhiteboardPen,
  type WhiteboardPenId,
} from './whiteboard-prefs';

// The board's ink as a choice: an unpainted stroke, drawn in whatever ink the appearance gives.
export const INK_CHOICE = 'ink';
export type PenColourChoice = typeof INK_CHOICE | string;
export type PenWidthId = 'fine' | 'medium' | 'bold';

export type PenColourOption = { value: PenColourChoice; name: string; swatch: string };
export type QuickPenStyle = {
  // What the rows style: the selected strokes, or the pen in hand.
  subject: { kind: 'strokes'; ids: string[] } | { kind: 'pen'; id: WhiteboardPenId; name: string };
  // Absent for the main pen, which is always the ink.
  colour?: { value: PenColourChoice | null; options: PenColourOption[] };
  width: { value: PenWidthId | null };
};

export function isPenStroke(el: Element): el is FreehandElement {
  return (
    el.type === 'freehand' &&
    el.penWidth !== undefined &&
    el.pen !== 'highlighter' &&
    el.locked !== true
  );
}

const namedColours = (): PenColourOption[] =>
  WHITEBOARD_PEN_COLOURS.map((c) => ({ value: c.hex, name: c.label, swatch: c.hex }));

const widthIdOf = (px: number | undefined): PenWidthId | null =>
  (WHITEBOARD_PEN_WIDTHS.find((w) => w.px === px)?.id as PenWidthId | undefined) ?? null;

const shared = <T>(values: T[]): T | null =>
  values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null;

export function strokesPenStyle(
  selected: readonly Element[],
  ink: string,
): QuickPenStyle | undefined {
  const strokes = selected.filter(isPenStroke);
  if (strokes.length === 0) return undefined;
  const colours = strokes.map((s) => s.strokeColor?.toLowerCase() ?? INK_CHOICE);
  return {
    subject: { kind: 'strokes', ids: strokes.map((s) => s.id) },
    colour: {
      value: shared(colours),
      options: [{ value: INK_CHOICE, name: 'Ink', swatch: ink }, ...namedColours()],
    },
    width: { value: shared(strokes.map((s) => widthIdOf(s.penWidth))) },
  };
}

export function heldPenStyle(pen: WhiteboardPen): QuickPenStyle {
  return {
    subject: { kind: 'pen', id: pen.id, name: PEN_NAMES[pen.id] },
    ...(penAdjustsColour(pen) ? { colour: { value: pen.colour, options: namedColours() } } : {}),
    width: { value: widthIdOf(pen.width) },
  };
}

export const penWidthPx = (id: PenWidthId): number =>
  WHITEBOARD_PEN_WIDTHS.find((w) => w.id === id)!.px;

export function applyPenStyle(
  el: Element,
  patch: { colour?: PenColourChoice; width?: PenWidthId },
): Element {
  if (!isPenStroke(el)) return el;
  let next: FreehandElement = el;
  if (patch.colour !== undefined) {
    const { strokeColor: _drop, ...rest } = next;
    next = patch.colour === INK_CHOICE ? rest : { ...rest, strokeColor: patch.colour };
  }
  if (patch.width !== undefined) next = { ...next, penWidth: penWidthPx(patch.width) };
  return next;
}
