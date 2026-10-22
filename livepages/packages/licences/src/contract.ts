// The licences manifest: what the generator writes and the /licences page reads
// (docs/specs/002-project-scope/third-party-licences.md). Imports nothing, so the
// marketing app can read it without the generator's Node code.

export type Side = 'browser' | 'server';

export type AppId =
  'live' | 'marketing' | 'help' | 'telemetry' | 'community' | 'api' | 'mcp' | 'router';

// A package from npm, a work vendored inside a package, or a work inside a
// binary asset or our own source that the bundler cannot see.
export type WorkKind = 'package' | 'vendored' | 'embedded';

export type WorkEntry = {
  anchor: string;
  kind: WorkKind;
  name: string;
  version: string;
  licence: string;
  // What holds a vendored or embedded work.
  carrier?: string;
  // https only.
  homepage?: string;
  apps: AppId[];
  texts: { label: string; hash: string }[];
};

export type LicencesSection = {
  side: Side;
  apps: { id: AppId; label: string }[];
  works: WorkEntry[];
};

export type LicencesManifest = {
  schemaVersion: typeof LICENCES_SCHEMA_VERSION;
  sections: LicencesSection[];
  texts: Record<string, { lines: number; bytes: number }>;
};

export const LICENCES_SCHEMA_VERSION = 1;

// Where the page fetches a text: `${TEXTS_URL_PREFIX}${hash}.txt`.
export const TEXTS_URL_PREFIX = '/licences/texts/';

// A text box shows this many lines before it scrolls (blueprint D1).
export const TEXT_BOX_MAX_LINES = 24;

// One line of the text box, `text-xs leading-5` (blueprint D2).
export const TEXT_BOX_LINE_HEIGHT_REM = 1.25;
