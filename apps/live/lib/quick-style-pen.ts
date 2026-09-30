// The quick style panel's marker rows on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "The
// quick style panel stays"): the colour and width of the selected marker strokes, or, with nothing
// selected, of the marker in hand. Quick choices only: Marker colour is the eight stock colours (Ink
// first), adaptive per board, then, only when custom colours are used on this tab, a second section
// of them, most recently drawn first; Marker width is the pens' named widths.
import {
  PEN_COLOUR_NAMES,
  isCustomPenColour,
  isPenColourName,
  penColourCss,
  type Appearance,
  type Element,
  type FreehandElement,
  type PenColour,
} from '@livediagram/document';
import {
  PEN_NAMES,
  WHITEBOARD_PEN_WIDTHS,
  colourLabel,
  penAdjustsColour,
  type WhiteboardPen,
  type WhiteboardPenId,
} from './whiteboard-prefs';

// The board's ink as a choice: an unpainted stroke, drawn in whatever ink the appearance gives.
export const INK_CHOICE = 'ink';
export type PenColourChoice = typeof INK_CHOICE | PenColour;
export type PenWidthId = 'fine' | 'medium' | 'bold';

// How many custom colours of the tab the second section offers.
export const TAB_CUSTOM_COLOURS_MAX = 8;

export type PenColourOption = { value: PenColourChoice; name: string; swatch: string };
export type QuickPenStyle = {
  // What the rows style: the selected strokes, or the pen in hand.
  // `name` captions the rows, so the panel says whose style it is.
  subject:
    | { kind: 'strokes'; ids: string[]; name: string }
    | { kind: 'pen'; id: WhiteboardPenId; name: string };
  // Every pen has both rows, so Marker width never moves between pens: the main pen's colour row
  // holds its one colour, the ink.
  colour: {
    value: PenColourChoice | null;
    // The stock colours (the ink alone for the main pen).
    options: PenColourOption[];
    // The tab's custom colours, most recently drawn first; empty: no second section.
    custom: PenColourOption[];
  };
  width: { value: PenWidthId | null };
};

// Where the panel's colours come from: the viewer's board and ink, and the tab's custom colours.
export type PenPalette = { board: Appearance; ink: string; custom: readonly string[] };

export function isPenStroke(el: Element): el is FreehandElement {
  return (
    el.type === 'freehand' &&
    el.penWidth !== undefined &&
    el.pen !== 'highlighter' &&
    el.locked !== true
  );
}

/**
 * The custom (hex) colours used on a whiteboard tab, most recently drawn first (the later in the
 * tab, the more recent), at most eight: its marker strokes' and its shapes' and lines' own colours.
 */
export function tabCustomColours(elements: readonly Element[]): string[] {
  const out: string[] = [];
  for (let i = elements.length - 1; i >= 0 && out.length < TAB_CUSTOM_COLOURS_MAX; i--) {
    const el = elements[i]!;
    const drawn =
      (el.type === 'freehand' && el.penWidth !== undefined && el.pen !== 'highlighter') ||
      el.type === 'shape' ||
      el.type === 'arrow';
    const colour = drawn ? (el as { strokeColor?: string }).strokeColor : undefined;
    if (!isCustomPenColour(colour)) continue;
    const hex = colour.toLowerCase();
    if (!out.includes(hex)) out.push(hex);
  }
  return out;
}

const optionOf = (colour: PenColour, palette: PenPalette): PenColourOption => ({
  value: colour,
  name: colourLabel(colour),
  swatch: penColourCss(colour, palette.board, palette.ink),
});
const inkOption = (palette: PenPalette): PenColourOption => ({
  value: INK_CHOICE,
  name: 'Ink',
  swatch: palette.ink,
});
const stockOptions = (palette: PenPalette) => [
  inkOption(palette),
  ...PEN_COLOUR_NAMES.map((c) => optionOf(c, palette)),
];
const customOptions = (palette: PenPalette) => palette.custom.map((c) => optionOf(c, palette));

const widthIdOf = (px: number | undefined): PenWidthId | null =>
  (WHITEBOARD_PEN_WIDTHS.find((w) => w.px === px)?.id as PenWidthId | undefined) ?? null;

const shared = <T>(values: T[]): T | null =>
  values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null;

// A stroke's colour as a choice: its custom hex, its stock name, or the ink.
const colourOfStroke = (s: FreehandElement): PenColourChoice =>
  s.strokeColor?.toLowerCase() ?? s.penColour ?? INK_CHOICE;

export function strokesPenStyle(
  selected: readonly Element[],
  palette: PenPalette,
): QuickPenStyle | undefined {
  const strokes = selected.filter(isPenStroke);
  if (strokes.length === 0) return undefined;
  return {
    subject: {
      kind: 'strokes',
      ids: strokes.map((s) => s.id),
      name: strokes.length === 1 ? 'Marker stroke' : `${strokes.length} marker strokes`,
    },
    colour: {
      value: shared(strokes.map(colourOfStroke)),
      options: stockOptions(palette),
      custom: customOptions(palette),
    },
    width: { value: shared(strokes.map((s) => widthIdOf(s.penWidth))) },
  };
}

export function heldPenStyle(pen: WhiteboardPen, palette: PenPalette): QuickPenStyle {
  return {
    subject: { kind: 'pen', id: pen.id, name: PEN_NAMES[pen.id] },
    colour: penAdjustsColour(pen)
      ? {
          value: pen.colour ?? INK_CHOICE,
          options: stockOptions(palette),
          custom: customOptions(palette),
        }
      : { value: INK_CHOICE, options: [inkOption(palette)], custom: [] },
    width: { value: widthIdOf(pen.width) },
  };
}

export const penWidthPx = (id: PenWidthId): number =>
  WHITEBOARD_PEN_WIDTHS.find((w) => w.id === id)!.px;

/**
 * A marker stroke restyled: the ink clears its colour, a stock colour is kept by name (drawn in its
 * version for each board), a custom colour as its hex.
 */
export function applyPenStyle(
  el: Element,
  patch: { colour?: PenColourChoice; width?: PenWidthId },
): Element {
  if (!isPenStroke(el)) return el;
  let next: FreehandElement = el;
  if (patch.colour !== undefined) {
    const { strokeColor: _stroke, penColour: _named, ...rest } = next;
    next =
      patch.colour === INK_CHOICE
        ? rest
        : isPenColourName(patch.colour)
          ? { ...rest, penColour: patch.colour }
          : { ...rest, strokeColor: patch.colour };
  }
  if (patch.width !== undefined) next = { ...next, penWidth: penWidthPx(patch.width) };
  return next;
}
