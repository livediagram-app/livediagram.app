import type { Override } from '@liveworkspace/licences/tables';

// Texts for exact package versions that ship no licence file, keyed to the version so an upgrade
// asks for review again. The texts are the monorepo's one pool (@liveworkspace/licences/texts).
export const OVERRIDES: readonly Override[] = [
  // better-auth's utilities declare MIT but published 0.5.0 before the repository had a LICENSE.
  {
    package: '@better-auth/utils',
    version: '0.5.0',
    texts: [
      {
        label: 'LICENSE (better-auth/utils, ef52288)',
        file: 'better-auth-utils-ef52288-LICENSE.txt',
      },
    ],
  },
  // The media worker's PNG renderer (packages/render-png), as in every product's table.
  {
    package: '@resvg/resvg-wasm',
    version: '2.6.2',
    texts: [{ label: 'LICENSE (resvg-js 2.6.2)', file: 'resvg-js-2.6.2-LICENSE.txt' }],
  },
];
