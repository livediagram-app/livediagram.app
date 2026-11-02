import { describe, expect, it } from 'vitest';
import { filterSlashItems } from './article-slash-items';

// docs/specs/007-editor/flashcards.md "Text only": a card's slash menu offers the text blocks only.
describe('the slash menu on a card', () => {
  it('offers the text blocks and never a page break or an object', () => {
    const ids = filterSlashItems('', true).map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(['text', 'h1', 'bullet', 'todo', 'quote', 'code', 'divider']),
    );
    for (const id of ['pageBreak', 'image', 'table', 'toc', 'chart', 'drawing'])
      expect(ids).not.toContain(id);
    expect(filterSlashItems('', true).length).toBeLessThan(filterSlashItems('').length);
  });

  it('matches a query among them alone', () => {
    expect(filterSlashItems('ima', true)).toEqual([]);
    expect(filterSlashItems('ima').map((i) => i.id)).toContain('image');
    expect(filterSlashItems('quo', true).map((i) => i.id)).toEqual(['quote']);
  });
});
