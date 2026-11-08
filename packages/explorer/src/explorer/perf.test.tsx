// The Explorer's performance guards: 2,000 items (ten pages) must render, and re-render after one change,
// within a budget, and the DOM must hold a screenful, not the list.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { createItemOverlay } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { ToastProvider } from '../ui/Toasts';
import { CardView, CARD_BATCH } from './CardView';
import { ExplorerProvider, useExplorer } from './context';
import { ListView } from './ListView';
import { DetailsView } from './DetailsView';
import type { Item } from '@liveworkspace/index-client';

const N = 2000;
// Locally each render takes a few tens of milliseconds. CPU time, so a busy runner's waiting doesn't count;
// cpuBudgetMs gives CI its headroom (a wall-clock budget failed on a loaded runner at 1,035 ms).
const BUDGET_MS = cpuBudgetMs(1000);
const REVEAL_BUDGET_MS = cpuBudgetMs(3000);

const items: Item[] = Array.from({ length: N }, (_, i) => makeItem(i, { favourite: i % 7 === 0 }));

function Harness({ layout, raw }: { layout: 'list' | 'card' | 'details'; raw: Item[] }) {
  const { overlay } = useExplorer();
  const state = useItemList({
    key: 'perf',
    load: async () => ({ items: raw, nextCursor: null }),
    overlay,
  });
  const props = {
    folders: [],
    items: state.items,
    options: { showApp: true, showFolder: true },
    hasMore: false,
    loadingMore: false,
    onLoadMore: () => {},
  };
  if (layout === 'card') return <CardView {...props} resetKey="perf" />;
  if (layout === 'details') return <DetailsView {...props} />;
  return <ListView {...props} />;
}

let overlayRef: ReturnType<typeof createItemOverlay> | null = null;
function Grab() {
  overlayRef = useExplorer().overlay;
  return null;
}

async function mount(layout: 'list' | 'card' | 'details') {
  const index = createFakeIndex();
  let utils!: ReturnType<typeof render>;
  const ms = await cpuMsOfAsync(async () => {
    utils = render(
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
          <Grab />
          <Harness layout={layout} raw={items} />
        </ExplorerProvider>
      </ToastProvider>,
    );
    // The list resolves in a microtask; flush it inside act.
    await act(async () => {});
  });
  return { ...utils, ms };
}

describe('2,000 items', () => {
  it('render in the list view within budget, mounting only a screenful', async () => {
    const { ms, container } = await mount('list');
    const mounted = container.querySelectorAll('[data-item-row]').length;
    console.info(`list: ${N} items rendered in ${ms.toFixed(1)} ms, ${mounted} rows mounted`);
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(60);
    expect(ms).toBeLessThan(BUDGET_MS);

    // One change re-renders within budget too.
    const patchMs = cpuMsOf(() => {
      act(() => {
        overlayRef!.patch('item-1', { title: 'Renamed' });
      });
    });
    console.info(`list: one rename over ${N} items re-rendered in ${patchMs.toFixed(1)} ms`);
    expect(container.textContent).toContain('Renamed');
    expect(patchMs).toBeLessThan(BUDGET_MS / 4);
  });

  it('render in the card view within budget, a batch of cards at a time', async () => {
    const { ms, container } = await mount('card');
    const mounted = container.querySelectorAll('[data-item-card]').length;
    console.info(`card: ${N} items rendered in ${ms.toFixed(1)} ms, ${mounted} cards mounted`);
    expect(mounted).toBe(CARD_BATCH);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('hold a screenful of cards in the DOM after every card is revealed', async () => {
    // jsdom has no layout: give the grid three columns and each card a height, as a browser would.
    const realStyle = window.getComputedStyle;
    const styleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      const style = realStyle(el, pseudo);
      if (!(el instanceof HTMLElement) || !el.className.includes('grid-cols')) return style;
      return {
        ...style,
        gridTemplateColumns: '300px 300px 300px',
        rowGap: '16px',
      } as CSSStyleDeclaration;
    });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const height = this.hasAttribute('data-item-card') ? 280 : 0;
        return {
          top: 0,
          bottom: height,
          left: 0,
          right: 300,
          width: 300,
          height,
          x: 0,
          y: 0,
        } as DOMRect;
      });
    try {
      const { container } = await mount('card');
      const ms = cpuMsOf(() => {
        for (let i = 0; i < N / CARD_BATCH + 1; i++) {
          const more = screen.queryByRole('button', { name: 'Show more' });
          if (!more) break;
          act(() => void fireEvent.click(more));
        }
      });
      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
      const mounted = container.querySelectorAll('[data-item-card]').length;
      console.info(`card: all ${N} revealed in ${ms.toFixed(1)} ms, ${mounted} cards mounted`);
      expect(mounted).toBeLessThan(CARD_BATCH);
      expect(container.querySelector('[data-card-spacer]')).not.toBeNull();
      // 34 reveals, each one render: under a second locally, where every card mounted took 38 s.
      expect(ms).toBeLessThan(REVEAL_BUDGET_MS);

      // One change re-renders within budget too, however many cards were revealed.
      const patchMs = cpuMsOf(() => {
        act(() => {
          overlayRef!.patch('item-1', { title: 'Renamed' });
        });
      });
      expect(container.textContent).toContain('Renamed');
      expect(patchMs).toBeLessThan(BUDGET_MS / 4);
    } finally {
      styleSpy.mockRestore();
      rectSpy.mockRestore();
    }
    // A wall-clock limit only for a loaded machine; the budget above is the test.
  }, 30_000);

  it('render in the details view within budget', async () => {
    const { ms, container } = await mount('details');
    const mounted = container.querySelectorAll('[data-item-row]').length;
    console.info(`details: ${N} items rendered in ${ms.toFixed(1)} ms, ${mounted} rows mounted`);
    expect(mounted).toBeLessThan(60);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
