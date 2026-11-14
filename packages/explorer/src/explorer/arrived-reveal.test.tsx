// The arrived item past what a list view draws at first (liveworkspace/docs/specs/004-index/one-explorer.md "Opening
// from an open item"): each view loads further pages until the item is in the list, then brings it into its window,
// so it is drawn and marked. jsdom lays nothing out, so the windowed views are checked by where they ask to scroll.
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import type { Item } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { ToastProvider } from '../ui/Toasts';
import { ArrivedItemContext, ARRIVED_MAX_PAGES } from './arrived-item';
import { CardView, CARD_BATCH } from './CardView';
import { ExplorerProvider } from './context';
import { DetailsView } from './DetailsView';
import { ListView } from './ListView';
import { ROW_HEIGHT } from './rows';
import { SharedList } from './SharedList';

const many = (n: number): Item[] => Array.from({ length: n }, (_, i) => makeItem(i));
type Layout = 'list' | 'details' | 'shared' | 'card';

/** A view over `all`, loaded `page` items at a time, with `arrived` the door's item. */
function Paged({
  layout,
  all,
  page,
  onLoad,
}: {
  layout: Layout;
  all: Item[];
  page: number;
  onLoad?: () => void;
}) {
  const [shown, setShown] = useState(page);
  const props = {
    folders: [],
    items: all.slice(0, shown),
    options: { showApp: false, showFolder: false },
    hasMore: shown < all.length,
    loadingMore: false,
    onLoadMore: () => {
      onLoad?.();
      setShown((s) => s + page);
    },
    resetKey: 'reveal',
  };
  if (layout === 'card') return <CardView {...props} />;
  if (layout === 'details') return <DetailsView {...props} />;
  if (layout === 'shared') return <SharedList {...props} />;
  return <ListView {...props} />;
}

function mount(arrived: string, children: ReactNode) {
  const index = createFakeIndex();
  return render(
    <ToastProvider>
      <ExplorerProvider
        app="liveplanner"
        client={index.client}
        view={{ kind: 'all' }}
        filter="all"
        setFilter={vi.fn()}
        onNavigate={vi.fn()}
        itemHref={(i) => `/open/${i.id}`}
        onCreate={vi.fn()}
      >
        <ArrivedItemContext.Provider value={arrived}>{children}</ArrivedItemContext.Provider>
      </ExplorerProvider>
    </ToastProvider>,
  );
}

// Where each probe asked to be scrolled to: its `top` down the list.
let asked: string[] = [];
const scrollIntoView = vi.fn(function (this: HTMLElement) {
  asked.push(this.style.top);
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoView,
});
afterEach(() => {
  asked = [];
  scrollIntoView.mockClear();
});

const itemRow = (id: string) =>
  document.querySelector(`[data-item-row="${id}"],[data-item-card="${id}"]`);

describe('the arrived item in a long list', () => {
  it.each(['list', 'details', 'shared'] as const)(
    'the %s view brings the last of 30 rows into its window',
    async (layout) => {
      const all = many(30);
      const last = all[29]!;
      mount(last.id, <Paged layout={layout} all={all} page={30} />);
      await act(async () => {});
      // Not drawn at first: the window holds the first screenful.
      expect(itemRow(last.id)).toBeNull();
      expect(asked).toEqual([`${29 * ROW_HEIGHT}px`]);
    },
  );

  it.each(['list', 'details', 'shared', 'card'] as const)(
    'the %s view loads further pages until the item is in the list, then stops',
    async (layout) => {
      const all = many(30);
      const onLoad = vi.fn();
      mount(all[29]!.id, <Paged layout={layout} all={all} page={10} onLoad={onLoad} />);
      await act(async () => {});
      expect(onLoad).toHaveBeenCalledTimes(2);
    },
  );

  it('gives up after a few pages when the item never comes', async () => {
    const all = many(200);
    const onLoad = vi.fn();
    mount('not-here', <Paged layout="card" all={all} page={5} onLoad={onLoad} />);
    await act(async () => {});
    expect(onLoad).toHaveBeenCalledTimes(ARRIVED_MAX_PAGES);
  });

  it('the card view reveals the batch that holds the item, so it is drawn', async () => {
    const all = many(CARD_BATCH + 10);
    const last = all[all.length - 1]!;
    mount(last.id, <Paged layout="card" all={all} page={all.length} />);
    await act(async () => {});
    expect(itemRow(last.id)).not.toBeNull();
  });

  it('asks nothing of a list with no arrived item', async () => {
    const onLoad = vi.fn();
    render(
      <ToastProvider>
        <ExplorerProvider
          app="liveplanner"
          client={createFakeIndex().client}
          view={{ kind: 'all' }}
          filter="all"
          setFilter={vi.fn()}
          onNavigate={vi.fn()}
          itemHref={(i) => `/open/${i.id}`}
          onCreate={vi.fn()}
        >
          <Paged layout="list" all={many(300)} page={100} onLoad={onLoad} />
        </ExplorerProvider>
      </ToastProvider>,
    );
    await act(async () => {});
    expect(onLoad).not.toHaveBeenCalled();
    expect(asked).toEqual([]);
  });
});
