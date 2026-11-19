// How Tab Style names a tab's New Page Background (livedocuments and livedesign docs/specs/011-theme/
// canvas-and-theme-dialog.md "New Page Background"): the Fine-tune row's value. Shared by both Pages editors; each
// hands in how it names a fill of its own (a theme gradient, a preset). Pure.
import type { PageColourFill, PagePattern } from './index';

/** The row's value: "Like the page before" without one, else its fill and pattern ("Theme Mist, dots"). A fill the
 *  editor does not name reads as what kind it is; a fill of another kind (a picture) as "Picture". */
export function newPageBackgroundLabel(
  background: { fill?: { kind: string }; pattern?: PagePattern } | undefined,
  nameOf: (fill: PageColourFill) => string | undefined,
): string {
  if (!background) return 'Like the page before';
  const fill = fillLabel(background.fill, nameOf);
  return background.pattern ? `${fill}, ${background.pattern}` : fill;
}

function fillLabel(
  fill: { kind: string } | undefined,
  nameOf: (fill: PageColourFill) => string | undefined,
): string {
  if (!fill) return 'Paper';
  if (fill.kind !== 'solid' && fill.kind !== 'gradient') return 'Picture';
  const colour = fill as PageColourFill;
  const named = nameOf(colour);
  if (named) return named;
  if (colour.kind === 'solid') return 'Solid colour';
  return colour.motion ? 'Animated' : 'Custom gradient';
}

/** What Apply to Every Page says it did, by the pages it reached and the locked ones it kept. */
export function everyPageMessage(reached: number, kept: number): string {
  const pages = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`;
  const done = `Background applied to ${pages(reached)}.`;
  if (kept === 0) return done;
  const own = `${pages(kept)} locked kept ${kept === 1 ? 'its' : 'their'} own.`;
  return reached === 0 ? `Every page is locked: ${own}` : `${done} ${own}`;
}
