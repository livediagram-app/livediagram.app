// The product facts workbench code reads at run time (packages/workbench/README.md "Bindings"). Each
// editor tells the workbench once, at startup: its lib/workbench-bindings.ts calls configureWorkbench
// from the root providers, before any component renders. Workbench code reads them through
// `workbench`, and only when it runs, never at module scope. Until then every binding has a safe
// default, and a development build warns once that one was read early.

/**
 * The telemetry events workbench code sends: a subset of every product's vocabulary, so each
 * product's own wider `track` binds as it is, and typecheck fails if a vocabulary drops one.
 */
export type WorkbenchTelemetryCategory = 'Error';
export type WorkbenchTelemetryAction = 'Client';
export type WorkbenchTrack = (
  category: WorkbenchTelemetryCategory,
  action: WorkbenchTelemetryAction,
  type?: string,
) => void;

/** The person's preferences, as far as workbench code reads them: a subset of every product's. */
export type WorkbenchPreferences = {
  reduceMotion?: boolean;
};

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
  /** The fingerprint scope of the product's stored format (`document-format`, `project-format`, …). */
  formatLogScope: string;
};

/** What workbench code reads until an editor configures it: safe no-ops and `workbench:` keys. */
export const WORKBENCH_DEFAULTS: Readonly<WorkbenchBindings> = Object.freeze({
  track: () => {},
  debugKey: 'workbench:debug',
  reloadGuardKey: 'workbench:stale-chunk-reloads',
  appRecoveryFlag: '__workbenchChunkRecovery',
  runningStaleBuild: () => false,
  readPreferences: () => ({}),
  formatLogScope: 'document-format',
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
};

/** Back to the unconfigured defaults, for tests. */
export function resetWorkbenchForTests(): void {
  bound = WORKBENCH_DEFAULTS;
  configured = false;
  warned = false;
}
