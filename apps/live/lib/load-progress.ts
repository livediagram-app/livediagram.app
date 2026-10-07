// The document load's progress and its watchdog (docs/specs/007-editor/load-recovery.md). The identity
// bootstrap reports each step it reaches; the watchdog ends a load that has not finished within
// LOAD_TIMEOUT_MS, the first time in a tab by reloading once ("self-healing"), after that by showing the
// load-error screen. The diagnostics report reads the step, so support can see where a load stopped.
// An external store (docs/specs/003-system-architecture/react-state-and-effects.md): the opening
// screen reads `healing` with useSyncExternalStore.

import { getOnline } from './online-status';
import { claimReloadIn } from './reload-guard';

export type LoadStep = 'identity' | 'participant' | 'document' | 'share' | 'first-tab' | 'done';

/** The steps as telemetry type parts, PascalCase. */
const STEP_TOKEN: Record<LoadStep, string> = {
  identity: 'Identity',
  participant: 'Participant',
  document: 'Document',
  share: 'Share',
  'first-tab': 'FirstTab',
  done: 'Done',
};

/** How long a load may run before the watchdog ends it. */
export const LOAD_TIMEOUT_MS = 30_000;
/** How long "Trying a fresh start" shows before the self-healing reload. */
export const AUTO_RELOAD_DELAY_MS = 1_500;
/** The sessionStorage map of page to its last self-healing reload. */
export const AUTO_RELOAD_KEY = 'livediagram:load-auto-reloads';
/** One self-healing reload per page within this window. */
export const AUTO_RELOAD_WINDOW_MS = 10 * 60_000;

export type LoadProgress = {
  step: LoadStep | null;
  startedAt: number | null;
  timedOut: boolean;
  healing: boolean;
};

const INITIAL: LoadProgress = { step: null, startedAt: null, timedOut: false, healing: false };
let progress: LoadProgress = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<LoadProgress>): void {
  progress = { ...progress, ...patch };
  listeners.forEach((fn) => fn());
}

export function getLoadProgress(): LoadProgress {
  return progress;
}

export function subscribeLoadProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLoadStep(step: LoadStep): void {
  if (progress.step !== step) set({ step });
}

export function loadStepToken(step: LoadStep | null): string {
  return step ? STEP_TOKEN[step] : 'Unknown';
}

/** Test seam. */
export function resetLoadProgressForTests(): void {
  progress = INITIAL;
}

export type WatchdogDeps = {
  now?: () => number;
  storage?: Storage | null;
  url?: string;
  reload?: () => void;
  warn?: (type: string) => void;
  online?: () => boolean;
};

/**
 * Start timing a load. Returns `finish`, which the load calls once it ends, however it ends: before
 * the deadline it disarms the watchdog; after it (a late load) it reports `DocumentLoad.Late` and
 * returns true so the caller can clear the load-error screen the watchdog put up.
 */
export function armLoadWatchdog(
  onTimedOut: () => void,
  deps: WatchdogDeps = {},
): { finish: () => boolean } {
  const now = deps.now ?? Date.now;
  const warn = deps.warn ?? (() => {});
  set({ step: 'identity', startedAt: now(), timedOut: false, healing: false });
  let fired = false;
  let finished = false;
  const timer = setTimeout(() => {
    if (finished) return;
    fired = true;
    const step = progress.step;
    set({ timedOut: true });
    console.warn(`[load] timed out after ${LOAD_TIMEOUT_MS} ms at step ${step ?? 'unknown'}`);
    warn(`DocumentLoad.TimedOut.${loadStepToken(step)}`);
    // Offline, a reload only swaps in the browser's own error page: go to the load-error screen,
    // which reloads by itself once the connection is back (docs/specs/007-editor/load-recovery.md "Offline").
    if ((deps.online ?? getOnline)() && claimAutoReload(deps)) {
      warn('DocumentLoad.AutoReload');
      set({ healing: true });
      setTimeout(deps.reload ?? (() => window.location.reload()), AUTO_RELOAD_DELAY_MS);
      return;
    }
    onTimedOut();
  }, LOAD_TIMEOUT_MS);
  return {
    finish: () => {
      if (finished) return false;
      finished = true;
      clearTimeout(timer);
      set({ step: 'done' });
      if (!fired) return false;
      console.warn('[load] finished after its watchdog');
      warn('DocumentLoad.Late');
      // A self-healing reload already scheduled would throw away the load that just landed.
      if (progress.healing) return false;
      return true;
    },
  };
}

function claimAutoReload(deps: WatchdogDeps): boolean {
  let storage: Storage | null;
  try {
    storage = deps.storage !== undefined ? deps.storage : window.sessionStorage;
  } catch {
    return false;
  }
  if (!storage) return false;
  const url = deps.url ?? window.location.href;
  return claimReloadIn(
    storage,
    AUTO_RELOAD_KEY,
    url,
    (deps.now ?? Date.now)(),
    AUTO_RELOAD_WINDOW_MS,
  );
}
