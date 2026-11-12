import { describe, expect, it } from 'vitest';
import { tabExportBaseName } from './tab-export-name';

describe('tabExportBaseName', () => {
  it('names the item and the tab, and a selection', () => {
    expect(tabExportBaseName('Board', 'Plan (v2)?', false)).toBe('Board - Plan v2');
    expect(tabExportBaseName('a/b', 'c:d', true)).toBe('a-b - c-d - selection');
  });

  it("falls back to the editor's noun", () => {
    expect(tabExportBaseName('', '', false)).toBe('document - tab');
    expect(tabExportBaseName('?', '!', false)).toBe('document');
    expect(tabExportBaseName('', '', false, 'design')).toBe('design - tab');
    expect(tabExportBaseName('?', '!', false, 'design')).toBe('design');
  });
});
