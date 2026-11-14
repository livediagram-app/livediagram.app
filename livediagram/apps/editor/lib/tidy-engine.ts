// The tidiers, loaded on demand (docs/specs/008-canvas/blueprints/tidy-up.md "Performance and limits").
// The Tidy Up layouts, their router and the verdicts are only needed once someone opens Tidy Up or runs a
// tidier from the command palette, so they stay out of the editor's first load: the popover loads them as
// it opens (before it judges anything), and a palette command loads them at the press.

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
