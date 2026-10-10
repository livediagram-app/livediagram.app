// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createShape,
  illustratePagesOf,
  layOutIllustratePages,
  type ArticleBlock,
  type Tab,
} from '@livediagram/document';
import { useArticleIntake } from './useArticleIntake';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const handle = vi.hoisted(() => ({ insertZone: vi.fn(), moveZone: vi.fn() }));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => handle,
  takeZoneReleased: () => false,
  forgetZonesReleased: vi.fn(),
}));

// docs/specs/007-editor/illustrate-pages.md "Locking a page": an element dropped on an unlocked
// page of an article with a locked page stays where it is, a loose element; the article's writing
// takes nothing in.
const blocks: ArticleBlock[] = [{ id: 'p', type: 'paragraph', runs: [{ text: 'Hello' }] }];
const base = (locked: boolean): Tab =>
  ({
    id: 't',
    name: 'Tab',
    elements: [],
    pages: [
      { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'a' },
      {
        id: 'a2',
        orientation: 'portrait',
        kind: 'article',
        flow: 'a',
        ...(locked ? { locked: true } : {}),
      },
    ],
    articles: { a: { blocks } },
  }) as unknown as Tab;

function dropOnFirstPage(locked: boolean) {
  handle.insertZone.mockReset();
  const before = base(locked);
  const pages = layOutIllustratePages(illustratePagesOf(before));
  const first = pages[0]!.rect;
  const shape = createShape('square', first.x + first.width / 2 - 40, first.y + 300);
  const after = { ...before, elements: [shape] } as Tab;
  const seq = { current: 0 };
  const tickTabs = vi.fn();
  const { rerender } = renderHook(
    ({ tab }: { tab: Tab }) =>
      useArticleIntake({
        activeTab: tab,
        on: true,
        editable: true,
        pages,
        localEditSeq: seq,
        tickTabs,
      }),
    { initialProps: { tab: before } },
  );
  seq.current = 1;
  rerender({ tab: after });
  return { tickTabs, after };
}

describe('intake into a locked article', () => {
  it('takes a dropped element into an unlocked article', () => {
    dropOnFirstPage(false);
    expect(handle.insertZone).toHaveBeenCalledTimes(1);
  });

  it('leaves it loose when any page of the article is locked', () => {
    const { tickTabs, after } = dropOnFirstPage(true);
    expect(handle.insertZone).not.toHaveBeenCalled();
    // The settle changes nothing of the held article.
    const update = tickTabs.mock.calls[0]?.[0] as ((ts: Tab[]) => Tab[]) | undefined;
    if (update) expect(update([after])[0]).toBe(after);
  });
});
