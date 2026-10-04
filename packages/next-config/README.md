# @livediagram/next-config

Shared [Next.js](https://nextjs.org) settings for the monorepo's Next apps (live, help, telemetry,
marketing). See [`docs/specs/003-system-architecture/e2e-smoke.md`](../../docs/specs/003-system-architecture/e2e-smoke.md).

## Usage

```ts
// next.config.ts
import { typescriptConfig } from '@livediagram/next-config';

const nextConfig: NextConfig = {
  typescript: typescriptConfig(),
};
```

`typescriptConfig()` keeps `next build`'s type check unless `BUILD_SKIP_TYPECHECK=1`, which only the
E2E Smoke jobs set: CI's required Checks job already type-checks every app with `tsc --noEmit`.
