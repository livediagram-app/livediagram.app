// The item panel's two sizes (docs/specs/026-plan/plan-board.md "Maximised"), as the classes its Dialog takes: the
// usual one (60 rem wide, as tall as 46 rem allows, a sheet on a phone) and maximised (the window less 1 rem on
// every side). The change between them animates as a React View Transition of this type (the Dialog's
// `resizeTransition`; its pace in globals.css): laid out once at the new size, the old picture morphed into the new
// by the compositor. Reduced motion starts none (startTypedTransition), so it changes at once.
export const PANEL_RESIZE_TRANSITION = 'item-panel-resize';

const USUAL = 'h-[min(46rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-sm:h-[85dvh]';

// From sm up only, so a phone (where the button never shows) keeps its sheet whatever the preference says.
const MAXIMISED =
  'h-[min(46rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-sm:h-[85dvh] sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none';

export function panelSizeClass(maximised: boolean): string {
  return `${maximised ? MAXIMISED : USUAL} overflow-hidden`;
}
