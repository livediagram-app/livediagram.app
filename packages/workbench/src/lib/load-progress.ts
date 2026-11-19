// An editor's load progress and its watchdog (each product's docs/specs/007-editor/load-recovery.md), every editor's
// one copy: each lib/load-progress.ts binds it once with its own step, telemetry name and storage key
// (createLoadProgress) and keeps its old exports. The identity bootstrap reports each step it reaches; the watchdog
// ends a load that has not finished within LOAD_TIMEOUT_MS, the first time in a tab by reloading once
// ("self-healing"), after that by showing the load-error screen. The diagnostics report reads the step, so support can
// see where a load stopped. An external store (003-system-architecture/react-state-and-effects.md): the opening
// screen reads `healing` with useSyncExternalStore.

import { getOnline } from './online-status';
import { claimReloadIn } from './reload-guard';
import { createListeners } from './listeners';

/** The steps every editor's load shares; each adds the step that loads its own item. */
export type SharedLoadStep = 'identity' | 'participant' | 'share' | 'first-tab' | 'done';

/** How long a load may run before the watchdog ends it. */
export const LOAD_TIMEOUT_MS = 30_000;
/** How long "Trying a fresh start" shows before the self-healing reload. */
export const AUTO_RELOAD_DELAY_MS = 1_500;
/** One self-healing reload per page within this window. */
export const AUTO_RELOAD_WINDOW_MS = 10 * 60_000;

export type LoadProgressOf<Step> = {
  step: Step | null;
  startedAt: number | null;
  timedOut: boolean;
  healing: boolean;
};

export type LoadWatchdogDeps = {
  now?: () => number;
  storage?: Storage | null;
  url?: string;
  reload?: () => void;
  warn?: (type: string) => void;
  online?: () => boolean;
};

/** An editor's side: the step that loads its item, its PascalCase token, the telemetry name its warnings go under
 *  (`DocumentLoad`) and the sessionStorage key of its self-healing reloads. */
export type LoadProgressProduct<OwnStep extends string> = {
  ownStep: OwnStep;
  ownToken: string;
  telemetry: string;
  autoReloadKey: string;
};

export function createLoadProgress<OwnStep extends string>(product: LoadProgressProduct<OwnStep>) {
  type Step = SharedLoadStep | OwnStep;
  // The steps as telemetry type parts, PascalCase.
  const stepToken: Record<string, string> = {
    identity: 'Identity',
    participant: 'Participant',
    [product.ownStep]: product.ownToken,
    share: 'Share',
    'first-tab': 'FirstTab',
    done: 'Done',
  };
  const INITIAL: LoadProgressOf<Step> = {
    step: null,
    startedAt: null,
    timedOut: false,
    healing: false,
  };
  let progress: LoadProgressOf<Step> = INITIAL;
  const listeners = createListeners();

  function set(patch: Partial<LoadProgressOf<Step>>): void {
    progress = { ...progress, ...patch };
    listeners.notify();
  }

  function getLoadProgress(): LoadProgressOf<Step> {
    return progress;
  }

  function setLoadStep(step: Step): void {
    if (progress.step !== step) set({ step });
  }

  function loadStepToken(step: Step | null): string {
    return step ? stepToken[step]! : 'Unknown';
  }

  /** Test seam. */
  function resetLoadProgressForTests(): void {
    progress = INITIAL;
  }

  function claimAutoReload(deps: LoadWatchdogDeps): boolean {
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
      product.autoReloadKey,
      url,
      (deps.now ?? Date.now)(),
      AUTO_RELOAD_WINDOW_MS,
    );
  }

  /**
   * Start timing a load. Returns `finish`, which the load calls once it ends, however it ends: before
   * the deadline it disarms the watchdog; after it (a late load) it reports `<telemetry>.Late` and
   * returns true so the caller can clear the load-error screen the watchdog put up.
   */
  function armLoadWatchdog(
    onTimedOut: () => void,
    deps: LoadWatchdogDeps = {},
  ): { finish: () => boolean } {
    const now = deps.now ?? Date.now;
    const warn = deps.warn ?? (() => {});
    set({ step: 'identity', startedAt: now(), timedOut: false, healing: false });
    let fired = false;
    let finished = false;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    // `finish` clears this timer, so it only ever fires for a load still running.
    const timer = setTimeout(() => {
      fired = true;
      const step = progress.step;
      set({ timedOut: true });
      console.warn(`[load] timed out after ${LOAD_TIMEOUT_MS} ms at step ${step ?? 'unknown'}`);
      warn(`${product.telemetry}.TimedOut.${loadStepToken(step)}`);
      // Offline, a reload only swaps in the browser's own error page: go to the load-error screen,
      // which reloads by itself once the connection is back (load-recovery.md "Offline").
      if ((deps.online ?? getOnline)() && claimAutoReload(deps)) {
        warn(`${product.telemetry}.AutoReload`);
        set({ healing: true });
        reloadTimer = setTimeout(
          deps.reload ?? (() => window.location.reload()),
          AUTO_RELOAD_DELAY_MS,
        );
        return;
      }
      onTimedOut();
    }, LOAD_TIMEOUT_MS);
    return {
      finish: () => {
        if (finished) return false;
        finished = true;
        clearTimeout(timer);
        // The step stays where the load reached: a failed load's diagnostics name it (the success path sets 'done').
        if (!fired) return false;
        console.warn('[load] finished after its watchdog');
        warn(`${product.telemetry}.Late`);
        // A late load still wins: the self-healing reload not yet run would throw away the load that just landed.
        if (reloadTimer !== null) {
          clearTimeout(reloadTimer);
          reloadTimer = null;
          set({ healing: false });
        }
        return true;
      },
    };
  }

  return {
    getLoadProgress,
    subscribeLoadProgress: listeners.subscribe,
    setLoadStep,
    loadStepToken,
    resetLoadProgressForTests,
    armLoadWatchdog,
  };
}
