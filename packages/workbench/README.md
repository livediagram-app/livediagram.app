# @liveworkspace/workbench

The editor code the four editors share: `livediagram/apps/editor`, `liveplanner/apps/editor`,
`livedocuments/apps/editor` and `livedesign/apps/live`. It is step 4 of
[docs/structure.md](../../docs/structure.md), the editor shell carved out of each `apps/editor` one area
at a time.

## What belongs here

Editor code that reads the same in every editor and names no product:

- it imports only other workbench modules, the shared `@liveworkspace/*` packages and npm packages,
  never `@livediagram/*`, `@liveplanner/*`, `@livedocuments/*` or `@livedesign/*`, and never a file
  of an editor;
- its tests come with it, and run here.

The folders keep the editor's layout (`lib/…`, `hooks/ui/…`, `hooks/canvas/…`, `components/primitives/…`,
`components/canvas/…`, `components/tour/…` and so on), so a module's place here says where it came from.

A shared name from the design system is imported from `@liveworkspace/ui`, not through a product's
`@<product>/ui` (which re-exports it unchanged). A name a product's ui binds for itself (`SiteFooter`,
`IDENTITY_FILL`, `Brand`) is a product import, so a module using one stays in the editor. Comments
here are product-neutral: they cite a product spec by the path the products share
(`docs/specs/007-editor/editor-app.md`, `live-app.md` in livedesign) rather than one product's nouns.

Code that differs per product stays in the product. A module moves only once it reads the same in all
four, and the product's part of it is handed in:

- **as props or arguments**, for a value or a callback (a label, a URL, what to do on click);
- **as a small injected module** for anything wider: the workbench exports a `createX(config)` or a
  context, and each editor binds it once in a file of its own (`lib/x.ts` calling `createX` with its
  facts), the way `@liveworkspace/telemetry-client` and `@liveworkspace/help-registry` are bound;
- **as a binding**, for the few product facts that many modules read at run time (its telemetry, its
  storage keys, its api transport). See below.

Never by importing the product: a workbench module that needs `@<product>/…` is not ready to move.

## Bindings

`src/bindings.ts` holds what an editor tells the workbench once, at startup, rather than threading it
through props: each editor's `lib/workbench-bindings.ts` calls `configureWorkbench({ … })` with its
facts, and workbench code reads them through `workbench` (`workbench.track(…)`,
`workbench.debugKey`), never through the product's own module.

| Binding             | What it is                                                                                   | Read by                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `debugKey`          | the localStorage key of the debug flag (`<product>:debug`)                                   | `lib/debug-log`                                                                  |
| `track`             | the product's telemetry `track`, typed on the events workbench code sends                    | `lib/stale-build-navigation`, `hooks/canvas/useZoomControls`                     |
| `reloadGuardKey`    | the sessionStorage key of the one reload guard (`<product>:stale-chunk-reloads`)             | `lib/reload-guard`                                                               |
| `appRecoveryFlag`   | the window flag the app's chunk recovery sets (`__<product>ChunkRecovery`)                   | `lib/stale-build-navigation`                                                     |
| `formatLogScope`    | the fingerprint of the stored format (`document-format`, `project-format`, …)                | `lib/reload-when-saved`                                                          |
| `runningStaleBuild` | whether this page runs an older build than the live one (the product's server-release)       | `lib/stale-build-navigation`                                                     |
| `readPreferences`   | the person's preferences, as far as workbench code reads them (`reduceMotion`)               | `hooks/ui/useReduceMotion`                                                       |
| `api`               | the product's api transport: `fetch`, `headers`, `expectOk`, `expectOkVoid`, `currentBearer` | `lib/api/oauth`, `lib/api/tokens`, `lib/index-client`, `lib/explorer-teams-host` |
| `zoomMax`           | the canvas's zoom ceiling now (livedesign raises it for a photo page)                        | `lib/double-tap-zoom`, `hooks/canvas/useZoomControls`                            |

The rules:

- **Types stay precise.** `track` takes the narrow subset of events workbench code sends
  (`WorkbenchTelemetryCategory`, `WorkbenchTelemetryAction`), so a product's wider `track` binds as it
  is and typecheck fails if its vocabulary ever drops one. `readPreferences` answers the subset type
  it reads. No `any`. Where a module was the same but for a type or a constant every product
  shares, that moved here instead and the product re-exports it: `ApiError` (`lib/api/api-error`,
  re-exported by each `lib/api/core.ts`), `QuickConnectDirection` (`lib/quick-connect`) and the zoom
  bounds (`lib/zoom-range`, re-exported by each `lib/canvas.ts`); UI scale is typed on
  `UiScalePreferences`, the four keys it reads.
- **Configured before it is read.** The editor calls its `bindWorkbench()` at module scope in its
  root providers (`components/providers/AuthProvider.tsx`) and in `app/global-error.tsx`, the one
  page outside the root layout. Both evaluate before any component renders, and workbench code
  reads a binding only when it runs (an effect, a handler, a call), never at module scope, so a
  module-level singleton reads it lazily (`getToken: () => workbench.api.currentBearer()`).
- **Safe when unconfigured.** Every binding has a typed default: `track` does nothing, the keys
  are `workbench:`-prefixed, `api` refuses with an error rather than sending an anonymous request.
  Tests run on the defaults unless they configure their own (`lib/testing/bindings` builds a full
  set from a few), and a development build warns once if workbench code reads a binding before
  `configureWorkbench`.
- **A product's facts stay the product's.** Its keys are constants in its `lib/workbench-keys.ts`
  (no imports, so its pre-boot scripts and e2e fixtures read them too); never change one in place,
  since people's saved flags live under it. A product difference becomes a binding value, never a
  dropped behaviour.

## Use

Every module is its own subpath, named after its path under `src/`, with no barrel:

```ts
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
```

`exports.test.ts` keeps the `exports` map in step with `src/` and keeps a barrel out, so an editor
bundles only the modules it imports.

Each editor lists the package in `transpilePackages`, and its global stylesheet scans it for classes:

```css
@source '../../../../packages/workbench/src';
```

## Guards

The editors' repo-scan guards (aria-label roles, label contrast, count badges, the palettes and so on)
read `packages/workbench/src` beside their own folders, because this code renders in every editor's
palette. The style guards that need no product (optical alignment, touch targets, the motion budget)
run here as well, in `style-guards.test.ts`.
