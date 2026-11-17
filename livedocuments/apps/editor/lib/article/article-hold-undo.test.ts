// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { articlesOf, type ArticleBlock, type Tab } from '@livedocuments/document';
import { keepHeldWriting, type HeldIn } from './article-hold-undo';
import {
  peerHeldBlocks,
  receiveArticleHold,
  resetArticleHoldsForTests,
} from './article-holds-store';
import { useDocumentHistory } from '@/hooks/canvas/useDocumentHistory';

// docs/specs/007-editor/article-pages.md "Holding a paragraph", "Undo and redo" (Work Tracker 977): an undo or redo
// never writes over a block someone else is writing in; the rest of the step undoes as usual.

const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});
const tabWith = (blocks: ArticleBlock[], id = 't'): Tab => ({
  id,
  name: id,
  elements: [],
  articles: { f: { blocks } },
});
const bare: Tab = { id: 't', name: 't', elements: [] };
const textsOf = (tab: Tab | undefined, flow = 'f') =>
  articlesOf(tab)[flow]?.blocks.map((b) =>
    'runs' in b ? b.runs.map((r) => r.text).join('') : b.id,
  );
const holding =
  (...ids: string[]): HeldIn =>
  (tabId, flow) =>
    tabId === 't' && flow === 'f' ? new Set(ids) : new Set();

afterEach(() => resetArticleHoldsForTests());

describe('keepHeldWriting', () => {
  it('keeps a held paragraph as its writer has it and undoes the rest', () => {
    const now = [tabWith([para('a', 'Mine, changed'), para('b', 'Sam typing here')])];
    const onto = [tabWith([para('a', 'Mine'), para('b', 'Sam')])];
    const kept = keepHeldWriting(now, onto, holding('b'));
    expect(textsOf(kept[0])).toEqual(['Mine', 'Sam typing here']);
    // The step itself is untouched: a later redo still has it.
    expect(textsOf(onto[0])).toEqual(['Mine', 'Sam']);
  });

  it('puts a held paragraph the step would take away back after the block before it', () => {
    const now = [tabWith([para('a', 'One'), para('b', 'Sam typing'), para('c', 'Three')])];
    expect(
      textsOf(
        keepHeldWriting(now, [tabWith([para('a', 'One'), para('c', 'Three')])], holding('b'))[0],
      ),
    ).toEqual(['One', 'Sam typing', 'Three']);
    // With no block before it left, it goes first.
    const first = [tabWith([para('b', 'Sam typing'), para('c', 'Three')])];
    expect(
      textsOf(keepHeldWriting(first, [tabWith([para('c', 'Three')])], holding('b'))[0]),
    ).toEqual(['Sam typing', 'Three']);
    // The nearest kept block before it, past one the step also took away.
    const deep = [tabWith([para('a', 'One'), para('x', 'Gone'), para('b', 'Sam typing')])];
    expect(textsOf(keepHeldWriting(deep, [tabWith([para('a', 'One')])], holding('b'))[0])).toEqual([
      'One',
      'Sam typing',
    ]);
  });

  it('hands back the very tabs when nothing held would change', () => {
    const now = [tabWith([para('a', 'Mine, changed'), para('b', 'Sam')]), tabWith([], 'u')];
    const onto = [tabWith([para('a', 'Mine'), para('b', 'Sam')]), tabWith([], 'u')];
    expect(keepHeldWriting(now, onto, holding('b'))).toBe(onto);
    expect(keepHeldWriting(now, onto, holding())).toBe(onto);
    // A hold on a block neither side has.
    expect(keepHeldWriting(now, onto, holding('zz'))).toBe(onto);
  });

  it('leaves an article the step takes away gone, and a tab only the step has as it is', () => {
    const now = [tabWith([para('b', 'Sam typing')])];
    const noArticle = [bare];
    expect(keepHeldWriting(now, noArticle, holding('b'))).toBe(noArticle);
    const newTab = [tabWith([para('b', 'Old')], 'v')];
    expect(keepHeldWriting(now, newTab, holding('b'))).toBe(newTab);
    // An article the present lacks (the step brings it back) has nothing held to keep.
    const back = [tabWith([para('b', 'Old')], 't')];
    expect(keepHeldWriting([bare], back, holding('b'))).toBe(back);
  });

  it("keeps the article's look and the tab's other articles", () => {
    const now = [
      {
        id: 't',
        name: 't',
        elements: [],
        articles: { f: { blocks: [para('b', 'Sam typing')] }, g: { blocks: [para('c', 'New')] } },
      } as unknown as Tab,
    ];
    const onto = [
      {
        id: 't',
        name: 't',
        elements: [],
        articles: {
          f: { blocks: [para('b', 'Sam')], style: { look: 'classic' } },
          g: { blocks: [para('c', 'Old')] },
        },
      } as unknown as Tab,
    ];
    const kept = keepHeldWriting(now, onto, holding('b'));
    expect(textsOf(kept[0])).toEqual(['Sam typing']);
    expect(articlesOf(kept[0]).f?.style).toEqual(onto[0] && articlesOf(onto[0]).f?.style);
    expect(textsOf(kept[0], 'g')).toEqual(['Old']);
  });
});

describe('peerHeldBlocks', () => {
  it("answers the blocks collaborators hold in one article on one tab, a cell's table among them", () => {
    expect(peerHeldBlocks('t', 'f').size).toBe(0);
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' });
    receiveArticleHold('zed', { tabId: 't', flow: 'f', blockId: 'tbl', row: 'r', col: 'c' });
    receiveArticleHold('kim', { tabId: 'u', flow: 'f', blockId: 'x' });
    expect([...peerHeldBlocks('t', 'f')].sort()).toEqual(['b', 'tbl']);
    expect(peerHeldBlocks('t', 'g').size).toBe(0);
  });
});

describe('an undo during a hold', () => {
  it("keeps another person's words in the paragraph they hold, and the redo still has its step", () => {
    const { result } = renderHook(() =>
      useDocumentHistory([tabWith([para('a', 'Mine'), para('b', 'Sam')])]),
    );
    // This person changes their paragraph; then Sam's typing in paragraph b arrives, and Sam holds it.
    act(() =>
      result.current.commit(() => [tabWith([para('a', 'Mine, changed'), para('b', 'Sam')])]),
    );
    act(() =>
      result.current.applyRemote(() => [
        tabWith([para('a', 'Mine, changed'), para('b', 'Sam typing here')]),
      ]),
    );
    act(() => receiveArticleHold('sam', { tabId: 't', flow: 'f', blockId: 'b' }));
    // A restore of the earlier state (the undo) puts back this person's paragraph, never Sam's.
    act(() => result.current.undo());
    expect(textsOf(result.current.tabs[0])).toEqual(['Mine', 'Sam typing here']);
    act(() => result.current.redo());
    expect(textsOf(result.current.tabs[0])).toEqual(['Mine, changed', 'Sam typing here']);
  });

  it('changes nothing with no step to take back', () => {
    const start = [tabWith([para('b', 'Old')])];
    const { result } = renderHook(() => useDocumentHistory(start));
    act(() => receiveArticleHold('sam', { tabId: 't', flow: 'f', blockId: 'b' }));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.tabs).toBe(start);
  });

  it('undoes the paragraph whole once nobody holds it', () => {
    const { result } = renderHook(() => useDocumentHistory([tabWith([para('b', 'Old')])]));
    act(() => result.current.commit(() => [tabWith([para('b', 'New')])]));
    act(() => result.current.undo());
    expect(textsOf(result.current.tabs[0])).toEqual(['Old']);
  });
});
