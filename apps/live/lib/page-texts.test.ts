import { describe, expect, it } from 'vitest';
import { createShape, layOutPages, type Page } from '@livediagram/document';
import { contentsRows, filterContents } from './page-contents';
import { pageTexts } from './page-texts';

// docs/specs/007-editor/pages-mode.md "Contents": Find a Page finds the words on the pages.
const pages = layOutPages([
  { id: 'a', orientation: 'portrait', kind: 'infographic' },
  { id: 'b', orientation: 'portrait', kind: 'article', flow: 'f1' },
] as Page[]);
const box = {
  ...createShape('square', pages[0]!.rect.x + 40, pages[0]!.rect.y + 40),
  id: 'box',
  label: 'Quarterly Revenue',
  note: 'from the finance team',
};
const articles = {
  f1: {
    blocks: [
      {
        id: 'h',
        type: 'paragraph' as const,
        style: 'title' as const,
        runs: [{ text: 'Field ' }, { text: 'Notes' }],
      },
      { id: 'c', type: 'code' as const, text: 'npm run harbour' },
    ],
  },
};

describe('pageTexts', () => {
  it("reads each page's element texts and an article page's writing", () => {
    const texts = pageTexts(pages, [box], articles);
    expect(texts.get('a')).toContain('Quarterly Revenue');
    expect(texts.get('a')).toContain('finance team');
    expect(texts.get('b')).toContain('Field Notes');
    expect(texts.get('b')).toContain('harbour');
    expect(texts.get('b')).not.toContain('Quarterly');
  });

  it('lets Find a Page find a page by the words on it, any case', () => {
    const rows = contentsRows(pages);
    const texts = pageTexts(pages, [box], articles);
    expect(filterContents(rows, 'REVENUE', texts).map((r) => r.id)).toEqual(['a']);
    expect(filterContents(rows, 'field notes', texts).map((r) => r.id)).toEqual(['b']);
    // Without the texts, only the name, kind and number are searched.
    expect(filterContents(rows, 'revenue')).toEqual([]);
  });
});
