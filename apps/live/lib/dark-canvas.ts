import { canvasSurface } from '@livediagram/diagram';

// Is the tab's canvas a DARK wall? The sticky paper-peel (spec/09) is a fixed
// slate ink tuned against light paper; on a dark backdrop that ink all but
// disappears and the note stops lifting off the board. The canvas surface
// flags its own darkness (a data attribute) so the peel — pure CSS, with no
// idea what a theme is — can deepen itself, and so can anything else that
// needs the same answer later.
//
// The same question `canvasSurface` answers for element ink (spec/07), as the
// boolean the CSS-facing callers want. One implementation, so the paper the
// peel deepens against can't disagree with the paper the ink is chosen for.
export function isDarkCanvas(backgroundColor: string | undefined | null): boolean {
  return canvasSurface(backgroundColor) === 'dark';
}
