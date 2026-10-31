// The item panel's two sizes (docs/specs/026-plan/plan-board.md "Maximised"), as the classes its Dialog takes: the
// usual one (60 rem wide, as tall as 46 rem allows, a sheet on a phone) and maximised (the window less 1 rem on
// every side). Both are explicit lengths, so the change between them eases.
const PANEL_SIZE_EASE =
  'transition-[width,height,max-width] duration-200 ease-out motion-reduce:transition-none';

const USUAL = 'h-[min(46rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-sm:h-[85dvh]';

// From sm up only, so a phone (where the button never shows) keeps its sheet whatever the preference says.
const MAXIMISED =
  'h-[min(46rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-sm:h-[85dvh] sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none';

export function panelSizeClass(maximised: boolean): string {
  return `${maximised ? MAXIMISED : USUAL} overflow-hidden ${PANEL_SIZE_EASE}`;
}
