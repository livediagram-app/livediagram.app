import { defineConfig } from 'oxlint';
import config from '@livediagram/oxlint-config';

export default defineConfig({
  ...config,
  overrides: [
    ...(config.overrides ?? []),
    {
      // The e2e/ Playwright smoke suite (docs/specs/003-system-architecture/e2e-smoke.md) isn't
      // React: Playwright's fixture API takes a param literally named `use`, which the hooks rule
      // misreads as a hook call. Scope that rule off for the suite (the specs never touch React).
      files: ['e2e/**/*.ts'],
      rules: { 'react/rules-of-hooks': 'off' },
    },
  ],
});
