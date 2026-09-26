import config from '@livediagram/eslint-config';

export default [
  ...config,
  {
    // The e2e/ Playwright smoke suite (docs/specs/003-system-architecture/e2e-smoke.md) isn't React: Playwright's
    // fixture API takes a param literally named `use`, which the
    // react-hooks plugin misreads as a hook call. Scope that rule off
    // for the suite (the specs never touch React).
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
];
