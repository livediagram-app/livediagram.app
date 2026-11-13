// A module kept out of the editor's first load and loaded once on demand (the tidiers, docs/specs/008-canvas/
// blueprints/tidy-up.md "Performance and limits"). The editor keeps the `import()` itself, so its bundler still
// splits the chunk; this holds the one load, the loaded value and the run-now-or-once-loaded step.
export type LazyEngine<Engine> = {
  /** Load once; every later call resolves to the same engine. */
  load: () => Promise<Engine>;
  /** The engine if it has loaded, else null. */
  current: () => Engine | null;
  /** Run `go` with the engine: now if it has loaded, once it has otherwise. */
  withEngine: (go: (engine: Engine) => void) => void;
};

export function createLazyEngine<Engine>(importEngine: () => Promise<Engine>): LazyEngine<Engine> {
  let engine: Engine | null = null;
  let pending: Promise<Engine> | null = null;
  const load = () => (pending ??= importEngine().then((loaded) => (engine = loaded)));
  return {
    load,
    current: () => engine,
    withEngine: (go) => {
      if (engine) go(engine);
      else void load().then(go);
    },
  };
}
