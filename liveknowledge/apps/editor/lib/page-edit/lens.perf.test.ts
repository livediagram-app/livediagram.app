import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  withDraftMade,
  type ArticleBlock,
  type ArticleFlow,
  type Tab,
} from '@liveknowledge/document';
import { liftTabs, lowerTabs, pageEditLens, pageReadLens } from './lens';

// docs/specs/030-knowledgebase/blueprints/editing.md "Performance and limits": on a 5,000 word page, entering edit
// mode costs nothing, a keystroke's commit through the lens is two spreads, and reading adds no work per commit.

function bigPage(): Tab {
  const blocks: ArticleBlock[] = [];
  for (let i = 0; i < 250; i++)
    blocks.push({
      id: `b${i}`,
      type: 'paragraph',
      runs: [{ text: Array.from({ length: 20 }, (_, w) => `word${w}`).join(' ') }],
    });
  return {
    id: 't1',
    name: 'Runbook',
    elements: [],
    pages: [
      {
        id: 'p',
        orientation: 'portrait',
        kind: 'article',
        flow: 'art-1',
        size: 'fit',
        fit: { width: 856, height: 9000 },
      },
    ],
    articles: { 'art-1': { blocks } },
  };
}

const typed = (t: Tab, i: number): Tab => {
  const flow = t.articles!['art-1'] as ArticleFlow;
  const blocks = flow.blocks.slice();
  blocks[0] = { ...blocks[0]!, runs: [{ text: `typed ${i}` }] } as ArticleBlock;
  return { ...t, articles: { ...t.articles, 'art-1': { blocks } } };
};

describe('the lens on a 5,000 word page', () => {
  it('enters edit mode and writes a hundred commits within budget', () => {
    const real = bigPage();
    const enter = cpuMsOf(() => {
      expect(pageEditLens(real)).toBe(real);
    });
    let ts = [real];
    const writer = { by: 'Priya', now: () => 1 };
    const commits = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) {
        const lifted = liftTabs(ts, 't1');
        ts = lowerTabs(
          ts,
          lifted,
          lifted.map((t) => typed(t, i)),
          't1',
          writer,
        );
      }
    });
    console.info('[perf] lens', {
      enterMs: enter.toFixed(3),
      hundredCommitsMs: commits.toFixed(2),
    });
    expect(enter).toBeLessThan(cpuBudgetMs(5));
    expect(commits).toBeLessThan(cpuBudgetMs(100));
  });

  it('reads with one cached lens per stored tab', () => {
    const tab = withDraftMade(bigPage(), { blocks: [] }, 'Priya', 1);
    const first = pageReadLens(tab, true);
    const again = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) expect(pageReadLens(tab, true)).toBe(first);
    });
    expect(again).toBeLessThan(cpuBudgetMs(20));
  });
});
