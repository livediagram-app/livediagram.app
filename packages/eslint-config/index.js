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
      // Next.js `output: 'export'` static export directory — same status as
      // `.next/`: build output, not source.
      '**/out/**',
      '**/.turbo/**',
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
    },
  },
  prettier,
);
