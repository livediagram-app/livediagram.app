import { describe, expect, it } from 'vitest';

import type { LicencesManifest } from './contract.ts';
import { checkExport, LICENCES_HTML_BUDGET_BYTES } from './verify-export.ts';

const manifest: LicencesManifest = {
  schemaVersion: 1,
  sections: [],
  texts: { aaaa: { lines: 1, bytes: 4 }, bbbb: { lines: 2, bytes: 8 } },
};

describe('checkExport', () => {
  it('passes a page within budget with every text exported', () => {
    expect(
      checkExport({ manifest, htmlBytes: 1000, exportedTexts: ['aaaa.txt', 'bbbb.txt'] }),
    ).toEqual([]);
  });

  it('names a missing page, missing texts and a page over budget', () => {
    expect(checkExport({ manifest, htmlBytes: undefined, exportedTexts: ['aaaa.txt'] })).toEqual([
      'licences.html was not exported',
      'text bbbb.txt was not exported',
    ]);
    expect(
      checkExport({
        manifest,
        htmlBytes: LICENCES_HTML_BUDGET_BYTES + 1,
        exportedTexts: ['aaaa.txt', 'bbbb.txt'],
      }),
    ).toEqual([
      `licences.html is ${LICENCES_HTML_BUDGET_BYTES + 1} bytes, over ${LICENCES_HTML_BUDGET_BYTES}`,
    ]);
  });

  it('refuses a page listing no texts at all', () => {
    expect(
      checkExport({ manifest: { ...manifest, texts: {} }, htmlBytes: 10, exportedTexts: [] }),
    ).toEqual(['the manifest lists no texts']);
  });
});
