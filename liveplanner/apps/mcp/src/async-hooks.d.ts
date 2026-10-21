// The one Node API this worker uses, AsyncLocalStorage (tool-scope.ts), which
// Workers provide under the `nodejs_compat` flag already set in wrangler.toml.
// Declared here rather than by adding @types/node, which would type every
// Node-only API as available in a Workers-runtime package and let one slip in.
declare module 'node:async_hooks' {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, callback: () => R): R;
    getStore(): T | undefined;
  }
}
