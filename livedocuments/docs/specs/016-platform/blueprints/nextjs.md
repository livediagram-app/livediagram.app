# Next.js blueprint

Derived from [Next.js](../nextjs.md).

## Domain and naming

| Term            | Identifier                               | Meaning                                                          |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| Shared config   | `livedocumentsNextConfig(options)`       | The settings every app shares, from `@livedocuments/next-config` |
| App config      | each app's `next.config.ts`              | The shared config spread, plus the app's own settings            |
| Turbopack build | `isTurbopack(env)` (`env.TURBOPACK` set) | Next sets `TURBOPACK` before it loads the config                 |
| Static export   | `output: 'export'`                       | Always, except the editor's dev server (`exportInDev: false`)    |
| Dev directory   | `NEXT_DISTDIR=.next-dev`                 | Where `scripts/next-dev.mjs` points dev                          |
| Build year      | `NEXT_PUBLIC_BUILD_YEAR`                 | Inlined at build by `env`                                        |

## Behaviour and state

### `livedocumentsNextConfig`

```js
// packages/next-config/index.js
export function livedocumentsNextConfig({
  env = process.env,
  exportInDev = true,
  reactCompiler = false,
  now = new Date(),
} = {}) {
  const exporting = exportInDev || env.NODE_ENV === 'production';
  const turbopack = isTurbopack(env);
  const compiler = turbopack && reactCompiler;
  return {
    ...(exporting ? { output: 'export' } : {}),
    distDir: env.NEXT_DISTDIR ?? '.next',
    typescript: typescriptConfig(env),
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_BUILD_YEAR: String(now.getFullYear()) },
    agentRules: false,
    ...(compiler ? { reactCompiler: true } : {}),
    experimental: {
      agentUpgrade: 'latest',
      ...(compiler ? { turbopackRustReactCompiler: true } : {}),
      ...(turbopack ? { turbopackGc: true } : {}),
    },
  };
}
```

- It logs one line when it builds: `[next-config] turbopack=<bool> export=<bool> compiler=<bool>`, so a build log shows
  what ran.
- **App configs**: `marketing`, `help`, `telemetry` spread `livedocumentsNextConfig()`; `live` spreads
  `livedocumentsNextConfig({ exportInDev: false, reactCompiler: true })`. Each adds only `basePath`, `assetPrefix`, `trailingSlash`,
  `pageExtensions`, `transpilePackages` and (help) the MDX wrapper.
- `experimental.reactBrowserBailout` (Next's client-rendering bailouts through `browser()`) is on by default in 16.4.1, so
  it is not set.

### Dev

`scripts/next-dev.mjs` keeps `NEXT_DISTDIR=.next-dev` and stops deleting it on start. Turbopack's file-system cache
(default on) and `turbopackGc` keep it. A corrupted-cache case the wipe once hid is reproduced and fixed at its root.

### Versions

`next` and `@next/mdx` at the latest stable in every app; `react`, `react-dom`, `@types/react`, `@types/react-dom`
on the 19.3 line; `packages/ui` and `packages/template-previews` peer on `^19.3.0`.

## Interfaces and contracts

```js
export const SKIP_TYPECHECK_ENV: 'BUILD_SKIP_TYPECHECK';
export function typescriptConfig(env?: NodeJS.ProcessEnv): { ignoreBuildErrors: boolean };
export function isTurbopack(env?: NodeJS.ProcessEnv): boolean;
export function livedocumentsNextConfig(options?: {
  env?: NodeJS.ProcessEnv;
  exportInDev?: boolean;
  reactCompiler?: boolean;
  now?: Date;
}): import('next').NextConfig;
```

`index.d.ts` declares them; the package stays plain JavaScript (Next loads it before any transpiler).

## Errors and edge cases

| Case                                       | Handling                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| The webpack escape hatch (`dev:webpack`)   | No compiler and no Turbopack flags; the build log says so         |
| An app needs a setting the shared one sets | It overrides after the spread; the override is commented with why |
| A Next upgrade drops an experimental flag  | The type check fails on the unknown key; the row is removed       |

## Performance and limits

Measured before and after, in the PR: each app's build time, first-load JavaScript per page
([Web performance](../web-performance.md)), cold and warm dev start of the editor.

## Web Experience

First-load JavaScript per page no larger than before: the React Compiler stays out of the four static apps, where it
added 6 to 44 KiB.

## Observability

`[next-config] …` (above) and the existing `[next-config] BUILD_SKIP_TYPECHECK=1 …`.

## Testing

| Rule                                      | Test                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Export always, except the editor's dev    | `packages/next-config/index.test.js`                                         |
| Compiler only when asked, under Turbopack | `packages/next-config/index.test.js`                                         |
| Only the editor asks for the compiler     | `packages/next-config/apps-use-shared.test.js`                               |
| None of them under webpack                | `packages/next-config/index.test.js`                                         |
| Build year from `now`                     | `packages/next-config/index.test.js`                                         |
| `agentRules` off, `agentUpgrade` latest   | `packages/next-config/index.test.js`                                         |
| Every app uses the shared config          | `packages/next-config/apps-use-shared.test.js` (reads each `next.config.ts`) |
| Peer ranges match the React line          | `packages/next-config/apps-use-shared.test.js`                               |

## Constants and configuration

| Constant       | Value              | Provenance                      | Safe range           |
| -------------- | ------------------ | ------------------------------- | -------------------- |
| `agentUpgrade` | `latest`           | `next upgrade --agent` guidance | `security`, `latest` |
| `NEXT_DISTDIR` | `.next-dev` in dev | `scripts/next-dev.mjs`          | Any path but `.next` |

## Defaults ledger

D7 and D8 in [DEFAULTS.md](DEFAULTS.md).
