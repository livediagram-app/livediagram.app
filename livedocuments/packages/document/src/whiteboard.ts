// The whiteboard data: the canvases the stock colours are tuned for. Pure data and pure functions; the editor owns the dock and
// the device-local pens. Stock colours are stored by name and every renderer resolves them by
// name (./stock-colours, docs/specs/008-canvas/canvas-and-palette.md "Colours").
import { DARK_CANVAS_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR } from './canvas-colors';
import { PEN_INK } from './pen-colours';
import type { Appearance } from './themes';

// The Default theme's canvas per appearance: the off-white in light, the editor's own dark canvas
// in dark. The stock colours are tuned against these; Ink on them stays >= 4.5:1.
export const WHITEBOARD_BOARD: Readonly<Record<Appearance, string>> = {
  light: DEFAULT_BACKGROUND_COLOR,
  dark: DARK_CANVAS_BACKGROUND_COLOR,
};
export const WHITEBOARD_INK: Readonly<Record<Appearance, string>> = PEN_INK;
