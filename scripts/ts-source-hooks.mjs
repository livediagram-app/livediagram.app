// Lets a repo script run workspace TypeScript sources under Node's type stripping: the packages
// import their own modules without extensions (`./stroke-points`), which Node's ESM resolver does
// not try, so an unresolved relative specifier is retried with `.ts`, then `/index.ts`.
//   node --import ./scripts/ts-source-hooks.mjs <script.ts>
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const relative = specifier.startsWith('./') || specifier.startsWith('../');
      if (!relative || error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // Try the next candidate; the original error is rethrown below.
        }
      }
      throw error;
    }
  },
});
