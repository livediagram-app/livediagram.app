// The whiteboard data: the canvases the stock colours are tuned for, the Plain / Dots / Grid
// backgrounds and the pens' weights. Pure data and pure functions; the editor owns the dock and
// the device-local pens. Stock colours are stored by name and every renderer resolves them by
// name (./stock-colours, docs/specs/008-canvas/canvas-and-palette.md "Colours").
import { BORDER_STROKE_PX, type BorderStroke } from './border-style';
import { DARK_CANVAS_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR } from './canvas-colors';
import { PEN_INK } from './pen-colours';
import type { Appearance } from './themes';
import type { BackgroundPattern } from './index';

// The Default theme's canvas per appearance: the off-white in light, the editor's own dark canvas
// in dark. The stock colours are tuned against these; Ink on them stays >= 4.5:1.
export const WHITEBOARD_BOARD: Readonly<Record<Appearance, string>> = {
  light: DEFAULT_BACKGROUND_COLOR,
  dark: DARK_CANVAS_BACKGROUND_COLOR,
};
export const WHITEBOARD_INK: Readonly<Record<Appearance, string>> = PEN_INK;
type WhiteboardBackground = 'plain' | 'dots' | 'grid';

// The whiteboard's Background row: each choice is a canvas pattern.
export const WHITEBOARD_BACKGROUNDS: readonly {
  id: WhiteboardBackground;
  label: string;
  pattern: BackgroundPattern;
}[] = [
  { id: 'plain', label: 'Plain', pattern: 'blank' },
  { id: 'dots', label: 'Dots', pattern: 'grid' },
  { id: 'grid', label: 'Grid', pattern: 'graph' },
];

// A new whiteboard starts on Grid, written onto the tab when it is made (templateCanvasOverrides),
// so it never changes later.
export const WHITEBOARD_DEFAULT_PATTERN: BackgroundPattern = 'graph';

// A board stored without a pattern reads as Plain, as it always showed: the new-board default is
// never read back onto an existing board.
export const WHITEBOARD_UNSET_PATTERN: BackgroundPattern = 'blank';

export function whiteboardBackgroundOf(
  pattern: BackgroundPattern | undefined,
): WhiteboardBackground {
  return WHITEBOARD_BACKGROUNDS.find((b) => b.pattern === pattern)?.id ?? 'plain';
}

// The shapes a whiteboard once drew as marker outlines on display; ./legacy-whiteboard-tab writes
// that look onto them when a stored whiteboard tab is read.
export const WHITEBOARD_INKED_SHAPES: ReadonlySet<string> = new Set([
  'square',
  'circle',
  'triangle',
  'diamond',
]);

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
