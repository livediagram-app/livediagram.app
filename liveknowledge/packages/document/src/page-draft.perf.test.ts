import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  draftDiffers,
  printsOf,
  savedChangesUnderDraft,
  withDraftMade,
  withDraftSaved,
  type ArticleBlock,
  type Tab,
} from './index';

// docs/specs/030-knowledgebase/blueprints/editing.md "Performance and limits": making the draft and saving it on a
// 5,000 word page. 250 paragraphs of 20 words is 5,000 words.

const WORDS = 'the team keeps its runbooks here so anyone on call can find the steps fast and act';

function bigPage(): Tab {
  const blocks: ArticleBlock[] = [
    { id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Runbook' }] },
  ];
  for (let i = 0; i < 250; i++) {
    const text = `${WORDS} step ${i} done now`.split(' ').slice(0, 20).join(' ');
    blocks.push({ id: `b${i}`, type: 'paragraph', runs: [{ text }] });
  }
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

describe('a 5,000 word page', () => {
  it('makes its draft and saves it within budget', () => {
    const tab = bigPage();
    const writing = tab.articles!['art-1']!;
    const words = writing.blocks.reduce(
      (n, b) =>
        n +
        ('runs' in b
          ? b.runs
              .map((r) => r.text)
              .join('')
              .split(' ').length
          : 0),
      0,
    );
    expect(words).toBeGreaterThanOrEqual(5000);
    let drafted = tab;
    const make = cpuMsOf(() => {
      drafted = withDraftMade(tab, writing, 'Priya', 1);
    });
    const edited = {
      ...drafted,
      articles: {
        ...drafted.articles,
        draft: {
          blocks: writing.blocks.map((b, i) =>
            i === 100 ? ({ ...b, runs: [{ text: 'changed' }] } as ArticleBlock) : b,
          ),
        },
      },
    } as Tab;
    let out = edited;
    const save = cpuMsOf(() => {
      expect(draftDiffers(edited)).toBe(true);
      expect(savedChangesUnderDraft(edited)).toBe(0);
      out = withDraftSaved(edited);
    });
    expect(out.articles!['art-1']!.blocks[100]).toEqual({
      ...writing.blocks[100],
      runs: [{ text: 'changed' }],
    });
    // A cold print of every block, then a save: both well under a frame on a laptop.
    console.info(
      '[perf] 5,000 words: make draft',
      make.toFixed(2),
      'ms, save',
      save.toFixed(2),
      'ms',
    );
    expect(make).toBeLessThan(cpuBudgetMs(50));
    expect(save).toBeLessThan(cpuBudgetMs(50));
    expect(Object.keys(printsOf(writing))).toHaveLength(251);
  });
});
