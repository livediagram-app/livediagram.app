# @livedocuments/vitest-config

Shared [Vitest](https://vitest.dev) configuration for the monorepo. One place
for test conventions and coverage settings so workspaces don't each reinvent
them. See [`docs/specs/003-system-architecture/testing.md`](../../docs/specs/003-system-architecture/testing.md).

## Usage

Add the dev dependencies to a workspace:

```jsonc
// package.json
"devDependencies": {
  "@livedocuments/vitest-config": "workspace:*",
  "@vitest/coverage-v8": "^2.1.8",
  "vitest": "^2.1.8"
}
```

Add a one-line `vitest.config.ts`:

```ts
import { defineProject } from '@livedocuments/vitest-config';

export default defineProject();
```

Override per workspace when needed (e.g. a DOM environment for React tests):

```ts
import { defineProject } from '@livedocuments/vitest-config';

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
- `@livedocuments/vitest-config/cpu-time`: CPU-time measures and budgets for speed tests.
- `@livedocuments/vitest-config/inline-script`: `runInlineScript(source, globals)`, which runs an
  inline `<script>`'s source as a browser would, against stub globals.
- `@livedocuments/vitest-config/sent-request`: `sentJson`, `sentText`, `sentForm` and `sentUrl`,
  which read what a stubbed `fetch` was sent.
