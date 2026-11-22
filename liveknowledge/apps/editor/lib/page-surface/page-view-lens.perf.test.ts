import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { ArticleBlock, ArticleFlow, Element, Tab } from '@liveknowledge/document';
import { liftViewTabs, lowerViewTabs, pageViewLens } from './page-view-lens';

// docs/specs/030-knowledgebase/blueprints/page-surface.md "The narrow view" "Costs": the lens is worked out once per
// stored tab and view; a keystroke's commit through it on a long page with many pictures stays inside its budget.

function bigPage(): Tab {
  const blocks: ArticleBlock[] = [];
  const elements: Element[] = [];
  for (let i = 0; i < 2000; i++) {
    if (i % 40 === 0) {
      const y = 100 + i * 30;
      blocks.push({
        id: `z${i}`,
        type: 'zone',
        zone: 'object',
        width: 760,
        height: 300,
        at: { page: 'p', x: 48, y },
      });
      for (let k = 0; k < 10; k++)
        elements.push({
          id: `e${i}-${k}`,
          type: 'image',
          x: -380 + k * 70,
          y: y + 10,
          width: 60,
          height: 60,
        } as Element);
    } else
      blocks.push({
        id: `b${i}`,
        type: 'paragraph',
        runs: [{ text: Array.from({ length: 20 }, (_, w) => `word${w}`).join(' ') }],
      });
  }
  return {
    id: 't1',
    name: 'Runbook',
    elements,
    pages: [
      {
        id: 'p',
        orientation: 'portrait',
        kind: 'article',
        flow: 'art-1',
        size: 'fit',
        fit: { width: 856, height: 70000 },
      },
    ],
    articles: { 'art-1': { blocks } },
  };
}

const typed = (t: Tab, i: number): Tab => {
  const flow = t.articles!['art-1'] as ArticleFlow;
  const blocks = flow.blocks.slice();
  blocks[1] = { ...blocks[1]!, runs: [{ text: `typed ${i}` }] } as ArticleBlock;
  return { ...t, articles: { ...t.articles, 'art-1': { blocks } } };
};

describe('the narrow view on a 2,000 block page with 500 pictures', () => {
  it('draws once per stored tab and lowers a hundred commits within budget', () => {
    const real = bigPage();
    const view = { room: 350, layouts: new Map() };
    let lens: Tab = real;
    const draw = cpuMsOf(() => {
      lens = pageViewLens(real, view.room);
    });
    expect(lens).not.toBe(real);
    const again = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) expect(pageViewLens(real, view.room)).toBe(lens);
    });
    let ts = [real];
    const commits = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) {
        const lifted = liftViewTabs(ts, 't1', view);
        ts = lowerViewTabs(
          ts,
          lifted,
          lifted.map((t) => typed(t, i)),
          't1',
        );
      }
    });
    // Every picture is back where it is stored.
    expect(ts[0]!.elements).toBe(real.elements);
    console.info('[perf] page view lens', {
      drawMs: draw.toFixed(2),
      thousandCachedMs: again.toFixed(2),
      hundredCommitsMs: commits.toFixed(2),
    });
    expect(draw).toBeLessThan(cpuBudgetMs(30));
    expect(again).toBeLessThan(cpuBudgetMs(20));
    expect(commits).toBeLessThan(cpuBudgetMs(1500));
  });
});
