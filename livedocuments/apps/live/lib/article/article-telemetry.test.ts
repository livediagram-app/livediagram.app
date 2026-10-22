import { describe, expect, it } from 'vitest';
import { filterSlashItems } from './article-slash-items';
import { slashInsertEvent } from './article-telemetry';

// docs/specs/007-editor/article-pages.md "Telemetry": a block inserted from the slash menu counts
// as one from the toolbar's Insert.
const eventOf = (id: string) =>
  slashInsertEvent(filterSlashItems('').find((i) => i.id === id)!.action);

describe('slash menu telemetry', () => {
  it('counts the block inserts', () => {
    expect(eventOf('divider')).toBe('ArticleDivider');
    expect(eventOf('pageBreak')).toBe('ArticlePageBreak');
    expect(eventOf('quote')).toBe('ArticleQuote');
    expect(eventOf('code')).toBe('ArticleCode');
  });

  it('leaves text styles, lists and object inserts to their own counts', () => {
    for (const id of ['text', 'h1', 'bullet', 'todo', 'image', 'drawing'])
      expect(eventOf(id)).toBeNull();
  });
});
