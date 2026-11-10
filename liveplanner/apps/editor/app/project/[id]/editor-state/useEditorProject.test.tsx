// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@liveplanner/project';
import { useEditorProject } from './useEditorProject';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';

// The project slice's own logic, which lived inside useEditorState before it was split: the commit choke point's
// stamps, the tab summary the link badges read, and the loaded / failed tab bookkeeping (docs/specs/006-project/
// per-tab-storage.md, docs/specs/006-project/layers.md).

const box = (id: string, extra: Partial<Element> = {}) =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...extra,
  }) as Element;

function mount(opts: { tabs?: Tab[]; stamp?: { tabId: string; layerId: string } | null } = {}) {
  const tabs = opts.tabs ?? [
    { id: 't1', name: 'One', elements: [] },
    { id: 't2', name: 'Two', elements: [] },
  ];
  const env = { initialTabs: tabs } as unknown as EditorEnvSlice;
  const selection = { activeId: 't1' } as unknown as EditorSelectionSlice;
  const stampRef = { current: opts.stamp ?? null };
  return renderHook(() =>
    useEditorProject(env, selection, { activeLayerStampRef: () => stampRef }),
  );
}

describe('useEditorProject', () => {
  it('stamps the kind only on the tabs a commit changed or added', () => {
    const { result } = mount();
    const untouched = result.current.tabs[1];
    act(() =>
      result.current.commitTabs((ts) =>
        ts.map((t) => (t.id === 't1' ? { ...t, elements: [box('a')] } : t)),
      ),
    );
    expect(result.current.tabs[0]!.kind).toBeDefined();
    // An untouched tab may be a placeholder whose content has not loaded: it keeps its identity.
    expect(result.current.tabs[1]).toBe(untouched);
    expect(result.current.tabs[1]!.kind).toBeUndefined();
  });

  it('puts new elements on the active layer the later slice names, read when the commit runs', () => {
    const layers = [
      { id: 'base', name: 'Base' },
      { id: 'top', name: 'Top' },
    ];
    const { result } = mount({
      tabs: [{ id: 't1', name: 'One', elements: [box('old', { layerId: 'base' })], layers }],
      stamp: { tabId: 't1', layerId: 'top' },
    });
    act(() =>
      result.current.commitTabs((ts) =>
        ts.map((t) => ({ ...t, elements: [...t.elements, box('new')] })),
      ),
    );
    const els = result.current.tabs[0]!.elements;
    expect(els.find((e) => e.id === 'old')!.layerId).toBe('base');
    expect(els.find((e) => e.id === 'new')!.layerId).toBe('top');
  });

  it('keeps the tab summary while only elements change, and renews it on a rename', () => {
    const { result } = mount();
    const before = result.current.tabSummaries;
    expect(before).toEqual([
      { id: 't1', name: 'One' },
      { id: 't2', name: 'Two' },
    ]);
    act(() => result.current.tickTabs((ts) => ts.map((t) => ({ ...t, elements: [box('a')] }))));
    expect(result.current.tabSummaries).toBe(before);
    act(() =>
      result.current.commitTabs((ts) =>
        ts.map((t) => (t.id === 't2' ? { ...t, name: 'Renamed' } : t)),
      ),
    );
    expect(result.current.tabSummaries).toEqual([
      { id: 't1', name: 'One' },
      { id: 't2', name: 'Renamed' },
    ]);
  });

  it('marks a tab loaded once, in the ref and the state', () => {
    const { result } = mount();
    act(() => result.current.markTabLoaded('t1'));
    const loaded = result.current.loadedTabIds;
    expect(loaded.has('t1')).toBe(true);
    expect(result.current.loadedTabIdsRef.current.has('t1')).toBe(true);
    act(() => result.current.markTabLoaded('t1'));
    expect(result.current.loadedTabIds).toBe(loaded);
  });

  it('retries the active tab: clears its error, forgets it was loaded and bumps the nonce', () => {
    const { result } = mount();
    act(() => {
      result.current.markTabLoaded('t1');
      result.current.setTabLoadErrors(new Set(['t1', 't2']));
    });
    const nonce = result.current.tabLoadRetryNonce;
    act(() => result.current.retryActiveTabLoad());
    expect([...result.current.tabLoadErrors]).toEqual(['t2']);
    expect(result.current.loadedTabIdsRef.current.has('t1')).toBe(false);
    expect(result.current.tabLoadRetryNonce).toBe(nonce + 1);
  });

  it('knows the dot vote by the collab key, not the owner id', () => {
    const { result } = mount();
    act(() =>
      result.current.setSelfParticipant({
        id: 'guest-secret',
        name: 'Ada',
        color: '#000',
        status: 'online',
        key: 'collab-1',
      } as never),
    );
    expect(result.current.voteSelfId).toBe('collab-1');
  });
});
