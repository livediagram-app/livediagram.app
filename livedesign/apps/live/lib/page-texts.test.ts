import { describe, expect, it } from 'vitest';
import { createShape, layOutPages, type Page } from '@livedesign/document';
import { contentsRows, filterContents } from './page-contents';
import { pageTexts } from './page-texts';

// docs/specs/007-editor/pages-mode.md "Contents": Find a Page finds the words on the pages.
const pages = layOutPages([
  { id: 'a', orientation: 'portrait', kind: 'infographic' },
  { id: 'b', orientation: 'portrait', kind: 'infographic', name: 'Field Notes' },
] as Page[]);
const box = {
  ...createShape('square', pages[0]!.rect.x + 40, pages[0]!.rect.y + 40),
  id: 'box',
  label: 'Quarterly Revenue',
  note: 'from the finance team',
};
describe('pageTexts', () => {
  it("reads each page's element texts", () => {
    const texts = pageTexts(pages, [box]);
    expect(texts.get('a')).toContain('Quarterly Revenue');
    expect(texts.get('a')).toContain('finance team');
    expect(texts.get('b')).not.toContain('Quarterly');
  });

  it('lets Find a Page find a page by the words on it, any case', () => {
    const rows = contentsRows(pages);
    const texts = pageTexts(pages, [box]);
    expect(filterContents(rows, 'REVENUE', texts).map((r) => r.id)).toEqual(['a']);
    // Without the texts, only the name, kind and number are searched.
    expect(filterContents(rows, 'revenue')).toEqual([]);
  });
});
