import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { ArticlesView } from '@/hooks/editor/useArticles';
import { presentedPages } from './presented-pages';

// docs/specs/007-editor/illustrate-pages.md "Slides": a presenting page slide shows its page alone.
const tab = {
  id: 't',
  name: 'T',
  elements: [],
  pages: [
    { id: 'a', orientation: 'portrait' },
    { id: 'b', orientation: 'landscape' },
  ],
} as unknown as Tab;

describe('presentedPages', () => {
  it('passes the view through when no page slide presents', () => {
    expect(presentedPages(null, tab, null)).toBeNull();
  });

  it('builds the presented sheet from the tab outside Illustrate mode', () => {
    const view = presentedPages(null, tab, 'b')!;
    expect(view.pages.map((p) => p.id)).toEqual(['b']);
    expect(view.edit).toBeUndefined();
  });

  it('outside Illustrate, presents an article page with its writing, read only', () => {
    const articles = { editable: true, flows: { f: { blocks: [] } } } as unknown as ArticlesView;
    const withArticle = {
      ...tab,
      pages: [
        { id: 'a', orientation: 'portrait' },
        { id: 'c', orientation: 'portrait', kind: 'article', flow: 'f' },
      ],
    } as unknown as Tab;
    const view = presentedPages(null, withArticle, 'c', articles)!;
    expect(view.pages.map((p) => p.id)).toEqual(['c']);
    expect(view.rowPages?.map((p) => p.id)).toEqual(['a', 'c']);
    expect(view.articles?.editable).toBe(false);
    expect(view.articles?.flows).toBe(articles.flows);
  });
});
