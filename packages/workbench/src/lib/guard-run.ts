// A run's guarded functions: the editors' identity bootstrap (useIdentityBootstrap) hands each run its setters
// through this, so a run superseded by a later one (auth settling twice) writes nothing.

const isCallable = (v: unknown): v is (...args: unknown[]) => unknown => typeof v === 'function';

/** Every function of `fns`, doing nothing once `live` says its run was superseded. */
export function guardRun<T extends object>(fns: T, live: () => boolean): T {
  return new Proxy(fns, {
    get: (target, name) => {
      const fn: unknown = Reflect.get(target, name);
      return isCallable(fn) ? (...args: unknown[]) => (live() ? fn(...args) : undefined) : fn;
    },
  });
}
