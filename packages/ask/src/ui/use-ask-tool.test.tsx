// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';

const door = vi.hoisted(() => ({ published: [] as { key: string; items: readonly unknown[] }[] }));
vi.mock('@liveworkspace/workbench/components/chrome/tools-door', () => ({
  usePublishToolsItems: (key: string, items: readonly unknown[]) =>
    void door.published.push({ key, items }),
}));
vi.mock('./AskTool', () => ({ AskTool: () => null }));

import { useAskTool, type AskToolInput } from './use-ask-tool';
import type { AskHost } from './host';

const tabs = [
  { id: 't1', name: 'Flow', elements: [{ id: 'a', type: 'shape', label: 'Payment Service' }] },
];
const input = (over: Partial<AskToolInput> = {}): AskToolInput => ({
  app: 'livediagram',
  itemId: 'doc_1',
  accountId: 'acc_1',
  tabs,
  loadAllTabs: async () => [],
  open: () => {},
  ...over,
});
const last = () => door.published.at(-1)!;
const row = () => last().items[0] as ChromeToolsItem;
// The host the row's view is drawn with.
const hostOf = (item: ChromeToolsItem): AskHost => {
  const view = item.view!({ back: () => {}, close: () => {}, sheet: false }) as {
    props: { children: { props: { host: AskHost } } };
  };
  return view.props.children.props.host;
};

beforeEach(() => {
  door.published = [];
});
afterEach(() => vi.unstubAllGlobals());

describe('Ask AI in an editor', () => {
  it('publishes its row for the open item, under Find, staying open beside the canvas', () => {
    renderHook(() => useAskTool(input()));
    expect(last().key).toBe('ask-ai');
    expect(row()).toMatchObject({
      id: 'ask-ai',
      group: 'find',
      label: 'Ask AI',
      description: 'Ask a question, get an answer from this canvas.',
      keepOpen: true,
    });
    expect(row().badges).toBeUndefined();
    row().onSelect(null);
  });

  it('asks a guest to sign in, and has no row with no item open', () => {
    renderHook(() => useAskTool(input({ accountId: null })));
    expect(row().badges).toEqual(['Sign In']);
    renderHook(() => useAskTool(input({ itemId: null })));
    expect(last().items).toEqual([]);
  });

  it('keeps the same row while the canvas changes', () => {
    const { rerender } = renderHook((props: AskToolInput) => useAskTool(props), {
      initialProps: input(),
    });
    const before = row();
    rerender(input({ tabs: [...tabs] }));
    expect(row()).toBe(before);
    rerender(input({ accountId: 'acc_2' }));
    expect(row()).not.toBe(before);
  });

  it("reads the item's words when asked: every tab loaded first, then the newest tabs and the app's own", async () => {
    const loadAllTabs = vi.fn(async () => []);
    const open = vi.fn();
    const more = () => [
      {
        id: 'card:1',
        tabId: 't1',
        tabName: 'Flow',
        elementId: '1',
        kind: 'Card',
        title: 'A card',
        text: 'A card',
      },
    ];
    const suggestions = ['Summarise this canvas'];
    const { rerender } = renderHook((props: AskToolInput) => useAskTool(props), {
      initialProps: input({ loadAllTabs, open, more, suggestions }),
    });
    const host = hostOf(row());
    expect(host.suggestions).toBe(suggestions);
    const later = [
      ...tabs,
      { id: 't2', name: 'Owners', elements: [{ id: 'b', type: 'shape', label: 'Platform' }] },
    ];
    rerender(input({ loadAllTabs, open, more, suggestions, tabs: later }));
    const passages = await host.passages();
    expect(loadAllTabs).toHaveBeenCalledTimes(1);
    expect(passages.map((p) => p.id)).toEqual(['t1:a', 't2:b', 'card:1']);
    const source = { ...passages[0]!, number: 1 };
    host.open(source);
    expect(open).toHaveBeenCalledWith(source);
  });

  it('still answers when a tab fails to load, and without animation frames', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    renderHook(() =>
      useAskTool(input({ loadAllTabs: async () => Promise.reject(new Error('offline')) })),
    );
    expect((await hostOf(row()).passages()).map((p) => p.id)).toEqual(['t1:a']);
  });
});
