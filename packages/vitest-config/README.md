# @livediagram/vitest-config

Shared [Vitest](https://vitest.dev) configuration for the monorepo. One place
for test conventions and coverage settings so workspaces don't each reinvent
them. See [`docs/specs/003-system-architecture/testing.md`](../../docs/specs/003-system-architecture/testing.md).

## Usage

Add the dev dependencies to a workspace:

```jsonc
// package.json
"devDependencies": {
  "@livediagram/vitest-config": "workspace:*",
  "@vitest/coverage-v8": "^2.1.8",
  "vitest": "^2.1.8"
}
```

Add a one-line `vitest.config.ts`:

```ts
import { defineProject } from '@livediagram/vitest-config';

export default defineProject();
```

Override per workspace when needed (e.g. a DOM environment for React tests):

```ts
import { defineProject } from '@livediagram/vitest-config';

export default defineProject({ test: { environment: 'jsdom' } });
```

Add the scripts:

```jsonc
"scripts": {
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

## Exports

- `baseConfig` — the shared Vitest config object.
- `defineProject(overrides?)` — `baseConfig` merged with per-workspace overrides.
