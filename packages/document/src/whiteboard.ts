// The whiteboard tab kind (docs/specs/023-whiteboard/whiteboard.md): its look and the display
// projection that gives unpainted elements the board's ink. Pure data and pure
// functions; the editor owns the dock and the device-local pens.
import { BORDER_STROKE_PX, type BorderStroke } from './border-style';
import type { Appearance } from './themes';
import type { BackgroundPattern, Element } from './index';

export function isWhiteboardTab(tab: { kind?: string } | undefined): boolean {
  return tab?.kind === 'whiteboard';
}

// The whiteboard variant of the Default theme: a whiteboard in light, a
// chalkboard in dark. Tuned with the operator; ink on board stays >= 4.5:1.
export const WHITEBOARD_BOARD: Readonly<Record<Appearance, string>> = {
  light: '#fbfaf7',
  dark: '#1f2724',
};
export const WHITEBOARD_INK: Readonly<Record<Appearance, string>> = {
  light: '#1c1917',
  dark: '#ece8dc',
};
// The dots and grid lines: a faint mix of ink over board.
export const WHITEBOARD_PATTERN: Readonly<Record<Appearance, string>> = {
  light: '#d6d3cb',
  dark: '#3a4540',
};

export type WhiteboardBackground = 'plain' | 'dots' | 'grid';

// Stored as the tab's ordinary `backgroundPattern`, so every reader renders it.
export const WHITEBOARD_BACKGROUNDS: readonly {
  id: WhiteboardBackground;
  label: string;
  pattern: BackgroundPattern;
}[] = [
  { id: 'plain', label: 'Plain', pattern: 'blank' },
  { id: 'dots', label: 'Dots', pattern: 'grid' },
  { id: 'grid', label: 'Grid', pattern: 'graph' },
];

export const WHITEBOARD_DEFAULT_PATTERN: BackgroundPattern = 'blank';

export function whiteboardBackgroundOf(
  pattern: BackgroundPattern | undefined,
): WhiteboardBackground {
  return WHITEBOARD_BACKGROUNDS.find((b) => b.pattern === pattern)?.id ?? 'plain';
}

// Shapes a whiteboard draws as marker outlines. Everything else keeps its own look.
const INKED_SHAPES = new Set(['square', 'circle', 'triangle', 'diamond']);

// Display-only: the colours an unpainted element shows on a whiteboard. Nothing
// is written back, so the same element reads in the viewer's own ink and in the
// ordinary defaults anywhere else. Returns `el` itself when nothing changes.
export function inkWhiteboardElement<T extends Element>(el: T, ink: string): T {
  switch (el.type) {
    case 'freehand':
      if (el.pen === 'highlighter') return el;
      if (el.strokeColor !== undefined && el.fillColor !== undefined) return el;
      return {
        ...el,
        strokeColor: el.strokeColor ?? ink,
        fillColor: el.fillColor ?? 'transparent',
      };
    case 'text':
      return el.textColor !== undefined ? el : { ...el, textColor: ink };
    case 'shape':
      if (!INKED_SHAPES.has(el.shape)) return el;
      if (el.strokeColor !== undefined && el.fillColor !== undefined && el.textColor !== undefined)
        return el;
      return {
        ...el,
        strokeColor: el.strokeColor ?? ink,
        fillColor: el.fillColor ?? 'transparent',
        textColor: el.textColor ?? ink,
      };
    case 'arrow':
      return el.strokeColor !== undefined ? el : { ...el, strokeColor: ink };
    default:
      return el;
  }
}

const BORDER_STROKES = Object.entries(BORDER_STROKE_PX) as [BorderStroke, number][];

// The border preset nearest a pen width, ties to the thicker: a recognised
// shape keeps roughly the weight of the stroke it replaced.
export function nearestBorderStroke(px: number): BorderStroke {
  let best: BorderStroke = 'medium';
  let bestDist = Infinity;
  for (const [id, width] of BORDER_STROKES) {
    if (id === 'none') continue;
    const d = Math.abs(width - px);
    if (d < bestDist || (d === bestDist && width > BORDER_STROKE_PX[best])) {
      best = id;
      bestDist = d;
    }
  }
  return best;
}
