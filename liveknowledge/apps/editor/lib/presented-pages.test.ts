import { describe, expect, it } from 'vitest';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { ArticlesView } from '@/hooks/editor/useArticles';
import { presentedPages } from './presented-pages';

// docs/specs/007-editor/pages-mode.md "Slides": a presenting page slide shows its page alone.
const articles = { editable: true, flows: { f: { blocks: [] } } } as unknown as ArticlesView;
const view = {
  pages: [
    { id: 'a', orientation: 'portrait' },
    { id: 'c', orientation: 'portrait', kind: 'article', flow: 'f' },
  ],
  articles,
} as unknown as PagesModeView;

describe('presentedPages', () => {
  it('passes the view through when no page slide presents', () => {
    expect(presentedPages(view, null)).toBe(view);
  });

  it('narrows the view to the presented page, its writing read only', () => {
    const shown = presentedPages(view, 'c');
    expect(shown.pages.map((p) => p.id)).toEqual(['c']);
    expect(shown.rowPages?.map((p) => p.id)).toEqual(['a', 'c']);
    // The surround is blacked out round the presented sheet.
    expect(shown.letterbox).toBe(true);
    expect(shown.articles?.editable).toBe(false);
    expect(shown.articles?.flows).toBe(articles.flows);
  });
});
