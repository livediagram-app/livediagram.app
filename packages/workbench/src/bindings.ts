// The product facts workbench code reads at run time (packages/workbench/README.md "Bindings"). Each
// editor tells the workbench once, at startup: its lib/workbench-bindings.ts calls configureWorkbench
// from the root providers, before any component renders. Workbench code reads them through
// `workbench`, and only when it runs, never at module scope. Until then every binding has a safe
// default, and a development build warns once that one was read early.

import { ZOOM_MAX } from './lib/zoom-range';

/**
 * The telemetry events workbench code sends: a subset of every product's vocabulary, so each
 * product's own wider `track` binds as it is, and typecheck fails if a vocabulary drops one.
 */
export type WorkbenchTelemetryCategory = 'Canvas' | 'Error';
export type WorkbenchTelemetryAction = 'Client' | 'Zoomed';
export type WorkbenchTrack = (
  category: WorkbenchTelemetryCategory,
  action: WorkbenchTelemetryAction,
  type?: string,
) => void;

/** The person's preferences, as far as workbench code reads them: a subset of every product's. */
export type WorkbenchPreferences = {
  reduceMotion?: boolean;
};

/** The product's api transport (its lib/api/core.ts), as far as workbench code calls it. */
export type WorkbenchApi = {
  /** Every api request: the product's apiFetch, with its grants, confinement and release signals. */
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** A request's headers when made as `ownerId`: its Bearer, and the JSON content type for a body. */
  headers: (ownerId: string, opts?: { body?: boolean }) => Promise<HeadersInit>;
  /** A 2xx's JSON, else the ApiError (lib/api/api-error.ts), reported on the way out. */
  expectOk: <T>(res: Response, action: string) => Promise<T>;
  /** Nothing on a 2xx, else the ApiError, reported on the way out. */
  expectOkVoid: (res: Response, action: string) => Promise<void>;
  /** The Bearer this page sends outside the api's own headers: the account's, else the guest's. */
  currentBearer: () => Promise<string | null>;
};

const unbound = (): Promise<never> =>
  Promise.reject(new Error('[workbench] the api binding is not configured'));

export type WorkbenchBindings = {
  /** The product's telemetry `track` (docs/specs/017-telemetry/telemetry.md), for the events above. */
  track: WorkbenchTrack;
  /** The localStorage key of the debug flag that turns trace lines on in production (`<product>:debug`). */
  debugKey: string;
  /** The sessionStorage key of the one reload guard's map (`<product>:stale-chunk-reloads`). */
  reloadGuardKey: string;
  /** The window flag set while the app's chunk recovery is installed (`__<product>ChunkRecovery`). */
  appRecoveryFlag: string;
  /** Whether this page runs an older build than the one now live (the product's server release). */
  runningStaleBuild: () => boolean;
  /** The person's cached preferences (docs/specs/007-editor/user-preferences.md). */
  readPreferences: () => WorkbenchPreferences;
  /** The product's api transport. */
  api: WorkbenchApi;
  /** The canvas's zoom ceiling now (livedesign raises it while a photo page is in focus). */
  zoomMax: () => number;
  /** The fingerprint scope of the product's stored format (`document-format`, `project-format`, …). */
  formatLogScope: string;
  /** The window event that asks the mounted host to open Settings on a category (`<product>:open-settings`). */
  openSettingsEvent: string;
  /** The window event a floating panel sends as it arrives or leaves on its own (`<product>:panel-presence`). */
  panelPresenceEvent: string;
  /** The window event the panel layout sends as it is written (`<product>:panel-layout-changed`). */
  panelLayoutEvent: string;
  /** The sessionStorage key of the search handed to the next start panel (`<product>:v2:start-query`). */
  startQueryKey: string;
  /** The localStorage prefix of the move prompt's Not Now, per account (`<product>:v2:local-move-dismissed:`). */
  localMoveDismissedPrefix: string;
  /** The localStorage list of closed empty-tab cards (`<product>:v2:empty-card-dismissed`), where the editor has them. */
  emptyCardDismissedKey?: string;
  /** The localStorage key of the Format panel's configuration (`<product>:v2:format-config`), where it has one. */
  formatConfigKey?: string;
  /** The localStorage key of the Spotlight panel's configuration (`<product>:v2:spotlight-config`), where it has one. */
  spotlightConfigKey?: string;
};

