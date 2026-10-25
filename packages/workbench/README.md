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

The folders keep the editor's layout (`lib/…`, `hooks/ui/…`, `hooks/canvas/…`, `components/primitives/…`),
so a module's place here says where it came from.

Code that differs per product stays in the product. A module moves only once it reads the same in all
four, and the product's part of it is handed in:

- **as props or arguments**, for a value or a callback (a label, a URL, what to do on click);
- **as a small injected module** for anything wider: the workbench exports a `createX(config)` or a
  context, and each editor binds it once in a file of its own (`lib/x.ts` calling `createX` with its
  facts), the way `@liveworkspace/telemetry-client` and `@liveworkspace/help-registry` are bound.

Never by importing the product: a workbench module that needs `@<product>/…` is not ready to move.

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
