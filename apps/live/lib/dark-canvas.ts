import { canvasSurface } from '@livediagram/diagram';

// Is the tab's canvas a DARK wall? The sticky paper-peel (docs/specs/008-canvas/canvas-and-palette.md) is a fixed
// slate ink tuned against light paper; on a dark backdrop that ink all but
// disappears and the note stops lifting off the board. The canvas surface
// flags its own darkness (a data attribute) so the peel — pure CSS, with no
// idea what a theme is — can deepen itself, and so can anything else that
// needs the same answer later.
//
// The same question `canvasSurface` answers for element ink (docs/specs/007-editor/live-app.md), as the
// boolean the CSS-facing callers want. One implementation, so the paper the
// peel deepens against can't disagree with the paper the ink is chosen for.
export function isDarkCanvas(backgroundColor: string | undefined | null): boolean {
  return canvasSurface(backgroundColor) === 'dark';
}
