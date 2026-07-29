import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      // Dev-server cache dir for `apps/live` — separated from
      // `.next/` to keep `next dev` from racing `next build` on the
      // same files. See `apps/live/next.config.ts` + the dev script.
      '**/.next-dev/**',
      // Next.js `output: 'export'` static export directory — same status as
      // `.next/`: build output, not source.
      '**/out/**',
      '**/.turbo/**',
      // Cloudflare Wrangler local state / esbuild artifacts; never
      // source. Generated on every `wrangler dev` run.
      '**/.wrangler/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Next.js writes a triple-slash reference here on every build/dev.
      // It conflicts with @typescript-eslint/triple-slash-reference and is
      // not something we control.
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      ...reactHooks.configs.recommended.rules,
      // React Compiler rules, new in eslint-plugin-react-hooks v7. They catch
      // real problems (we fixed ten across marketing / telemetry / help / ui
      // when they first ran) but apps/live starts with 161 findings across 103
      // files, mostly in the editor's hot paths. Erroring would either block
      // every build or force a rushed refactor of the most intricate app in the
      // repo, so they warn: the signal stays visible and gets burned down
      // deliberately. Promote each back to 'error' once its count reaches zero.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  prettier,
);
