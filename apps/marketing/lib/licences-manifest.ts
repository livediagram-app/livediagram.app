import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LICENCES_SCHEMA_VERSION, type LicencesManifest } from '@livediagram/licences';

// The /licences page's data, written by the licences generator before
// `next build` (docs/specs/002-project-scope/third-party-licences.md). Read at
// build time only: the page is a static export.
class LicencesManifestError extends Error {
  constructor(name: 'LicencesManifestMissing' | 'LicencesManifestInvalid', message: string) {
    super(`${name}: ${message}`);
    this.name = name;
  }
}

export function parseLicencesManifest(raw: string | undefined): LicencesManifest {
  if (raw === undefined) {
    throw new LicencesManifestError(
      'LicencesManifestMissing',
      'generated/licences.json does not exist; run `pnpm licences` (the marketing build runs it)',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LicencesManifestError(
      'LicencesManifestInvalid',
      'generated/licences.json is not JSON',
    );
  }
  const manifest = parsed as Partial<LicencesManifest> | null;
  if (
    manifest?.schemaVersion !== LICENCES_SCHEMA_VERSION ||
    !Array.isArray(manifest.sections) ||
    typeof manifest.texts !== 'object'
  ) {
    throw new LicencesManifestError(
      'LicencesManifestInvalid',
      `generated/licences.json is not schema version ${LICENCES_SCHEMA_VERSION}`,
    );
  }
  return manifest as LicencesManifest;
}

export function loadLicencesManifest(appDir: string = process.cwd()): LicencesManifest {
  let raw: string | undefined;
  try {
    raw = readFileSync(join(appDir, 'generated', 'licences.json'), 'utf8');
  } catch {
    raw = undefined;
  }
  return parseLicencesManifest(raw);
}
