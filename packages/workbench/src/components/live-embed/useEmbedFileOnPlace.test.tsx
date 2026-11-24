// @vitest-environment jsdom

// Placing an Embed File opens it at once (live-embeds.md "Making one", Work Tracker 1375): only an empty live embed
// that appears after the editor opened, selected now or by the next change, and only for an Editor.
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSelectionStore } from '../../lib/selection-store';
import { SelectionStoreProvider } from '../../hooks/canvas/useSelectionStore';
import {
  EmbedFileOnPlace,
  embedToOpen,
  liveEmbedConnectOf,
  type EmbedPlaceMemory,
} from './useEmbedFileOnPlace';

const empty = (id: string) => ({ id, type: 'video', embedProvider: 'live' });
const chosen = (id: string) => ({ ...empty(id), liveItem: { app: 'liveplanner', itemId: 'p' } });
const memoryOf = (...ids: string[]): EmbedPlaceMemory => ({ seen: new Set(ids), fresh: new Set() });

describe('embedToOpen', () => {
  it('opens a new empty live embed that is selected', () => {
    expect(embedToOpen([empty('a')], 'a', memoryOf())).toBe('a');
  });

  it('never opens one seen before, a chosen one, another embed or one not selected', () => {
    expect(embedToOpen([empty('a')], 'a', memoryOf('a'))).toBeNull();
    expect(embedToOpen([chosen('b')], 'b', memoryOf())).toBeNull();
    expect(
      embedToOpen([{ id: 'c', type: 'video', embedProvider: 'youtube' }], 'c', memoryOf()),
    ).toBeNull();
    expect(embedToOpen([{ id: 'd', type: 'shape' }], 'd', memoryOf())).toBeNull();
    expect(embedToOpen([empty('e')], null, memoryOf())).toBeNull();
  });

  it('opens one selected by the very next change, never later', () => {
    const memory = memoryOf();
    expect(embedToOpen([empty('a')], null, memory)).toBeNull();
    expect(embedToOpen([empty('a')], 'a', memory)).toBe('a');
    const later = memoryOf();
    embedToOpen([empty('b')], null, later);
    embedToOpen([empty('b')], null, later);
    expect(embedToOpen([empty('b')], 'b', later)).toBeNull();
  });
});

describe('EmbedFileOnPlace', () => {
  function mount(elements: ReturnType<typeof empty>[], enabled = true) {
    const store = createSelectionStore();
    const open = vi.fn();
    const view = (els: ReturnType<typeof empty>[], on = enabled) => (
      <SelectionStoreProvider store={store}>
        <EmbedFileOnPlace elements={els} enabled={on} open={open} />
      </SelectionStoreProvider>
    );
    const r = render(view(elements));
    return {
      store,
      open,
      rerender: (els: ReturnType<typeof empty>[], on?: boolean) => r.rerender(view(els, on)),
    };
  }

  it('leaves the embeds the editor opened with alone, and opens one placed and selected', () => {
    const { store, open, rerender } = mount([empty('old')]);
    act(() => store.setSelectedId('old'));
    expect(open).not.toHaveBeenCalled();
    rerender([empty('old'), empty('new')]);
    act(() => store.setSelectedId('new'));
    expect(open).toHaveBeenCalledWith('new');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens nothing for someone who may not choose', () => {
    const { store, open, rerender } = mount([]);
    act(() => store.setSelectedId('new'));
    rerender([empty('new')], false);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('liveEmbedConnectOf', () => {
  it('is undefined where Connect File cannot connect, and adds the tab without moving to it', async () => {
    expect(liveEmbedConnectOf(undefined)).toBeUndefined();
    const addConnectedTab = vi.fn(async () => undefined);
    const connect = liveEmbedConnectOf({
      hostKind: 'plan',
      connected: new Map(),
      grant: async () => 'g',
      newTabId: () => 't',
      addConnectedTab,
    })!;
    expect(connect.hostKind).toBe('plan');
    await connect.addTab(
      { connection: { id: 'c', app: 'liveplanner', itemId: 'p' } } as never,
      't',
    );
    expect(addConnectedTab).toHaveBeenCalledWith(
      { connection: { id: 'c', app: 'liveplanner', itemId: 'p' } },
      't',
    );
  });
});
