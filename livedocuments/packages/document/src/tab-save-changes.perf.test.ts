import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { MAX_ARTICLE_BLOCKS, type ArticleBlock } from './article-flow';
import type { Tab } from './index';
import { mergeSaveOverStored, tabSaveChanges } from './tab-save-changes';

// Every autosave of an article tab works out its changes, and the api merges them on every save
// (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged with the stored tab"): both stay cheap on
// the largest article a tab holds, with one paragraph typed in.
const article = (edited: string): Tab => ({
  id: 't1',
  name: 'Brief',
  elements: [],
  pages: [{ id: 'p1', orientation: 'portrait', kind: 'article', flow: 'f1' }],
  articles: {
    f1: {
      blocks: Array.from({ length: MAX_ARTICLE_BLOCKS }, (_, i): ArticleBlock => ({
        id: `b-${String(i).padStart(8, '0')}`,
        type: 'paragraph',
        runs: [{ text: i === 2_500 ? edited : `Paragraph ${i} of the brief, as written.` }],
      })),
    },
  },
});

describe('the cost of a save merged by id', () => {
  // The api's side: the stored tab and the saved one are separate copies, read from JSON, so both articles are read
  // in full before the one step applies.
  it('merges one typed paragraph of the largest article over the stored one within budget', () => {
    const before = article('Before');
    const after = article('After');
    const changes = tabSaveChanges(before, after);
    const [stored, saved] = [article('Before'), article('After')];
    let merged: Tab | undefined;
    const ms = cpuMsOf(() => {
      merged = mergeSaveOverStored(stored, saved, changes);
    });
    expect(merged!.articles!.f1!.blocks[2_500]).toEqual(after.articles!.f1!.blocks[2_500]);
    // Measured at 16 ms CPU locally, nearly all of it reading the two articles defensively (articlesOf).
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });

  // The editor's side: an edit keeps every block it did not touch the same object, so the diff skips them by identity.
  it('works out the changes of an editor save, which shares its untouched blocks, within budget', () => {
    const before = article('Before');
    const blocks = [...before.articles!.f1!.blocks];
    blocks[2_500] = { id: blocks[2_500]!.id, type: 'paragraph', runs: [{ text: 'After' }] };
    const after: Tab = { ...before, articles: { f1: { blocks } } };
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) tabSaveChanges(before, after);
    });
    expect(tabSaveChanges(before, after).articles).toEqual({
      f1: [{ kind: 'put', id: 'b-00002500' }],
    });
    // Measured at 7 ms CPU a save locally, most of it reading the new article (which the broadcast has read already
    // in the editor, articlesOf's cache).
    expect(ms / 10).toBeLessThan(cpuBudgetMs(40));
  });
});
