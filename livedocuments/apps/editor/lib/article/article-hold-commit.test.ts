import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArticleBlock } from '@livedocuments/document';
import { heldBackBlocks } from './article-hold-commit';
import {
  announceArticleHeld,
  articleHeldNotice,
  resetArticleHeldNoticeForTests,
  setArticleHeldToast,
} from './article-hold-notice';

// docs/specs/007-editor/article-pages.md "Holding a paragraph": a claim the room has not answered commits its
// block as it was, and a refused one puts it back; typing into a held paragraph says who holds it, once a while.

const p = (id: string, text: string): ArticleBlock => ({ id, type: 'paragraph', runs: [{ text }] });
const a = p('a', 'one');
const b = p('b', 'two');
const committed = [a, b];

describe('a block held back from a commit', () => {
  it('commits as it was while unanswered; the rest goes', () => {
    const typedB = p('b', 'two more');
    const typedA = p('a', 'one more');
    expect(heldBackBlocks([a, typedB], committed, 'b')).toBe(committed);
    expect(heldBackBlocks([typedA, typedB], committed, 'b')).toEqual([typedA, b]);
  });

  it('leaves the blocks alone with nothing pending, a new block, or the block unchanged', () => {
    const blocks = [a, p('b', 'x'), p('n', 'new')];
    expect(heldBackBlocks(blocks, committed, null)).toBe(blocks);
    expect(heldBackBlocks(blocks, committed, 'n')).toBe(blocks);
    expect(heldBackBlocks(committed, committed, 'b')).toBe(committed);
    expect(heldBackBlocks([a], committed, 'b')).toEqual([a]);
  });
});

describe('the held notice', () => {
  afterEach(() => resetArticleHeldNoticeForTests());

  it('names the writer, at most once in a stretch of refused keys', () => {
    const toast = vi.fn();
    setArticleHeldToast(toast);
    announceArticleHeld('Ann', 10_000);
    announceArticleHeld('Ann', 11_000);
    announceArticleHeld('Bob', 12_600);
    expect(toast.mock.calls).toEqual([[articleHeldNotice('Ann')], ['Bob is writing in this paragraph.']]);
    setArticleHeldToast(null);
    announceArticleHeld('Cy', 20_000);
    expect(toast).toHaveBeenCalledTimes(2);
  });
});
