// The document load's progress and its watchdog (docs/specs/007-editor/load-recovery.md): the editors' one copy in
// @liveworkspace/workbench/lib/load-progress, bound here to this editor's step, telemetry name and storage key.
import {
  createLoadProgress,
  type LoadProgressOf,
} from '@liveworkspace/workbench/lib/load-progress';

export {
  AUTO_RELOAD_DELAY_MS,
  AUTO_RELOAD_WINDOW_MS,
  LOAD_TIMEOUT_MS,
} from '@liveworkspace/workbench/lib/load-progress';

export type LoadStep = 'identity' | 'participant' | 'document' | 'share' | 'first-tab' | 'done';

export type LoadProgress = LoadProgressOf<LoadStep>;

/** The sessionStorage map of page to its last self-healing reload. */
export const AUTO_RELOAD_KEY = 'livehuddle:load-auto-reloads';

export const {
  getLoadProgress,
  subscribeLoadProgress,
  setLoadStep,
  loadStepToken,
  resetLoadProgressForTests,
  armLoadWatchdog,
} = createLoadProgress({
  ownStep: 'document',
  ownToken: 'Document',
  telemetry: 'DocumentLoad',
  autoReloadKey: AUTO_RELOAD_KEY,
});
