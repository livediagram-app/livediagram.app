import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  articlesOf,
  MAX_PAGES,
  newFlashcardPage,
  pagesOf,
  type ArticleBlock,
  type ArticleFlow,
  type Tab,
} from '@livedocuments/document';
import { publishCardOverflow } from '@/lib/flashcard-overflow-store';
import { pageEdits } from './page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { track } from '@/lib/telemetry';

// docs/specs/007-editor/flashcards.md "Never flows": Split Onto a New Card from the card's menu
// and its Too long marker.
const p = (id: string, text: string, style?: 'title'): ArticleBlock => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: [{ text }],
});
const doc: ArticleFlow = {
  blocks: [p('t', 'Opening', 'title'), p('a', 'First'), p('b', 'Second')],
  style: { margins: 'narrow' },
};

const stack = (cards = 1, locked = false): Tab =>
  ({
    id: 't',
    name: 'T',
    elements: [],
    pages: Array.from({ length: cards }, (_, i) => ({
      ...newFlashcardPage(`c${i}`, `f${i}`),
      ...(i === 0 && locked ? { locked: true } : {}),
    })),
    articles: Object.fromEntries(Array.from({ length: cards }, (_, i) => [`f${i}`, doc])),
  }) as unknown as Tab;

function harness(tab: Tab) {
  let tabs = [tab];
  const onGoTo = vi.fn();
  const toastInfo = vi.fn();
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const edits = () =>
    pageEdits({
      tabId: tab.id,
      tab: tabs[0]!,
      current: pagesOf(tabs[0]),
      elements: tabs[0]!.elements,
      commitTabs,
      onGoTo,
      onLayoutPlaced: vi.fn(),
      toastInfo,
    });
  return { edits, tab: () => tabs[0]!, commitTabs, onGoTo, toastInfo };
}

afterEach(() => {
  publishCardOverflow('f0', null);
  vi.mocked(track).mockClear();
});

describe('Split Onto a New Card', () => {
  it('is not offered while the card fits', () => {
    const h = harness(stack());
    expect(h.edits().cardSplitState('c0')).toBe('fits');
    expect(h.edits().cardSplitState('gone')).toBe('fits');
    h.edits().splitCard('c0');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });

  it('moves the writing past the foot onto a new card after it, and goes there', () => {
    const h = harness(stack());
    publishCardOverflow('f0', 'b');
    expect(h.edits().cardSplitState('c0')).toBe('ready');
    h.edits().splitCard('c0');
    expect(h.commitTabs).toHaveBeenCalledOnce();
    const pages = pagesOf(h.tab());
    expect(pages).toHaveLength(2);
    expect(pages[1]!.kind).toBe('flashcard');
    expect(articlesOf(h.tab())['f0']!.blocks.map((b) => b.id)).toEqual(['t', 'a']);
    expect(h.onGoTo).toHaveBeenCalledWith(pages[1]!.id);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'FlashcardSplit');
  });

  it('says why when one paragraph fills the card', () => {
    const h = harness(stack());
    publishCardOverflow('f0', 'a');
    expect(h.edits().cardSplitState('c0')).toBe('one-paragraph');
    h.edits().splitCard('c0');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });

  it('says why at the page limit, and refuses the split there', () => {
    const h = harness(stack(MAX_PAGES));
    publishCardOverflow('f0', 'b');
    expect(h.edits().cardSplitState('c0')).toBe('page-limit');
    h.edits().splitCard('c0');
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(h.toastInfo).toHaveBeenCalledWith(expect.stringContaining(String(MAX_PAGES)));
  });

  it('leaves a locked card as it is', () => {
    const h = harness(stack(1, true));
    publishCardOverflow('f0', 'b');
    h.edits().splitCard('c0');
    expect(pagesOf(h.tab())).toHaveLength(1);
  });
});
