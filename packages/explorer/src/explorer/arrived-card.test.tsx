// The arrived item in the card grid when its window measures late (liveworkspace/docs/specs/004-index/one-explorer.md
// "Opening from an open item"): before it measures the window draws every card, the item among them, then it measures
// and keeps only the first rows. The item must still end up drawn and ringed: the view scrolls to its row once the
// window has measured, and the mark goes on the card the window draws there. jsdom lays nothing out, so the window is
// played by hand.
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSyncExternalStore } from 'react';
import type { Item } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { ToastProvider } from '../ui/Toasts';
import type { CardWindow } from './useCardWindow';

const N = 30;
const unmeasured: CardWindow = {
  shared: 0,
  start: 0,
  end: N,
  rowsBefore: 0,
  rowsAfter: 0,
  pitch: 0,
  gap: 0,
  cols: 0,
};
// Three across, 300px a row: the first three rows, then (scrolled to row 9) the last rows.
const firstRows: CardWindow = {
  shared: 0,
  start: 0,
  end: 9,
  rowsBefore: 0,
  rowsAfter: 7,
  pitch: 300,
  gap: 16,
  cols: 3,
};
const lastRows: CardWindow = { ...firstRows, start: 21, end: 30, rowsBefore: 7, rowsAfter: 0 };

let current = unmeasured;
const listeners = new Set<() => void>();
const setWindow = (next: CardWindow) => {
  current = next;
  for (const l of listeners) l();
};
vi.mock('./useCardWindow', () => ({
  useCardWindow: () =>
    useSyncExternalStore(
      (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      () => current,
    ),
}));

const { CardView } = await import('./CardView');
const { ExplorerProvider } = await import('./context');
const { ArrivedItemContext, useArrivedItem } = await import('./arrived-item');

function Mark({ id }: { id: string }) {
  useArrivedItem(id);
  return null;
}

// Where the view asked to scroll, as the probe's `top`; scrolling to row 9 moves the window there.
let asked: string[] = [];
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: function (this: HTMLElement) {
    if (this.style.top) {
      asked.push(this.style.top);
      queueMicrotask(() => setWindow(lastRows));
    }
  },
});
afterEach(() => {
  asked = [];
  current = unmeasured;
});

describe('the arrived item in a card grid that measures late', () => {
  it('is scrolled to once the window measures, and drawn and ringed there', async () => {
    const items: Item[] = Array.from({ length: N }, (_, i) => makeItem(i));
    const last = items[N - 1]!;
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
          <div data-explorer="">
            <ArrivedItemContext.Provider value={last.id}>
              <CardView
                folders={[]}
                items={items}
                options={{ showApp: false, showFolder: false }}
                hasMore={false}
                loadingMore={false}
                onLoadMore={vi.fn()}
                resetKey="late"
              />
            </ArrivedItemContext.Provider>
            <Mark id={last.id} />
          </div>
        </ExplorerProvider>
      </ToastProvider>,
    );
    const card = () => document.querySelector(`[data-item-card="${last.id}"]`);
    // Unmeasured, every card draws: the item is there, and nothing is asked to scroll yet.
    expect(card()).not.toBeNull();
    expect(asked).toEqual([]);
    // The window measures and keeps the first rows: the item is gone, so the view scrolls to its row (row 9).
    await act(async () => {
      setWindow(firstRows);
      await Promise.resolve();
    });
    expect(asked[0]).toBe(`${9 * 300}px`);
    await act(async () => {
      await Promise.resolve();
    });
    // Scrolled there, the window draws it, and the new card wears the ring.
    expect(card()).not.toBeNull();
    expect(card()!.hasAttribute('data-arrived')).toBe(true);
  });
});
