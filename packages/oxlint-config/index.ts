import { fileURLToPath } from 'node:url';
import { defineConfig } from 'oxlint';
import { ICON_ART_ALLOWLIST } from '@livediagram/oxlint-config/raw-svg';

// The shared oxlint config every workspace's `oxlint.config.ts` re-exports
// (docs/specs/003-system-architecture/linting.md). Rules are listed one by one, every category is
// off, so this file is the whole of what the repo enforces; every rule is an error.

const JS_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx'];
const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
// Tests: unit and e2e specs, and the Playwright suites with their helpers.
const TEST_FILES = ['**/*.test.*', '**/*.spec.*', '**/e2e/**'];

// A `jsPlugins` specifier resolves from the config file that names it, so plugins are passed as
// absolute paths: every workspace's config, and the tests' scratch configs, load the same files.
const pathOf = (specifier: string) => fileURLToPath(import.meta.resolve(specifier));

export default defineConfig({
  plugins: ['eslint', 'typescript', 'react'],
  jsPlugins: [pathOf('./plugin.ts')],
  categories: {
    correctness: 'off',
    suspicious: 'off',
    pedantic: 'off',
    perf: 'off',
    style: 'off',
    restriction: 'off',
    nursery: 'off',
  },
  env: { browser: true, node: true, es2022: true },
  ignorePatterns: [
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    // Dev-server cache dir for `apps/live`, separated from `.next/` to keep `next dev` from
    // racing `next build` on the same files. See `apps/live/next.config.ts` + the dev script.
    '**/.next-dev/**',
    // The licences generator's analysis of each Next app
    // (docs/specs/002-project-scope/third-party-licences.md): build output.
    '**/.next-analyze/**',
    // Next.js `output: 'export'` static export directory: build output, not source.
    '**/out/**',
    '**/.turbo/**',
    // Cloudflare Wrangler local state and esbuild artefacts, generated on every `wrangler dev`.
    '**/.wrangler/**',
    '**/node_modules/**',
    '**/coverage/**',
    // Next.js writes a triple-slash reference here on every build and dev run; it is not ours.
    '**/next-env.d.ts',
  ],
  options: {
    // A disable directive that no longer suppresses anything states a rule fires where it does
    // not, and keeps silently covering the line if a real problem appears later.
    reportUnusedDisableDirectives: 'error',
    // Only `oxlint-disable` directives count, so a pasted `eslint-disable` never hides a finding.
    respectEslintDisableDirectives: false,
    // Type-aware rules run through oxlint-tsgolint, on typescript-go: the TypeScript the repo
    // type-checks with, reading each workspace's tsconfig.
    typeAware: true,
  },
  rules: {
    // Correctness and suspicious-code rules (ESLint's recommended set).
    'eslint/for-direction': 'error',
    'eslint/no-async-promise-executor': 'error',
    'eslint/no-case-declarations': 'error',
    'eslint/no-compare-neg-zero': 'error',
    'eslint/no-cond-assign': ['error', 'except-parens'],
    'eslint/no-constant-binary-expression': ['error', { checkRelationalComparisons: false }],
    'eslint/no-constant-condition': ['error', { checkLoops: 'allExceptWhileTrue' }],
    'eslint/no-control-regex': 'error',
    'eslint/no-debugger': 'error',
    'eslint/no-delete-var': 'error',
    'eslint/no-dupe-else-if': 'error',
    'eslint/no-duplicate-case': 'error',
    'eslint/no-empty': 'error',
    'eslint/no-empty-character-class': 'error',
    'eslint/no-empty-pattern': 'error',
    'eslint/no-empty-static-block': 'error',
    'eslint/no-ex-assign': 'error',
    'eslint/no-extra-boolean-cast': 'error',
    'eslint/no-fallthrough': 'error',
    'eslint/no-global-assign': 'error',
    'eslint/no-invalid-regexp': 'error',
    'eslint/no-irregular-whitespace': [
      'error',
      {
        skipComments: false,
        skipJSXText: false,
        skipRegExps: false,
        skipStrings: true,
        skipTemplates: false,
      },
    ],
    'eslint/no-loss-of-precision': 'error',
    'eslint/no-misleading-character-class': 'error',
    'eslint/no-nonoctal-decimal-escape': 'error',
    'eslint/no-prototype-builtins': 'error',
    'eslint/no-regex-spaces': 'error',
    'eslint/no-self-assign': 'error',
    'eslint/no-shadow-restricted-names': 'error',
    'eslint/no-sparse-arrays': 'error',
    'eslint/no-unassigned-vars': 'error',
    'eslint/no-unsafe-finally': 'error',
    'eslint/no-unsafe-optional-chaining': 'error',
    'eslint/no-unused-labels': 'error',
    'eslint/no-unused-private-class-members': 'error',
    'eslint/no-useless-assignment': 'error',
    'eslint/no-useless-backreference': 'error',
    'eslint/no-useless-catch': 'error',
    'eslint/no-useless-escape': 'error',
    'eslint/preserve-caught-error': 'error',
    'eslint/require-yield': 'error',
    'eslint/use-isnan': 'error',
    'eslint/valid-typeof': 'error',

    // TypeScript rules (typescript-eslint's recommended set).
    'eslint/no-array-constructor': 'error',
    'eslint/no-unused-expressions': 'error',
    'eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
    ],
    'typescript/ban-ts-comment': 'error',
    'typescript/no-duplicate-enum-values': 'error',
    'typescript/no-empty-object-type': 'error',
    'typescript/no-explicit-any': 'error',
    'typescript/no-extra-non-null-assertion': 'error',
    'typescript/no-misused-new': 'error',
    'typescript/no-namespace': 'error',
    'typescript/no-non-null-asserted-optional-chain': 'error',
    'typescript/no-require-imports': 'error',
    'typescript/no-this-alias': 'error',
    'typescript/no-unnecessary-type-constraint': 'error',
    'typescript/no-unsafe-declaration-merging': 'error',
    'typescript/no-unsafe-function-type': 'error',
    'typescript/no-wrapper-object-types': 'error',
    'typescript/prefer-as-const': 'error',
    'typescript/prefer-namespace-keyword': 'error',
    'typescript/triple-slash-reference': 'error',

    // Every React hooks rule, the React Compiler's included, is an error with no per-line
    // suppressions (docs/specs/003-system-architecture/react-state-and-effects.md): render is
    // pure, effects only synchronise with the outside world, and dependencies are complete.
    // oxlint's native port of eslint-plugin-react-hooks: every rule it recommends except `config`
    // and `gating`, which check React Compiler options the repo never sets.
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'error',
    'react/static-components': 'error',
    'react/use-memo': 'error',
    'react/preserve-manual-memoization': 'error',
    'react/incompatible-library': 'error',
    'react/immutability': 'error',
    'react/globals': 'error',
    'react/refs': 'error',
    'react/set-state-in-effect': 'error',
    'react/error-boundaries': 'error',
    'react/purity': 'error',
    'react/set-state-in-render': 'error',
    'react/unsupported-syntax': 'error',

    // The repo's own rules (./plugin.ts).
    'livediagram/no-native-title': 'error',
    'livediagram/no-raw-icon-svg': 'error',
  },
  overrides: [
    {
      // TypeScript's compiler already rejects what these catch, so they run on JavaScript only.
      files: JS_FILES,
      rules: {
        'eslint/constructor-super': 'error',
        'eslint/getter-return': 'error',
        'eslint/no-class-assign': 'error',
        'eslint/no-const-assign': 'error',
        'eslint/no-dupe-class-members': 'error',
        'eslint/no-dupe-keys': 'error',
        'eslint/no-func-assign': 'error',
        'eslint/no-import-assign': 'error',
        'eslint/no-new-native-nonconstructor': 'error',
        'eslint/no-obj-calls': 'error',
        'eslint/no-redeclare': 'error',
        'eslint/no-setter-return': 'error',
        'eslint/no-this-before-super': 'error',
        'eslint/no-undef': 'error',
        'eslint/no-unreachable': 'error',
        'eslint/no-unsafe-negation': 'error',
        'eslint/no-with': 'error',
      },
    },
    {
      // Modern-syntax rules for TypeScript, where `var` and `arguments` have a typed successor.
      files: TS_FILES,
      rules: {
        'eslint/no-var': 'error',
        'eslint/prefer-const': 'error',
        'eslint/prefer-rest-params': 'error',
        'eslint/prefer-spread': 'error',
      },
    },
    {
      // Type-aware rules (typescript-eslint's recommended type-checked set), through oxlint-tsgolint.
      // TypeScript only: a JavaScript file carries no types, so every value in it reads as `any`.
      files: TS_FILES,
      rules: {
        'typescript/await-thenable': 'error',
        'typescript/no-array-delete': 'error',
        'typescript/no-base-to-string': 'error',
        'typescript/no-duplicate-type-constituents': 'error',
        'typescript/no-floating-promises': 'error',
        'typescript/no-for-in-array': 'error',
        'typescript/no-implied-eval': 'error',
        'typescript/no-misused-promises': 'error',
        'typescript/no-redundant-type-constituents': 'error',
        'typescript/no-unnecessary-type-assertion': 'error',
        'typescript/no-unsafe-argument': 'error',
        'typescript/no-unsafe-call': 'error',
        'typescript/no-unsafe-enum-comparison': 'error',
        'typescript/no-unsafe-member-access': 'error',
        'typescript/no-unsafe-return': 'error',
        'typescript/no-unsafe-unary-minus': 'error',
        'typescript/only-throw-error': 'error',
        // A reason caught and passed on unchanged is unknown, as only-throw-error allows by default.
        'typescript/prefer-promise-reject-errors': ['error', { allowThrowingUnknown: true }],
        'typescript/restrict-plus-operands': 'error',
        'typescript/restrict-template-expressions': 'error',
        'typescript/unbound-method': 'error',
      },
    },
    {
      // Source only: a test stubs and restores methods by reference (`Storage.prototype.getItem`,
      // `element.scrollIntoView`), which is what the rule refuses.
      files: TEST_FILES,
      rules: {
        'typescript/unbound-method': 'off',
      },
    },
    {
      // Art keeps its own paint; only the title rule applies there.
      files: ICON_ART_ALLOWLIST,
      rules: { 'livediagram/no-raw-icon-svg': 'off' },
    },
  ],
});
