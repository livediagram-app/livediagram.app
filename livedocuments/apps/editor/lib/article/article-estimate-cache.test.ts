import { afterEach, describe, expect, it } from 'vitest';
import {
  laidOutPagesOf,
  newFlashcardPage,
  type ArticleDrawOp,
  type Tab,
} from '@livedocuments/document';
import { estimatedBars, estimatedPageOps } from './article-estimate-cache';
import { pageWriting, pageWritingBars } from './article-export';
import { registerArticleHandle, type ArticleEditorHandle } from './article-editor-store';

// docs/specs/007-editor/flashcards.md "Long stacks stay quick": a card whose writing is not mounted is drawn from
// its estimated lines.
type Text = Extract<ArticleDrawOp, { k: 'text' }>;
type Rect = Extract<ArticleDrawOp, { k: 'rect' }>;
const card = (n: number) => ({
  blocks: [{ id: `h${n}`, type: 'paragraph', style: 'h1', runs: [{ text: `Card ${n}` }] }],
});
const stack = (count: number): Tab =>
  ({
    id: 't',
    name: 'Tab',
    elements: [],
    pages: Array.from({ length: count }, (_, i) => newFlashcardPage(`p${i}`, `f${i}`)),
    articles: Object.fromEntries(Array.from({ length: count }, (_, i) => [`f${i}`, card(i + 1)])),
  }) as unknown as Tab;

let unregister: (() => void) | null = null;
afterEach(() => {
  unregister?.();
  unregister = null;
});

describe('an unmounted card', () => {
  it('is set from the estimate, its text on its own page', () => {
    const tab = stack(3);
    const page = laidOutPagesOf(tab)[2]!;
    const texts = (estimatedPageOps(tab, page) ?? []).filter((o): o is Text => o.k === 'text');
    expect(texts.map((o) => o.text)).toEqual(['Card 3']);
    expect(texts[0]!.x).toBeGreaterThan(page.rect.x);
  });

  it('is estimated again only when its writing, place or theme changes', () => {
    const tab = stack(2);
    const page = laidOutPagesOf(tab)[0]!;
    const first = estimatedPageOps(tab, page);
    expect(estimatedPageOps(tab, page)).toBe(first);
    expect(estimatedPageOps({ ...tab, theme: 'ocean' }, page)).not.toBe(first);
    const moved = { ...page, rect: { ...page.rect, x: page.rect.x + 10 } };
    expect(estimatedPageOps(tab, moved, [moved])![0]).not.toEqual(first![0]);
  });

  it('reads its writing off what holds the articles, the page alone without a tab', () => {
    const tab = stack(2);
    const page = laidOutPagesOf(tab)[1]!;
    expect(estimatedPageOps({ articles: tab.articles }, page)?.length).toBeGreaterThan(0);
    expect(estimatedPageOps({ articles: tab.articles }, page, [page])?.length).toBeGreaterThan(0);
  });

  it('has nothing to draw without a flow or its writing', () => {
    const tab = stack(1);
    const page = laidOutPagesOf(tab)[0]!;
    expect(estimatedPageOps(tab, { ...page, flow: undefined })).toBeUndefined();
    expect(estimatedPageOps(tab, { ...page, flow: 'gone' })).toBeUndefined();
    expect(estimatedPageOps({}, page)).toBeUndefined();
    expect(estimatedPageOps({ articles: 'x' }, page)).toBeUndefined();
  });

  it('draws one bar a line, as wide as its text, placed by its anchor', () => {
    const text = (extra: object) =>
      ({
        k: 'text',
        x: 100,
        y: 50,
        text: 'abcd',
        family: 'x',
        size: 10,
        weight: '400',
        style: 'normal',
        color: '#000',
        ...extra,
      }) as ArticleDrawOp;
    const bars = estimatedBars(
      [
        text({}),
        text({ weight: '700' }),
        text({ anchor: 'end' }),
        text({ anchor: 'middle' }),
        text({ text: '  ' }),
        { k: 'rect', x: 0, y: 0, w: 1, h: 1, fill: '#000' },
      ],
      'ink',
    ) as Rect[];
    expect(bars).toHaveLength(4);
    expect(bars[0]).toMatchObject({ k: 'rect', x: 100, fill: 'ink' });
    expect(bars[1]!.w).toBeGreaterThan(bars[0]!.w);
    expect(bars[2]!.x).toBeCloseTo(100 - bars[0]!.w);
    expect(bars[3]!.x).toBeCloseTo(100 - bars[0]!.w / 2);
  });

  it('gives a thumbnail its bars and an export its words', () => {
    const tab = stack(2);
    const page = laidOutPagesOf(tab)[1]!;
    expect(pageWritingBars(page)).toHaveLength(0);
    expect(pageWritingBars(page, 'ink', tab).length).toBeGreaterThan(0);
    const ops = pageWriting(tab, page)?.ops ?? [];
    expect(ops.some((o) => o.k === 'text' && o.text === 'Card 2')).toBe(true);
  });

  it('is drawn from its editor while that is mounted', () => {
    const tab = stack(1);
    const page = laidOutPagesOf(tab)[0]!;
    const bar = { k: 'rect', x: 1, y: 1, w: 1, h: 1, fill: 'ink' } as ArticleDrawOp;
    unregister = registerArticleHandle({
      flow: 'f0',
      bars: () => [bar],
    } as unknown as ArticleEditorHandle);
    expect(pageWritingBars(page, 'ink', tab)).toContain(bar);
  });
});
