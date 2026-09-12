import { isLightColor } from '@livediagram/diagram';

// Is the tab's canvas a DARK wall? The sticky paper-peel (spec/09) is a fixed
// slate ink tuned against light paper; on a dark backdrop that ink all but
// disappears and the note stops lifting off the board. The canvas surface
// flags its own darkness (a data attribute) so the peel — pure CSS, with no
// idea what a theme is — can deepen itself, and so can anything else that
// needs the same answer later.
//
// `isLightColor` only parses `#rrggbb`; anything else (unset, 'transparent',
// a CSS keyword) is the default white canvas, i.e. not dark.
export function isDarkCanvas(backgroundColor: string | undefined | null): boolean {
  if (!backgroundColor || !backgroundColor.startsWith('#')) return false;
  return !isLightColor(backgroundColor);
}
