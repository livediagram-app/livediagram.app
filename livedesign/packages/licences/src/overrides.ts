import type { Override } from '@liveworkspace/licences/tables';

// Texts for exact package versions this product ships that carry no licence file
// (docs/specs/002-project-scope/third-party-licences.md "Licence texts"), keyed to the version.
export const OVERRIDES: readonly Override[] = [
  {
    package: '@resvg/resvg-wasm',
    version: '2.6.2',
    texts: [{ label: 'LICENSE (resvg-js 2.6.2)', file: 'resvg-js-2.6.2-LICENSE.txt' }],
  },
  // fontkit, its dfa and its WOFF2 decoder, in the Logo Kit's outliner (docs/specs/007-editor/logo-pages.md
  // "Outlined text").
  {
    package: 'fontkit',
    version: '2.0.4',
    texts: [{ label: 'LICENSE (fontkit 2.0.4 README)', file: 'fontkit-2.0.4-LICENSE.txt' }],
  },
  {
    package: 'dfa',
    version: '1.2.0',
    texts: [{ label: 'LICENSE (dfa 1.2.0 README)', file: 'dfa-1.2.0-LICENSE.txt' }],
  },
  {
    package: 'brotli',
    version: '1.3.3',
    texts: [
      {
        label: 'LICENSE (brotli.js 1.3.3 readme, dec/ header and Apache 2.0)',
        file: 'brotli-1.3.3-LICENSE.txt',
      },
    ],
  },
];
