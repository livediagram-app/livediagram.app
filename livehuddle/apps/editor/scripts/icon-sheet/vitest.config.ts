import { defineConfig, mergeConfig } from 'vitest/config';

import base from '../../vitest.config';

// The icon contact sheet runs on demand (`pnpm icons:sheet`), never with the unit suite.
export default mergeConfig(
  base,
  defineConfig({ test: { include: ['scripts/icon-sheet/sheet.run.tsx'], exclude: [] } }),
);
