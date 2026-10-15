# Next.js

Status: specified

How the five Next.js apps (live, marketing, help, community, telemetry) are built: which Next.js they run, the one
shared configuration, and which Next.js features they use or decline, with the reason.

## Versions

- **Every app runs the latest stable `next`**, with `@next/mdx` on the same version.
  A new stable release is taken within a week, through `next upgrade` and its version guidance.
- **React is Next.js's own.** The App Router renders with the React that Next.js vendors
  (`next/dist/compiled/react`), so a React feature is available when the vendored build has it, whatever the
  workspace's `react` says. The workspace `react`, `react-dom` and their types track the same minor.
- **Shared packages peer on the React minor the apps run** (`packages/ui` and `packages/template-previews`: `^19.3.0`).

## One configuration

`@livediagram/next-config` holds every setting the apps share; an app's `next.config.ts` adds only what is its own.

| Setting                                    | Value                                                         | Why                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `output`                                   | `'export'` (the editor in production builds only)             | Every site is static ([Deployment](deployment.md))                                                    |
| `distDir`                                  | `NEXT_DISTDIR`, else `.next`                                  | Dev builds into `.next-dev` so a concurrent build never races it                                      |
| `images.unoptimized`                       | `true`                                                        | No image server on a static export                                                                    |
| `typescript`                               | `typescriptConfig()`                                          | E2E builds skip Next's own type check ([E2E smoke](../003-system-architecture/e2e-smoke.md))          |
| `reactCompiler`                            | `true`, Rust port (`experimental.turbopackRustReactCompiler`) | [React state and effects](../003-system-architecture/react-state-and-effects.md) "The React Compiler" |
| `experimental.turbopackGc`                 | `true`                                                        | Drops unreachable work from Turbopack's memory and disk cache                                         |
| `experimental.turbopackLazyDynamicImports` | `true`                                                        | Dev compiles a dynamic import when the browser asks for it                                            |
| `experimental.reactBrowserBailout`         | `true`                                                        | Next's client-rendering bailouts suspend through `browser()`                                          |
| `experimental.agentUpgrade`                | `'latest'`                                                    | Coding agents are pointed at new stable releases                                                      |

- **An app's own settings**: `basePath`, `assetPrefix`, `trailingSlash`, `pageExtensions`, MDX and `transpilePackages`.
- **The React Compiler needs Turbopack.** Under the webpack escape hatch (`dev:webpack`) it is left off.
- **An experimental flag stays only while it measures a gain.** Each row above records what it was adopted for;
  one that stops paying is removed.

## The Turbopack cache

- **Dev keeps its cache between starts.** Turbopack's file-system cache (on by default for dev and build) reuses the
  last session's compilation, and `turbopackGc` keeps it from growing stale or without bound.
- **Dev still builds into its own directory** (`.next-dev`), so a `next build` running beside it never overwrites it.
- **A cache that goes wrong is a bug to fix at its root**, not a reason to wipe the cache on every start.

## Features used and declined

| Feature                                                                     | Verdict  | Why                                                                            |
| --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `<ViewTransition>`, `addTransitionType`, `transitionTypes` on `next/link`   | Used     | [Motion](../004-interface-design/motion.md) "View Transitions"                 |
| Turbopack file-system cache, `turbopackGc`, lazy dynamic imports            | Used     | Above                                                                          |
| Bundle analyzer and its `next-bundle-optimizer` skill                       | Used     | [Web performance](web-performance.md) "Measuring"                              |
| Cache Components, `partialPrefetching`, `ensureStatic`, `cachedNavigations` | Declined | `output: 'export'` cannot enable them ("PPR cannot be enabled in export mode") |
| Server Actions, ISR, `proxy.ts`, rewrites, headers, root params, adapters   | Declined | No Next.js server: a static export on Cloudflare                               |
| `turbopackPluginRuntimeStrategy: 'workerThreads'`                           | Declined | Next falls back to child processes on Node 24.13.1 and later                   |
| `turbopackAdditionalRoots`                                                  | Declined | No linked package lives outside the repository                                 |
| Next.js Devtools MCP                                                        | Declined | Developer tooling, not part of the product                                     |
| The versioned-docs block Next writes into `AGENTS.md`                       | Declined | `AGENTS.md` is written by hand                                                 |

Features still being measured are added to this table with their verdict once measured.
