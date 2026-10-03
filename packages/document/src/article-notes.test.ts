import { describe, expect, it } from 'vitest';
import {
  ARTICLE_NOTE_GAP,
  ARTICLE_NOTE_SIZE,
  articleNoteCorner,
  newArticleNote,
  withNoteMarksRemoved,
  withNotesSettled,
} from './article-notes';
import { layOutIllustratePages, type IllustratePage } from './illustrate-page';
import type { ArticleBlock } from './article-flow';

const pages: IllustratePage[] = [
  { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'f' },
  { id: 'a2', orientation: 'portrait', kind: 'article', flow: 'f' },
];
const laid = layOutIllustratePages(pages);
const blocks: ArticleBlock[] = [
  { id: 'b', type: 'paragraph', runs: [{ text: 'The ' }, { text: 'budget', note: 'n1' }] },
];

describe('margin notes', () => {
  it('centres a marker in the right margin, level with its line', () => {
    const page = laid[0]!;
    const at = articleNoteCorner(page, 96, { y: 200, height: 24 });
    expect(at.x).toBe(Math.round(page.rect.x + page.rect.width - 48 - ARTICLE_NOTE_SIZE / 2));
    expect(at.y).toBe(Math.round(page.rect.y + 212 - ARTICLE_NOTE_SIZE / 2));
  });

  it('moves a marker to its text, onto the next page too, and leaves the tab when still', () => {
    const marker = newArticleNote('n1', 'comment', { x: 0, y: 0 });
    const tab = { elements: [marker], pages, articles: { f: { blocks } } };
    const moved = withNotesSettled(tab, 'f', [{ id: 'n1', index: 1, y: 300, height: 20 }]);
    const m = moved.elements[0] as typeof marker;
    expect(m.x).toBe(articleNoteCorner(laid[1]!, 96, { y: 300, height: 20 }).x);
    expect(withNotesSettled(moved, 'f', [{ id: 'n1', index: 1, y: 300, height: 20 }])).toBe(moved);
  });

  it('stacks notes on one line down the margin instead of over each other', () => {
    const a = newArticleNote('n1', 'comment', { x: 0, y: 0 });
    const c = newArticleNote('n2', 'action', { x: 0, y: 0 });
    const tab = { elements: [a, c], pages, articles: { f: { blocks } } };
    const out = withNotesSettled(tab, 'f', [
      { id: 'n1', index: 0, y: 200, height: 20 },
      { id: 'n2', index: 0, y: 200, height: 20 },
    ]);
    const [m1, m2] = out.elements as (typeof a)[];
    expect(m2!.y - m1!.y).toBe(ARTICLE_NOTE_SIZE + ARTICLE_NOTE_GAP);
    expect(m2!.x).toBe(m1!.x);
  });

  it('untints the text of a marker that was deleted', () => {
    const tab = { elements: [], pages, articles: { f: { blocks } } };
    const out = withNoteMarksRemoved(tab, new Set(['n1']));
    const b = (out.articles as { f: { blocks: ArticleBlock[] } }).f.blocks[0]!;
    expect('runs' in b && b.runs).toEqual([{ text: 'The budget' }]);
    expect(withNoteMarksRemoved(tab, new Set(['other']))).toBe(tab);
  });
});
