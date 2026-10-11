// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { createShape, type Tab } from '@livediagram/document';
import { resetMindHandoff } from '@/lib/mind-handoff';
import { useMindGrowth } from './useMindGrowth';

// docs/specs/009-elements/mind-node.md: a growth selects the new node and never opens its
// label editor; Escape on it while still empty removes it.

const root = { ...createShape('mind-node', 0, 0), id: 'root', label: 'Offsite' };
const startTab = (): Tab => ({ id: 't', name: 'Map', elements: [root] }) as unknown as Tab;

function setup() {
  const setEditingId = vi.fn();
  const setSelectedId = vi.fn();
  const hook = renderHook(() => {
    const [tabs, setTabs] = useState<Tab[]>([startTab()]);
    const api = useMindGrowth({
      editsBlocked: false,
      activeId: 't',
      activeTab: tabs[0]!,
      commitTabs: (update) => setTabs(update),
      setSelectedId,
      setEditingId,
      scrollIntoView: () => {},
    });
    return { api, tab: tabs[0]! };
  });
  return { hook, setEditingId, setSelectedId };
}

const grownId = (setSelectedId: ReturnType<typeof vi.fn>) =>
  setSelectedId.mock.calls.at(-1)![0] as string;

afterEach(() => {
  cleanup();
  resetMindHandoff();
});

describe('useMindGrowth', () => {
  it('selects a grown node without opening its label editor', () => {
    const { hook, setEditingId, setSelectedId } = setup();
    act(() => hook.result.current.api.growMindNode('root', 'child'));
    const id = grownId(setSelectedId);
    expect(hook.result.current.tab.elements.some((e) => e.id === id)).toBe(true);
    expect(setEditingId).not.toHaveBeenCalledWith(id);
    expect(setEditingId).toHaveBeenLastCalledWith(null);
  });

  it('opens the editor once the node lands when keys were typed for it first', () => {
    const { hook, setEditingId, setSelectedId } = setup();
    act(() => {
      hook.result.current.api.growMindNode('root', 'child');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', cancelable: true }));
    });
    expect(setEditingId).toHaveBeenLastCalledWith(grownId(setSelectedId));
  });

  it('removes the just-grown node on Escape while it is still empty', () => {
    const { hook, setSelectedId } = setup();
    act(() => hook.result.current.api.growMindNode('root', 'child'));
    const id = grownId(setSelectedId);
    let removed = false;
    act(() => {
      removed = hook.result.current.api.escapeGrownMindNode(id);
    });
    expect(removed).toBe(true);
    expect(hook.result.current.tab.elements.some((e) => e.id === id)).toBe(false);
    expect(setSelectedId).toHaveBeenLastCalledWith('root');
  });

  it('leaves any other node to the usual Escape', () => {
    const { hook } = setup();
    expect(hook.result.current.api.escapeGrownMindNode('root')).toBe(false);
  });
});
