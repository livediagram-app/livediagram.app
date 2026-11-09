import { describe, expect, it } from 'vitest';
import { layOutPages } from '@livedocuments/document';
import { DEFAULT_PAGE_SCOPE, sanitizeFilename, zipEntryName } from './export-pages';

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
    expect(sanitizeFilename('a/b:c')).toBe('a-b-c');
  });

  it('drops brackets and colons from a name and collapses repeated dashes', () => {
    expect(sanitizeFilename('Poster (9:16)')).toBe('Poster 9-16');
    expect(sanitizeFilename('(9:16)')).toBe('9-16');
    expect(sanitizeFilename('Deck - Slide [1]: intro?')).toBe('Deck - Slide 1- intro');
    expect(sanitizeFilename('a---b')).toBe('a-b');
    expect(sanitizeFilename('?')).toBe('');
  });

  it('keeps letters and digits in any script, and leaves no dash or space at either end', () => {
    expect(sanitizeFilename('会議メモ - Проект 2')).toBe('会議メモ - Проект 2');
    expect(sanitizeFilename('Café/Crème')).toBe('Café-Crème');
    expect(sanitizeFilename('? - Board')).toBe('Board');
    expect(sanitizeFilename('Board - ?')).toBe('Board');
    expect(sanitizeFilename('<>:"|?*')).toBe('');
  });
});
