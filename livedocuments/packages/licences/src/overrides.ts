import type { TextRef } from './texts.ts';

// Texts for exact package versions that ship no licence file
// (docs/specs/002-project-scope/third-party-licences.md "Licence texts"). Keyed
// to the version, so an upgrade fails the build until someone reviews it again.
export type Override = { package: string; version: string; licence?: string; texts: TextRef[] };

export const OVERRIDES: readonly Override[] = [
  {
    package: '@resvg/resvg-wasm',
    version: '2.6.2',
    texts: [{ label: 'LICENSE (resvg-js 2.6.2)', file: 'resvg-js-2.6.2-LICENSE.txt' }],
  },
];
