import type { Override } from '@liveworkspace/licences/tables';

// Texts for exact package versions this product ships that carry no licence file
// (docs/specs/002-project-scope/third-party-licences.md "Licence texts"), keyed to the version.
export const OVERRIDES: readonly Override[] = [
  {
    package: '@resvg/resvg-wasm',
    version: '2.6.2',
    texts: [{ label: 'LICENSE (resvg-js 2.6.2)', file: 'resvg-js-2.6.2-LICENSE.txt' }],
  },
];
