import { describe, expect, it } from 'vitest';
import { layOutPages } from '@livedesign/design';
import { DEFAULT_PAGE_SCOPE, pageFileLabel, tabExportBaseName, zipEntryName } from './export-pages';

// docs/specs/007-editor/pages-mode.md "Export".
describe('page export', () => {
  it('starts a PDF on all pages and an image on one', () => {
    expect(DEFAULT_PAGE_SCOPE).toEqual({ pdf: 'all', png: 'one', svg: 'one' });
  });

  it('names zip entries by place then label, filesystem-safe', () => {
    const pages = layOutPages([
      { id: 'a', orientation: 'portrait', name: 'Intro: why?' },
      { id: 'b', orientation: 'landscape' },
    ]);
    const first = zipEntryName(pages[0]!, 2, 'png');
    expect(first).toMatch(/^01 Intro.*\.png$/);
    expect(first).toMatch(/^[A-Za-z0-9._\- ]+$/);
    expect(zipEntryName(pages[1]!, 2, 'svg')).toMatch(/^02 Page 2/);
  });

  // docs/specs/020-import-export/export-fidelity.md "File names": a page named in Japanese once lost every letter
  // of its file name, and a page's size in its label read "Poster -9-16-" before brackets were dropped.
  it('keeps a page name in any script and drops brackets and colons', () => {
    const pages = layOutPages([
      { id: 'a', orientation: 'portrait', name: '会議 メモ' },
      { id: 'b', orientation: 'portrait', name: 'Poster (9:16)' },
    ]);
    expect(pageFileLabel(pages[0]!, 2)).toMatch(/^会議 メモ/);
    expect(zipEntryName(pages[0]!, 2, 'png')).toMatch(/^01 会議 メモ.*\.png$/);
    expect(pageFileLabel(pages[1]!, 2)).not.toMatch(/[():]/);
  });

  it('names a tab export after the design and tab, falling back to "design"', () => {
    expect(tabExportBaseName('Acme', 'Logo (v2)?', false)).toBe('Acme - Logo v2');
    expect(tabExportBaseName('Acme', 'a/b', true)).toBe('Acme - a-b - selection');
    expect(tabExportBaseName('', '', false)).toBe('design - tab');
    expect(tabExportBaseName('会議', 'メモ', false)).toBe('会議 - メモ');
    expect(tabExportBaseName('?', '!', false)).toBe('design');
  });
});
