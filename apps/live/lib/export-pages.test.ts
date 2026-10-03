import { describe, expect, it } from 'vitest';
import { layOutIllustratePages } from '@livediagram/document';
import { DEFAULT_PAGE_SCOPE, sanitizeFilename, zipEntryName } from './export-pages';

// docs/specs/007-editor/illustrate-pages.md "Export".
describe('page export', () => {
  it('starts a PDF on all pages and an image on one', () => {
    expect(DEFAULT_PAGE_SCOPE).toEqual({ pdf: 'all', png: 'one', svg: 'one' });
  });

  it('names zip entries by place then label, filesystem-safe', () => {
    const pages = layOutIllustratePages([
      { id: 'a', orientation: 'portrait', name: 'Intro: why?' },
      { id: 'b', orientation: 'landscape' },
    ]);
    const first = zipEntryName(pages[0]!, 2, 'png');
    expect(first).toMatch(/^01 Intro.*\.png$/);
    expect(first).toMatch(/^[A-Za-z0-9._\- ]+$/);
    expect(zipEntryName(pages[1]!, 2, 'svg')).toMatch(/^02 Page 2/);
    expect(sanitizeFilename('a/b:c')).toBe('a-b-c');
  });
});
