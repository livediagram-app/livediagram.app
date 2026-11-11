# @liveworkspace/next-config

Shared [Next.js](https://nextjs.org) settings for every Next app in the monorepo: each product's
editor, help and marketing apps (and livediagram's community app), and liveworkspace's site. See a
product's `docs/specs/016-platform/nextjs.md`, e.g.
[livediagram's](../../livediagram/docs/specs/016-platform/nextjs.md), and its
[`e2e-smoke.md`](../../livediagram/docs/specs/003-system-architecture/e2e-smoke.md).

## Usage

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { liveworkspaceNextConfig } from '@liveworkspace/next-config';

const nextConfig: NextConfig = {
  ...liveworkspaceNextConfig(),
  // Only what is this app's own: basePath, trailingSlash, transpilePackages, ...
};
```

Only an editor asks for the React Compiler
(`liveworkspaceNextConfig({ exportInDev: false, reactCompiler: true })`). `apps-use-shared.test.js`
checks every app keeps to that, and sets none of the shared keys itself.

## Dev servers

Every app's `dev` script runs `node ../../../packages/next-config/scripts/next-dev.mjs --port <n>`, the one copy of
the dev entry: it points `next dev` at its own `.next-dev/` and, before starting, checks the port
(`scripts/port-guard.js`). When another process already listens there it prints that process's PID, command and folder
and exits, leaving it running, since sessions and agents share the machine. `--force` kills the holder and its children
and takes the port (`corepack pnpm --filter <app> dev -- --force`). `--webpack` runs dev on webpack.

`typescriptConfig()` keeps `next build`'s type check unless `BUILD_SKIP_TYPECHECK=1`, which only the
E2E Smoke jobs set: CI's required Checks job already type-checks every app with `tsc --noEmit`.

## The asset size gate

Workers Static Assets refuses any file over 25 MiB, and only at deploy. Each editor's `build` ends with
`asset-size-gate out` (this package's bin, `asset-size-gate.js`), which fails the build on any file in
`out/` over the limit and names it, so CI catches it first.
