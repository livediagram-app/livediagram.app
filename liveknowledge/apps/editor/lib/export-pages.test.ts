import { describe, expect, it } from 'vitest';
import { layOutPages } from '@liveknowledge/document';
import { DEFAULT_PAGE_SCOPE, zipEntryName } from './export-pages';

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

  it('names a zip entry by the shared file-name rule', () => {
    const pages = layOutPages([{ id: 'a', orientation: 'portrait', name: 'Poster (9:16)' }]);
    expect(zipEntryName(pages[0]!, 1, 'png')).toMatch(/^01 Poster 9-16 .*\.png$/);
  });
});
