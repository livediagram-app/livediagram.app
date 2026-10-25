// Lets the migrate command run the products' TypeScript sources under Node's type stripping
// (livediagram/scripts/ts-source-hooks.mjs, which this extends): the packages import their own modules without
// extensions (`./stroke-points`) and folders by their index (`./sheet-templates`), which Node's ESM resolver does
// not try, so such a relative specifier is retried with `.ts`, then `/index.ts`.
//   node --import ./ts-hooks.mjs src/cli.ts
import { registerHooks } from 'node:module';

const RETRIED = new Set(['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT']);

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const relative = specifier.startsWith('./') || specifier.startsWith('../');
      if (!relative || !RETRIED.has(error?.code)) throw error;
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
