import type { AppId, Side } from './contract.ts';
import type { TextRef } from './texts.ts';

// The shapes of the tables each product keeps in its own @<product>/licences: its apps, the texts for
// package versions that ship none, and the works its bundlers cannot see
// (docs/specs/002-project-scope/third-party-licences.md in each product).

export type LicenceApp = { id: AppId; label: string; side: Side; bundler: 'next' | 'worker' };

// Texts for exact package versions that ship no licence file
// (docs/specs/002-project-scope/third-party-licences.md "Licence texts"). Keyed
// to the version, so an upgrade fails the build until someone reviews it again.
export type Override = { package: string; version: string; licence?: string; texts: TextRef[] };

// Material a bundler cannot see into: libraries compiled into an emitted
// WebAssembly binary or font, and third-party geometry vendored into our own
// source (docs/specs/002-project-scope/third-party-licences.md "What counts as
// shipped"). Every emitted binary asset must match at least one entry. A source
// trigger is a path from the product's folder, so the monorepo's shared packages
// read `../packages/…`; one ending in `/` is a folder, and any bundled file under it
// triggers (Lucide's glyphs, one module each).
export type EmbeddedWork = {
  id: string;
  name: string;
  version: string;
  licence: string;
  carrier: string;
  homepage: string;
  trigger: { assets: RegExp } | { sources: string[] };
  texts: TextRef[];
};

// A product's licences page as the generator and the checks take it (its @<product>/licences `src/product.ts`):
// its folder and its own tables.
export type LicencesProduct = {
  // The product's folder (the one holding apps/), as a file: URL or a path.
  productRoot: URL | string;
  // Every deployed app, in the order the page lists them.
  apps: readonly LicenceApp[];
  // Apps distributed rather than deployed, which carry their own notices, so the page leaves them out.
  distributed?: readonly string[];
  overrides: readonly Override[];
  embedded: readonly EmbeddedWork[];
};

// fontkit's dfa and its WOFF2 decoder, which ship no licence file (fontkit itself ships its LICENSE): in every
// editor's PDF export and livedesign's Logo Kit, through @liveworkspace/vector-export
// (liveworkspace/docs/specs/013-export/vector-pdf.md). Each product spreads these into its overrides.
export const VECTOR_EXPORT_OVERRIDES: readonly Override[] = [
  {
    package: 'dfa',
    version: '2.0.0',
    texts: [{ label: 'LICENSE (dfa 2.0.0 README)', file: 'dfa-2.0.0-LICENSE.txt' }],
  },
  {
    package: 'brotli',
    version: '2.1.0',
    texts: [
      {
        label: 'LICENSE (brotli.js 2.1.0 readme, dec/ header and Apache 2.0)',
        file: 'brotli-2.1.0-LICENSE.txt',
      },
    ],
  },
];
