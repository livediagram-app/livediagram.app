// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import { articlesOf, layOutPages, pagesOf, type Tab } from '@livedocuments/document';
import { useArticleIntake } from './useArticleIntake';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => null,
  takeZoneReleased: () => false,
  forgetZonesReleased: vi.fn(),
}));

// docs/specs/007-editor/flashcards.md "Long stacks stay quick" and blueprints/article-pages.md "Zones", steps 5 and 6:
// a typing commit on a long stack does no work for the rest of it. Writing without zones leaves the intake nothing to
// settle, so it does not tick (no second render of the editor); writing with zones is fitted with the pages laid out
// once, so a settle grows with the stack, not with its square.

type Block = Record<string, unknown>;
const card = (i: number, zone: boolean): Block[] => [
  { id: `t${i}`, type: 'paragraph', style: 'title', runs: [{ text: `Card ${i}` }] },
  { id: `p${i}`, type: 'paragraph', runs: [{ text: `What card ${i} says.` }] },
  ...(zone
    ? [
        {
          id: `z${i}`,
          type: 'zone',
          zone: 'drawing',
          width: 300,
          height: 120,
          at: { page: `c${i}`, x: 0, y: 120 },
        },
      ]
    : []),
];

function stack(n: number, zones: boolean): Tab {
  const articles: Record<string, { blocks: Block[]; style: { margins: string } }> = {};
  const pages = [];
  for (let i = 0; i < n; i++) {
    pages.push({
      id: `c${i}`,
      orientation: 'landscape',
      size: 'card',
      kind: 'flashcard',
      flow: `f${i}`,
    });
    articles[`f${i}`] = { blocks: card(i, zones), style: { margins: 'narrow' } };
  }
  return { id: 't', name: 'Tab', elements: [], pages, articles } as unknown as Tab;
}

// One typed change to the first card's writing, as a commit lands it.
function typed(tab: Tab): Tab {
  const articles = tab.articles as Record<string, { blocks: Block[] }>;
  const first = articles.f0!;
  const blocks = first.blocks.map((b) =>
    b.id === 'p0' ? { ...b, runs: [{ text: 'What card 0 says, and more.' }] } : b,
  );
  return { ...tab, articles: { ...articles, f0: { ...first, blocks } } } as unknown as Tab;
}

function commit(before: Tab) {
  const after = typed(before);
  const seq = { current: 0 };
  const tickTabs = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ tab }: { tab: Tab }) =>
      useArticleIntake({
        activeTab: tab,
        on: true,
        editable: true,
        pages: layOutPages(pagesOf(tab)),
        localEditSeq: seq,
        tickTabs,
      }),
    { initialProps: { tab: before } },
  );
  seq.current = 1;
  rerender({ tab: after });
  unmount();
  return { tickTabs, after };
}

describe('a typing commit on a long stack', () => {
  it('ticks nothing when no card holds a zone', () => {
    const { tickTabs } = commit(stack(100, false));
    expect(tickTabs).not.toHaveBeenCalled();
  });

  it('fits zones when cards hold them, the same tab back when they already fit', () => {
    const { tickTabs, after } = commit(stack(20, true));
    expect(tickTabs).toHaveBeenCalledTimes(1);
    const update = tickTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
    const out = update([after]);
    expect(Object.keys(articlesOf(out[0]))).toHaveLength(20);
    // Settled again, it is settled: the same tabs back.
    expect(update(out)).toBe(out);
  });

  it('settles a stack with zones in time that grows with it, not with its square', () => {
    const settle = (n: number) => {
      const { tickTabs, after } = commit(stack(n, true));
      const update = tickTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
      return () => cpuMsOf(() => update([after]));
    };
    const small = settle(10);
    const large = settle(100);
    // 10x the cards (a stack holds at most MAX_PAGES, 100): linear work is about 10x; laying every page out once a
    // card was about 100x.
    const ceiling = cpuRatioCeiling(30);
    expect(cpuGrowthRatio(small, large, { ceiling })).toBeLessThan(ceiling);
  });
});
