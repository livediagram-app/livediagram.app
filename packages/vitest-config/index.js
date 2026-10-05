import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';

// The monorepo root: this file sits at packages/vitest-config/index.js.
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Shared Vitest defaults for every workspace. Workspaces extend this
 * via `defineProject` so coverage, reporters, and conventions stay
 * identical across the monorepo — the same reasoning behind the
 * shared eslint / prettier / tailwind configs. See docs/specs/003-system-architecture/testing.md.
 */
export const baseConfig = defineConfig({
  test: {
    // Explicit imports over magic globals: `import { it } from 'vitest'`.
    // Keeps test files honest and lint-clean with no extra ambient types.
    globals: false,
    // Pure logic only, so far. Workspaces that test the DOM (React
    // components, hooks) override this to 'jsdom'.
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      // lcov names each file from the repo root (`apps/live/lib/x.ts`, not `lib/x.ts`), so Codecov
      // places every workspace's report without guessing between their many `src/index.ts`.
      reporter: ['text', 'html', ['lcov', { projectRoot: REPO_ROOT }]],
      reportsDirectory: './coverage',
      // Count first-party source only — never tests or type decls. NB we
      // deliberately do NOT exclude index.ts: in this repo a package's
      // index.ts is its implementation (e.g. @livediagram/document), not a
      // barrel of re-exports, so excluding it would hide all of its source.
      // Code files only: these folders also hold fixtures (`.drawio`, goldens, model weights) that are not
      // source, and parsing them as code fails. Workspace includes are added to this list, not replacing it.
      include: ['{src,lib}/**/*.{ts,tsx}'],
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts'],
    },
  },
});

/**
 * Merge the shared base with per-workspace overrides.
 *
 * @param {import('vitest/config').UserConfig} [overrides]
 * @returns merged Vitest config
 *
 * Usage in a workspace `vitest.config.ts`:
 *   import { defineProject } from '@livediagram/vitest-config';
 *   export default defineProject();                              // defaults
 *   export default defineProject({ test: { environment: 'jsdom' } });
 */
export function defineProject(overrides = {}) {
  return mergeConfig(baseConfig, defineConfig(overrides));
}
