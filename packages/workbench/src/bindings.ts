// The product facts workbench code reads at run time (packages/workbench/README.md "Bindings"). Each
// editor tells the workbench once, at startup: its lib/workbench-bindings.ts calls configureWorkbench
// from the root providers, before any component renders. Workbench code reads them through
// `workbench`, and only when it runs, never at module scope. Until then every binding has a safe
// default, and a development build warns once that one was read early.

export type WorkbenchBindings = {
  /** The localStorage key of the debug flag that turns trace lines on in production (`<product>:debug`). */
  debugKey: string;
  /** The sessionStorage key of the one reload guard's map (`<product>:stale-chunk-reloads`). */
  reloadGuardKey: string;
  /** The fingerprint scope of the product's stored format (`document-format`, `project-format`, …). */
  formatLogScope: string;
};

/** What workbench code reads until an editor configures it: safe no-ops and `workbench:` keys. */
export const WORKBENCH_DEFAULTS: Readonly<WorkbenchBindings> = Object.freeze({
  debugKey: 'workbench:debug',
  reloadGuardKey: 'workbench:stale-chunk-reloads',
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
  get debugKey(): string {
    return current().debugKey;
  },
  get reloadGuardKey(): string {
    return current().reloadGuardKey;
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