/** What workbench code reads until an editor configures it: safe no-ops and `workbench:` keys. */
export const WORKBENCH_DEFAULTS: Readonly<Required<WorkbenchBindings>> = Object.freeze({
  track: () => {},
  debugKey: 'workbench:debug',
  reloadGuardKey: 'workbench:stale-chunk-reloads',
  appRecoveryFlag: '__workbenchChunkRecovery',
  runningStaleBuild: () => false,
  readPreferences: () => ({}),
  // Unconfigured, no request goes out: an anonymous call would act as nobody, so each refuses.
  api: Object.freeze({
    fetch: unbound,
    headers: unbound,
    expectOk: unbound,
    expectOkVoid: unbound,
    currentBearer: () => Promise.resolve(null),
  }),
  zoomMax: () => ZOOM_MAX,
  formatLogScope: 'document-format',
  openSettingsEvent: 'workbench:open-settings',
  panelPresenceEvent: 'workbench:panel-presence',
  panelLayoutEvent: 'workbench:panel-layout-changed',
  startQueryKey: 'workbench:v2:start-query',
  localMoveDismissedPrefix: 'workbench:v2:local-move-dismissed:',
  emptyCardDismissedKey: 'workbench:v2:empty-card-dismissed',
  formatConfigKey: 'workbench:v2:format-config',
  spotlightConfigKey: 'workbench:v2:spotlight-config',
});

let bound: Readonly<WorkbenchBindings> = WORKBENCH_DEFAULTS;
let configured = false;
let warned = false;

/** Hands the workbench this editor's facts. Called once at startup; a later call replaces them. */
export function configureWorkbench(bindings: WorkbenchBindings): void {
  bound = bindings;
  configured = true;
}

function current(): Readonly<WorkbenchBindings> {
  if (!configured && !warned && process.env.NODE_ENV === 'development') {
    warned = true;
    console.warn(
      '[workbench] a binding was read before configureWorkbench; using the defaults (packages/workbench/README.md "Bindings")',
    );
  }
  return bound;
}

/** The bound facts, each read when used. */
export const workbench = {
  track: ((category, action, type) =>
    current().track(category, action, type)) satisfies WorkbenchTrack,
  runningStaleBuild: (): boolean => current().runningStaleBuild(),
  readPreferences: (): WorkbenchPreferences => current().readPreferences(),
  get api(): WorkbenchApi {
    return current().api;
  },
  zoomMax: (): number => current().zoomMax(),
  get debugKey(): string {
    return current().debugKey;
  },
  get reloadGuardKey(): string {
    return current().reloadGuardKey;
  },
  get appRecoveryFlag(): string {
    return current().appRecoveryFlag;
  },
  get formatLogScope(): string {
    return current().formatLogScope;
  },
  get openSettingsEvent(): string {
    return current().openSettingsEvent;
  },
  get panelPresenceEvent(): string {
    return current().panelPresenceEvent;
  },
  get panelLayoutEvent(): string {
    return current().panelLayoutEvent;
  },
  get startQueryKey(): string {
    return current().startQueryKey;
  },
  get localMoveDismissedPrefix(): string {
    return current().localMoveDismissedPrefix;
  },
  // Bound only by an editor that runs the module, so an unbound one keeps its `workbench:` default.
  get emptyCardDismissedKey(): string {
    return current().emptyCardDismissedKey ?? WORKBENCH_DEFAULTS.emptyCardDismissedKey;
  },
  get formatConfigKey(): string {
    return current().formatConfigKey ?? WORKBENCH_DEFAULTS.formatConfigKey;
  },
  get spotlightConfigKey(): string {
    return current().spotlightConfigKey ?? WORKBENCH_DEFAULTS.spotlightConfigKey;
  },
};

/** Back to the unconfigured defaults, for tests. */
export function resetWorkbenchForTests(): void {
  bound = WORKBENCH_DEFAULTS;
  configured = false;
  warned = false;
}
