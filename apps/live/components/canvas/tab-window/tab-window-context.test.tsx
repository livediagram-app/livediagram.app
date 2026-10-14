// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { useTabWindowContextValue } from './tab-window-context';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/009-elements/tab-window.md "States", "Choosing the tab", "Opening the tab".

const tabs = [
  { id: 'slides', name: 'Slides', elements: [] },
  { id: 'flow', name: 'Flow', elements: [] },
] as unknown as Tab[];

function setup(over: Partial<Parameters<typeof useTabWindowContextValue>[0]> = {}) {
  let loaded = new Set<string>();
  const loadTabs = vi.fn(async (_: readonly string[]) => [] as string[]);
  const openTab = vi.fn();
  let elements: Element[] = [
    { id: 'w', type: 'shape', shape: 'tab-window', x: 0, y: 0, width: 640, height: 360 } as Element,
  ];
  const commitElements = vi.fn((map: (els: Element[]) => Element[]) => {
    elements = map(elements);
  });
  const hook = renderHook(
    (props: { loaded: Set<string> }) =>
      useTabWindowContextValue({
        tabs,
        ownTabId: 'slides',
        loadedTabIds: props.loaded,
        loadTabs,
        openTab,
        canChoose: true,
        commitElements: commitElements as never,
        ...over,
      }),
    { initialProps: { loaded } },
  );
  return {
    hook,
    loadTabs,
    openTab,
    commitElements,
    elements: () => elements,
    setLoaded: (ids: string[]) => {
      loaded = new Set(ids);
      hook.rerender({ loaded });
    },
  };
}

describe('useTabWindowContextValue', () => {
  it('reads its own tab as loaded and another as loading until it arrives', () => {
    const h = setup();
    expect(h.hook.result.current.status('slides')).toBe('loaded');
    expect(h.hook.result.current.status('flow')).toBe('loading');
    h.setLoaded(['flow']);
    expect(h.hook.result.current.status('flow')).toBe('loaded');
  });

  it('asks for a tab once, however many windows show it', async () => {
    const h = setup();
    act(() => {
      h.hook.result.current.request('flow');
      h.hook.result.current.request('flow');
    });
    expect(h.loadTabs).toHaveBeenCalledTimes(1);
    expect(h.loadTabs).toHaveBeenCalledWith(['flow']);
  });

  it('marks a failed fetch, and Retry asks again', async () => {
    const h = setup();
    h.loadTabs.mockResolvedValueOnce(['flow']);
    await act(async () => {
      h.hook.result.current.request('flow');
    });
    expect(h.hook.result.current.status('flow')).toBe('failed');
    await act(async () => {
      h.hook.result.current.retry('flow');
    });
    expect(h.loadTabs).toHaveBeenCalledTimes(2);
    expect(h.hook.result.current.status('flow')).toBe('loading');
  });

  it('opens the tab, tracked', () => {
    const h = setup();
    h.hook.result.current.open('flow');
    expect(h.openTab).toHaveBeenCalledWith('flow');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'TabWindowOpen');
  });

  it('shows a tab in a window in one edit, tracked', () => {
    const h = setup();
    h.hook.result.current.choose?.('w', 'flow');
    expect(h.commitElements).toHaveBeenCalledTimes(1);
    expect(h.elements()[0]).toMatchObject({ windowTabId: 'flow' });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'TabWindowTab');
  });

  it('offers no choosing to someone who may not edit', () => {
    expect(setup({ canChoose: false }).hook.result.current.choose).toBeUndefined();
  });
});
