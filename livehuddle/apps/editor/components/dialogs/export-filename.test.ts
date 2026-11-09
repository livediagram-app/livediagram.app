// docs/specs/020-import-export/export-fidelity.md "File names": a tab export's name is safe on every platform,
// keeps no stray dash (as "Plan -v2-.png" did), keeps letters in any script (a Japanese name once read "- - -"),
// and falls back to "document" when nothing safe is left. The rule itself is tested in
// packages/model-core/src/file-name.test.ts.

import { describe, expect, it } from 'vitest';
import { tabExportBaseName } from './ExportTabDialog';

describe('tabExportBaseName', () => {
  it('names the export after the document and tab, safe on every platform', () => {
    expect(tabExportBaseName('Board', 'Plan (v2)?', false)).toBe('Board - Plan v2');
    expect(tabExportBaseName('a/b', 'c:d', true)).toBe('a-b - c-d - selection');
    expect(tabExportBaseName('', '', false)).toBe('document - tab');
  });

  it('keeps names in any script and falls back to "document" when nothing safe is left', () => {
    expect(tabExportBaseName('会議', 'メモ', false)).toBe('会議 - メモ');
    expect(tabExportBaseName('План', 'Доска', false)).toBe('План - Доска');
    expect(tabExportBaseName('?', 'Board', false)).toBe('Board');
    expect(tabExportBaseName('?', '!', false)).toBe('document');
  });
});
