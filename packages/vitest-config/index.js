import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Shared Vitest defaults for every workspace. Workspaces extend this
 * via `defineProject` so coverage, reporters, and conventions stay
 * identical across the monorepo — the same reasoning behind the
 * shared eslint / prettier / tailwind configs. See specs/18-testing.md.
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
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Count first-party source only — never tests or type decls. NB we
      // deliberately do NOT exclude index.ts: in this repo a package's
      // index.ts is its implementation (e.g. @livediagram/diagram), not a
      // barrel of re-exports, so excluding it would hide all of its source.
      include: ['src/**', 'lib/**'],
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
