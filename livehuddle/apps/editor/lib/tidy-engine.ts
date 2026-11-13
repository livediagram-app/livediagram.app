// The tidiers, loaded on demand (docs/specs/008-canvas/blueprints/tidy-up.md "Performance and limits").
// Auto-align and its verdicts are only needed once someone runs it from the command palette, so they stay out
// of the editor's first load: the palette command loads them at the press (livehuddle has no Tidy Up button,
// docs/specs/008-canvas/layout-cleanup.md "No Tidy Up button").

import { createLazyEngine } from '@liveworkspace/workbench/lib/lazy-engine';
import type { cleanupElements } from './tab-cleanup';
import type { assessCleanup, verdictNotice } from './tidy-verdict';

export type TidyEngine = {
  cleanupElements: typeof cleanupElements;
  assessCleanup: typeof assessCleanup;
  verdictNotice: typeof verdictNotice;
};

const lazy = createLazyEngine<TidyEngine>(() =>
  Promise.all([import('./tab-cleanup'), import('./tidy-verdict')]).then(([cleanup, verdict]) => ({
    cleanupElements: cleanup.cleanupElements,
    assessCleanup: verdict.assessCleanup,
    verdictNotice: verdict.verdictNotice,
  })),
);

/** Load the tidiers once; every later call resolves to the same engine. */
export const loadTidyEngine = lazy.load;

/** The tidiers if they have loaded, else null. */
export const tidyEngine = lazy.current;

/** Run `go` with the tidiers: now if they have loaded, once they have otherwise. */
export const withTidyEngine = lazy.withEngine;
