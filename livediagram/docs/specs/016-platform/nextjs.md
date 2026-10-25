# Next.js

Status: shipped

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

`@liveworkspace/next-config` holds every setting the apps share; an app's `next.config.ts` adds only what is its own.

| Setting                      | Value                                                                                                     | Why                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `output`                     | `'export'` (the editor in production builds only)                                                         | Every site is static ([Deployment](deployment.md))                                                    |
| `distDir`                    | `NEXT_DISTDIR`, else `.next`                                                                              | Dev builds into `.next-dev` so a concurrent build never races it                                      |
| `images.unoptimized`         | `true`                                                                                                    | No image server on a static export                                                                    |
| `typescript`                 | `typescriptConfig()`                                                                                      | E2E builds skip Next's own type check ([E2E smoke](../003-system-architecture/e2e-smoke.md))          |
| `reactCompiler`              | the editor alone (`reactCompiler: true` passed in), Rust port (`experimental.turbopackRustReactCompiler`) | [React state and effects](../003-system-architecture/react-state-and-effects.md) "The React Compiler" |
| `experimental.turbopackGc`   | `true`                                                                                                    | Drops unreachable work from Turbopack's memory and disk cache                                         |
| `experimental.agentUpgrade`  | `'latest'`                                                                                                | Coding agents are pointed at new stable releases                                                      |
| `agentRules`                 | `false`                                                                                                   | `next dev` writes no `AGENTS.md`: the repository's agent files are written by hand                    |
| `env.NEXT_PUBLIC_BUILD_YEAR` | the build's year                                                                                          | The footer's year, the same in the prerender and the browser                                          |

- **An app's own settings**: `basePath`, `assetPrefix`, `trailingSlash`, `pageExtensions`, MDX and `transpilePackages`.
- **The React Compiler runs in the editor alone.** The four static sites' pages rarely re-render, and on them it added
  6 to 12 KiB of first-load JavaScript per page (44 KiB, +14%, on the marketing home) for little gain.
- **The React Compiler needs Turbopack.** Under the webpack escape hatch (`dev:webpack`) it is left off.
- **An experimental flag stays only while it measures a gain.** Each row above records what it was adopted for;
  one that stops paying is removed.
- **No `turbopackLazyDynamicImports`.** It was on to compile a dynamic import only when the browser asked for it, but
  under Next 16.4.2 dev it left some dynamic imports without their chunk: in livedocuments, creating a document asked
  for a lazy-compilation chunk the server never wrote (`ChunkLoadError`, 2026-10-23), and a clean `.next-dev` did not
  cure it. It stays off until a Next release fixes that.

## The Turbopack cache

- **Dev keeps its cache between starts.** Turbopack's file-system cache (on by default for dev and build) reuses the
  last session's compilation, and `turbopackGc` keeps it from growing stale or without bound.
- **Dev still builds into its own directory** (`.next-dev`), so a `next build` running beside it never overwrites it.
- **A cache that goes wrong is a bug to fix at its root**, not a reason to wipe the cache on every start.

## Features used and declined

| Feature                                                                                 | Verdict  | Why                                                                                                                                               |
| --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<ViewTransition>`, `addTransitionType`, `transitionTypes` on `next/link`               | Used     | [Motion](../004-interface-design/motion.md) "View Transitions"                                                                                    |
| `reactBrowserBailout` (client-rendering bailouts through `browser()`)                   | Used     | On by default since 16.4                                                                                                                          |
| Turbopack file-system cache, `turbopackGc`, lazy dynamic imports                        | Used     | Above                                                                                                                                             |
| Bundle analyzer (`next analyze`, `next analyze export` for JSON)                        | Used     | [Web performance](web-performance.md) "Measuring"                                                                                                 |
| Cache Components, `partialPrefetching`, `ensureStatic`, `cachedNavigations`             | Declined | `output: 'export'` cannot enable them ("PPR cannot be enabled in export mode")                                                                    |
| Server Actions, ISR, `proxy.ts`, rewrites, headers, root params, adapters               | Declined | No Next.js server: a static export on Cloudflare                                                                                                  |
| `turbopackPluginRuntimeStrategy: 'workerThreads'`                                       | Declined | Next falls back to child processes on Node 24.13.1 and later                                                                                      |
| `turbopackAdditionalRoots`                                                              | Declined | No linked package lives outside the repository                                                                                                    |
| Next.js Devtools MCP                                                                    | Declined | Developer tooling, not part of the product                                                                                                        |
| The analyzer's `next-bundle-optimizer` agent skill                                      | Declined | Agent tooling installed outside the repository, not part of the build                                                                             |
| Multiple icon formats (`app/icon.svg` beside `app/icon.png`)                            | Used     | Help and community, which serve their own basePath icon, gain the PNG fallback the other three name in `BRAND_ICONS`                              |
| `optimisticRouting`, `prefetchInlining`, Turbopack's shared runtime and export mangling | Used     | On by default since 16.4                                                                                                                          |
| Hydration diff indicator, the new default error page                                    | Used     | Development only, on by default                                                                                                                   |
| `catchError()`, `unstable_retry()`                                                      | Declined | No area throws `notFound()` or `redirect()` and there are no Server Components to retry; `AreaErrorBoundary` keeps its stale-chunk recovery       |
| Built-in glob imports (`import.meta.glob`)                                              | Declined | The long import lists name exports keyed by domain ids (type-checked), and their packages also build outside Turbopack (Workers, the CLI, Vitest) |
| The Playwright `instant()` helper                                                       | Declined | It asserts the static shell of a Partial Prefetching navigation, which needs Cache Components                                                     |
| Immutable static assets across deployments                                              | Declined | An adapter feature for `?dpl` skew protection; the stale-builds guard covers skew ([Stale builds](stale-builds.md))                               |
| `experimental.useOffline`                                                               | Declined | Offline is the editor's own system ([Offline mode](../006-document/offline-mode.md)); a soft navigation left pending would hide it                |
| `experimental.concurrentRouterQueue`                                                    | Declined | Router internals with no measured need here                                                                                                       |
