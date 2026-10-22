import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadLicencesManifest, parseLicencesManifest } from './licences-manifest';

const valid = { schemaVersion: 1, sections: [], texts: {} };

describe('parseLicencesManifest', () => {
  it('returns a manifest of the schema it knows', () => {
    expect(parseLicencesManifest(JSON.stringify(valid))).toEqual(valid);
  });

  it('fails a missing manifest with the command that makes it', () => {
    expect(() => parseLicencesManifest(undefined)).toThrow(
      expect.objectContaining({
        name: 'LicencesManifestMissing',
        message: expect.stringContaining('pnpm licences'),
      }),
    );
  });

  it.each([
    ['not JSON', '{'],
    ['another schema', JSON.stringify({ ...valid, schemaVersion: 2 })],
    ['no sections', JSON.stringify({ schemaVersion: 1, texts: {} })],
    ['no texts', JSON.stringify({ schemaVersion: 1, sections: [] })],
  ])('fails a manifest that is %s', (_, raw) => {
    expect(() => parseLicencesManifest(raw)).toThrow(
      expect.objectContaining({ name: 'LicencesManifestInvalid' }),
    );
  });
});

describe('loadLicencesManifest', () => {
  it('reads generated/licences.json under the app directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'licences-manifest-'));
    mkdirSync(join(dir, 'generated'));
    writeFileSync(join(dir, 'generated', 'licences.json'), JSON.stringify(valid));
    expect(loadLicencesManifest(dir)).toEqual(valid);
  });

  it('fails when the generator has not run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'licences-manifest-'));
    expect(() => loadLicencesManifest(dir)).toThrow(
      expect.objectContaining({ name: 'LicencesManifestMissing' }),
    );
  });
});
