# @liveworkspace/vitest-config

Shared [Vitest](https://vitest.dev) configuration for the monorepo. One place
for test conventions and coverage settings so workspaces don't each reinvent
them. See each product's `docs/specs/003-system-architecture/testing.md`, e.g.
[livediagram's](../../livediagram/docs/specs/003-system-architecture/testing.md).

## Usage

Add the dev dependencies to a workspace:

```jsonc
// package.json
"devDependencies": {
  "@liveworkspace/vitest-config": "workspace:*",
  "@vitest/coverage-v8": "^5.0.3",
  "vitest": "^5.0.3"
}
```

Add a one-line `vitest.config.ts`:

```ts
import { defineProject } from '@liveworkspace/vitest-config';

export default defineProject();
```

Override per workspace when needed (e.g. a DOM environment for React tests):

```ts
import { defineProject } from '@liveworkspace/vitest-config';

export default defineProject({ test: { environment: 'jsdom' } });
```

Add the scripts:

```jsonc
"scripts": {
  "test": "vitest run",
  "test:coverage": "vitest run --coverage && vitest-budgets"
}
```

`vitest-budgets` reruns, without coverage, the test files that import
`@liveworkspace/vitest-config/cpu-time`: under coverage `cpuBudgetMs` (and a growth check's `cpuRatioCeiling` or `cpuGrowthLimitMs`) is
unbounded, so a speed budget is only judged there ([docs/ci.md](../../docs/ci.md),
"Speed budgets"). Extra arguments pass through to `vitest run` (a CI editor
shard adds `--shard=n/3`).

## Exports

- `baseConfig`: the shared Vitest config object.
- `defineProject(overrides?)`: `baseConfig` merged with per-workspace overrides.
- `@liveworkspace/vitest-config/react-cleanup`: a setup file that unmounts every tree React Testing
  Library rendered after each test.
- `@liveworkspace/vitest-config/cpu-time`: CPU-time measures, budgets and growth-ratio ceilings for speed tests.
- `vitest-budgets` (bin): the speed-budget run above.
- `@liveworkspace/vitest-config/inline-script`: `runInlineScript(source, globals)`, which runs an
  inline `<script>`'s source as a browser would, against stub globals.
- `@liveworkspace/vitest-config/sent-request`: `sentJson`, `sentText`, `sentForm` and `sentUrl`,
  which read what a stubbed `fetch` was sent.
