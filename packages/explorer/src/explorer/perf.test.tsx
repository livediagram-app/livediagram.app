// The Explorer's performance guards: 2,000 items (ten pages) must render, and re-render after one change,
// within a budget, and the DOM must hold a screenful, not the list.

import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
// Generous for a slow CI machine; locally each render takes a few tens of milliseconds.
const BUDGET_MS = 1000;

const items: Item[] = Array.from({ length: N }, (_, i) =>
  makeItem(i, { tagIds: i % 3 ? [] : ['t1'], favourite: i % 7 === 0 }),
);

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
  const index = createFakeIndex({ tags: [{ id: 't1', name: 'Q3', colour: 'blue', createdAt: 1 }] });
  const t0 = performance.now();
  const utils = render(
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
  const ms = performance.now() - t0;
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
    const t1 = performance.now();
    act(() => {
      overlayRef!.patch('item-1', { title: 'Renamed' });
    });
    const patchMs = performance.now() - t1;
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

  it('render in the details view within budget', async () => {
    const { ms, container } = await mount('details');
    const mounted = container.querySelectorAll('[data-item-row]').length;
    console.info(`details: ${N} items rendered in ${ms.toFixed(1)} ms, ${mounted} rows mounted`);
    expect(mounted).toBeLessThan(60);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
