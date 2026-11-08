import { afterEach, describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  layOutPages,
  type ArticleDrawOp,
  type LaidOutPage,
  type Page,
} from '@livedocuments/document';
import { pageWritingBars } from './article-export';
import { registerArticleHandle, type ArticleEditorHandle } from './article-editor-store';
import { sameBars, writingBarsByPage } from './page-writing-bars';

// docs/specs/008-canvas/canvas-performance.md "Pictures of every page": every page's bars in one pass, exactly as
// pageWritingBars gives them page by page.

type Rect = Extract<ArticleDrawOp, { k: 'rect' }>;

const article = (n: number, flow = 'f'): LaidOutPage[] =>
  layOutPages(
    Array.from({ length: n }, (_, i): Page => ({
      id: `p${i}`,
      orientation: 'portrait',
      kind: 'article',
      flow,
    })),
  );

// Bars down every page of `pages`, `perPage` each, plus some at and past the edges.
function barsOver(pages: readonly LaidOutPage[], perPage: number): Rect[] {
  const out: Rect[] = [];
  for (const p of pages) {
    const r = p.rect;
    for (let i = 0; i < perPage; i++)
      out.push({
        k: 'rect',
        x: r.x + 60 + (i % 3),
        y: r.y + 40 + i * 18,
        w: 300,
        h: 8,
        fill: 'ink',
      });
    // On the edges (kept: within the 1 px slack), and in the gap after the page (kept by no page).
    out.push({ k: 'rect', x: r.x - 1, y: r.y - 1, w: 1, h: 1, fill: 'ink' });
    out.push({ k: 'rect', x: r.x + r.width, y: r.y + r.height, w: 1, h: 1, fill: 'ink' });
    out.push({ k: 'rect', x: r.x + r.width + 5, y: r.y + 10, w: 1, h: 1, fill: 'ink' });
  }
  return out;
}

let unregister: (() => void) | null = null;
afterEach(() => {
  unregister?.();
  unregister = null;
});

function mount(flow: string, bars: ArticleDrawOp[]) {
  unregister = registerArticleHandle({ flow, bars: () => bars } as unknown as ArticleEditorHandle);
}

describe('writingBarsByPage', () => {
  it('gives every page the bars pageWritingBars gives it, in order', () => {
    const pages = article(12);
    const bars: ArticleDrawOp[] = [
      ...barsOver(pages, 20),
      { k: 'text', x: pages[0]!.rect.x + 10, y: pages[0]!.rect.y + 10 } as ArticleDrawOp,
    ];
    mount('f', bars);
    const all = writingBarsByPage(pages, 'ink');
    for (const page of pages) expect(all.get(page.id)).toEqual(pageWritingBars(page, 'ink'));
  });

  it('leaves out pages that are not an article’s, and draws an unmounted article from its estimate', () => {
    const pages = layOutPages([
      { id: 'a', orientation: 'portrait' },
      { id: 'b', orientation: 'portrait', kind: 'article', flow: 'gone' },
    ]);
    const all = writingBarsByPage(pages);
    expect(all.has('a')).toBe(false);
    expect(all.get('b')).toEqual(pageWritingBars(pages[1]!));
  });

  it(`sorts 100 pages of 60 lines each inside ${cpuBudgetMs(15)} ms`, () => {
    const pages = article(100);
    mount('f', barsOver(pages, 60));
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(() => void writingBarsByPage(pages))));
    expect(best).toBeLessThan(cpuBudgetMs(15));
  });
});

describe('sameBars', () => {
  const bar = (x: number): ArticleDrawOp => ({ k: 'rect', x, y: 1, w: 2, h: 3, fill: 'ink' });
  it('is true for the same bars, even as new objects', () => {
    const a = [bar(1), bar(2)];
    expect(sameBars(a, a)).toBe(true);
    expect(sameBars(a, [bar(1), bar(2)])).toBe(true);
  });
  it('is false when a bar moved, one was added, or an op is not a bar', () => {
    expect(sameBars([bar(1)], [bar(2)])).toBe(false);
    expect(sameBars([bar(1)], [bar(1), bar(2)])).toBe(false);
    const text = { k: 'text', x: 1, y: 1 } as ArticleDrawOp;
    expect(sameBars([text], [{ ...text }])).toBe(false);
  });
});
