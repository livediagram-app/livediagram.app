// The tidiers, loaded on demand (docs/specs/008-canvas/blueprints/tidy-up.md "Performance and limits").
// The Tidy Up layouts, their router and the verdicts are only needed once someone opens Tidy Up or runs a
// tidier from the command palette, so they stay out of the editor's first load: the popover loads them as
// it opens (before it judges anything), and a palette command loads them at the press.

import type { cleanupElements } from './tab-cleanup';
import type { assessCleanup, verdictNotice } from './tidy-verdict';

export type TidyEngine = {
  cleanupElements: typeof cleanupElements;
  assessCleanup: typeof assessCleanup;
  verdictNotice: typeof verdictNotice;
};

let engine: TidyEngine | null = null;
let pending: Promise<TidyEngine> | null = null;

/** Load the tidiers once; every later call resolves to the same engine. */
export function loadTidyEngine(): Promise<TidyEngine> {
  pending ??= Promise.all([import('./tab-cleanup'), import('./tidy-verdict')]).then(
    ([cleanup, verdict]) =>
      (engine = {
        cleanupElements: cleanup.cleanupElements,
        assessCleanup: verdict.assessCleanup,
        verdictNotice: verdict.verdictNotice,
      }),
  );
  return pending;
}

/** The tidiers if they have loaded, else null. */
export const tidyEngine = (): TidyEngine | null => engine;

/** Run `go` with the tidiers: now if they have loaded, once they have otherwise. */
export function withTidyEngine(go: (engine: TidyEngine) => void): void {
  if (engine) go(engine);
  else void loadTidyEngine().then(go);
}
