// The quick style panel in Draw mode (docs/specs/023-whiteboard/whiteboard.md "The quick style panel
// stays"). Its Stroke and Text colour rows offer the stock colours, as Marker colour does: Ink and
// the seven hued colours (each stored by name and drawn in its version for the canvas,
// docs/specs/007-editor/editor-modes.md "One look"), then the tab's custom colours. Background keeps
// the theme's fills, its first swatch "no fill", which is what Draw mode writes on its shapes.
import {
  isPenColourName,
  supportsBorderRadius,
  type Element,
  type PenColourName,
  type ShapeElement,
} from '@livediagram/document';
import {
  isQuickStyleTarget,
  supportsQuickSection,
  type BoardColourSection,
  type QuickCorners,
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

// The element's colour as a choice: its own hex or its stock name. An unpainted line wears its
// theme default, which is no stock colour; unpainted text is drawn in Ink.
const strokeChoice = (el: Coloured): PenColourChoice | null =>
  el.strokeColor?.toLowerCase() ?? el.penColour ?? null;
const textChoice = (el: Coloured): PenColourChoice =>
  el.textColor?.toLowerCase() ?? el.penTextColour ?? INK_CHOICE;

const shared = <T>(values: T[]): T | null =>
  values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null;

function section(values: (PenColourChoice | null)[], palette: PenPalette): BoardColourSection {
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
  // Corners (docs/specs/008-canvas/quick-style-panel.md "Corners"): whiteboards only; every
  // selected element that takes a corner preset.
  const cornered = targets.filter(takesCorners);
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
      ...(cornered.length > 0 ? { corners: { value: shared(cornered.map(cornersOf)) } } : {}),
    },
  };
}

/** The Corners row's choices, in order: None, Small, Medium, Large. */
export const QUICK_CORNERS: readonly QuickCorners[] = ['none', 'sm', 'md', 'lg'];

// An unlocked element that takes a corner preset (the free-corner rectangles).
const takesCorners = (el: Element): el is ShapeElement =>
  supportsBorderRadius(el) && el.locked !== true;

// The preset a target shows: its own among the four, else none (a kind default, a pill).
const cornersOf = (el: ShapeElement): QuickCorners | null =>
  (QUICK_CORNERS as readonly string[]).includes(el.borderRadius ?? '')
    ? (el.borderRadius as QuickCorners)
    : null;

/** The Corners row: a corner preset on every selected element that takes one, the rest kept. */
export function applyQuickCorners(el: Element, corners: QuickCorners): Element {
  return takesCorners(el) ? { ...el, borderRadius: corners } : el;
}

/** Clear styles on a whiteboard: the corners back to the kind's own default. */
export function clearQuickCorners(el: Element): Element {
  if (!takesCorners(el) || el.borderRadius === undefined) return el;
  const { borderRadius: _r, ...rest } = el;
  return rest;
}

function unfilled(targets: readonly Element[]): boolean {
  return targets.every(
    (el) => el.type !== 'shape' || el.fillColor === undefined || el.fillColor === 'transparent',
  );
}

// The colour fields a choice writes: a stock colour (Ink included) by name, or the exact hex.
function colourFields<N extends string, H extends string>(
  choice: PenColourChoice,
  named: N,
  hex: H,
): Partial<Record<N, PenColourName> & Record<H, string>> {
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
