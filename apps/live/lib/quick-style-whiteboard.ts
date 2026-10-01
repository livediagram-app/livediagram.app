// The quick style panel on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "The quick style panel
// stays"). A whiteboard has no theme, so its Stroke and Text colour rows offer the whiteboard's
// colours, as Marker colour does: Ink (no colour of its own, drawn in the board's ink), the seven
// stock colours (stored by name, adaptive per board), then the tab's custom colours. Background
// keeps the theme's fills, its first swatch "no fill": an unpainted shape there is drawn unfilled
// (inkWhiteboardElement), so a shape left unfilled reads as that default.
import type { Element, PenColourName } from '@livediagram/document';
import { isPenColourName } from '@livediagram/document';
import {
  isQuickStyleTarget,
  supportsQuickSection,
  type BoardColourSection,
  type QuickStyleView,
} from './quick-style';
import {
  customOptions,
  INK_CHOICE,
  stockOptions,
  type PenColourChoice,
  type PenPalette,
} from './quick-style-pen';

type Coloured = {
  strokeColor?: string;
  penColour?: PenColourName;
  textColor?: string;
  penTextColour?: PenColourName;
};

// The element's colour as a choice: its own hex, its stock name, or the ink.
const strokeChoice = (el: Coloured): PenColourChoice =>
  el.strokeColor?.toLowerCase() ?? el.penColour ?? INK_CHOICE;
const textChoice = (el: Coloured): PenColourChoice =>
  el.textColor?.toLowerCase() ?? el.penTextColour ?? INK_CHOICE;

const shared = <T>(values: T[]): T | null =>
  values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null;

function section(values: PenColourChoice[], palette: PenPalette): BoardColourSection {
  return { value: shared(values), options: stockOptions(palette), custom: customOptions(palette) };
}

// A target whose line the Stroke row colours (a shape that draws one, an arrow, a path).
function takesStroke(el: Element): boolean {
  return isQuickStyleTarget(el) && el.type !== 'text' && supportsQuickSection(el, 'stroke');
}
function takesText(el: Element): boolean {
  return isQuickStyleTarget(el) && supportsQuickSection(el, 'textColour');
}

export function onWhiteboard(
  view: QuickStyleView | null,
  selected: readonly Element[],
  palette: PenPalette,
): QuickStyleView | null {
  if (!view) return view;
  const ids = new Set(view.targetIds);
  const targets = selected.filter((el) => ids.has(el.id));
  const { stroke, textColour, background, ...rest } = view.sections;
  return {
    ...view,
    sections: {
      ...rest,
      ...(stroke
        ? {
            boardStroke: section(
              targets.filter(takesStroke).map((el) => strokeChoice(el as Coloured)),
              palette,
            ),
          }
        : {}),
      ...(background
        ? {
            background: {
              ...background,
              swatches: background.swatches.map((s, i) =>
                i === 0 ? { ...s, color: 'transparent' } : s,
              ),
              // A whiteboard shape stores `transparent`, which IS the default there.
              value: unfilled(targets) ? 0 : background.value,
            },
          }
        : {}),
      ...(textColour
        ? {
            boardText: section(
              targets.filter(takesText).map((el) => textChoice(el as Coloured)),
              palette,
            ),
          }
        : {}),
    },
  };
}

function unfilled(targets: readonly Element[]): boolean {
  return targets.every(
    (el) => el.type !== 'shape' || el.fillColor === undefined || el.fillColor === 'transparent',
  );
}

// The colour fields a choice writes: nothing for the ink, a name, or the exact hex.
function colourFields<N extends string, H extends string>(
  choice: PenColourChoice,
  named: N,
  hex: H,
): Partial<Record<N, PenColourName> & Record<H, string>> {
  if (choice === INK_CHOICE) return {};
  return (isPenColourName(choice) ? { [named]: choice } : { [hex]: choice.toLowerCase() }) as never;
}

/** The Stroke row on a whiteboard: the line's colour, any swatch binding or preset replaced. */
export function applyBoardStroke(el: Element, choice: PenColourChoice): Element {
  if (!takesStroke(el)) return el;
  const {
    strokeColor: _c,
    penColour: _n,
    strokeSwatch: _s,
    ...rest
  } = el as Element & Coloured & { strokeSwatch?: unknown };
  const cleared = rest.type === 'shape' ? { ...rest, colorPreset: undefined } : rest;
  return { ...cleared, ...colourFields(choice, 'penColour', 'strokeColor') } as Element;
}

/** The Text colour row on a whiteboard: a text box's colour, any swatch binding replaced. */
export function applyBoardTextColour(el: Element, choice: PenColourChoice): Element {
  if (!takesText(el) || el.type !== 'text') return el;
  const { textColor: _c, penTextColour: _n, textSwatch: _s, ...rest } = el;
  return { ...rest, ...colourFields(choice, 'penTextColour', 'textColor') } as Element;
}
