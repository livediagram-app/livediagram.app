// The one Node API the MCP Workers use, AsyncLocalStorage (request-scope.ts, tool-scope.ts), which Workers
// provide under the `nodejs_compat` flag each product's wrangler.toml sets. Those modules reference this file, so
// any Worker compiling them sees it.
// Declared here rather than by adding @types/node, which would type every
// Node-only API as available in a Workers-runtime package and let one slip in.
declare module 'node:async_hooks' {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, callback: () => R): R;
    getStore(): T | undefined;
  }
}
