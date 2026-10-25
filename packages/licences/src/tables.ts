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
// read `../packages/…`.
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
