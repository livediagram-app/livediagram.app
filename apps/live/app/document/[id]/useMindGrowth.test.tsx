// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import {
  MIND_SIBLING_GAP_Y,
  createShape,
  fitMindNodeHeight,
  type Element,
  type ShapeElement,
  type Tab,
} from '@liveplanner/document';
import { resetMindHandoff } from '@/lib/mind-handoff';
import { useMindGrowth } from './useMindGrowth';

// docs/specs/009-elements/mind-node.md: a growth selects the new node and never opens its
// label editor; Escape on it while still empty removes it.

const root = { ...createShape('mind-node', 0, 0), id: 'root', label: 'Offsite' };
const startTab = (): Tab => ({ id: 't', name: 'Map', elements: [root] });

function setup() {
  const setEditingId = vi.fn();
  const setSelectedId = vi.fn();
  const hook = renderHook(() => {
    const [tabs, setTabs] = useState<Tab[]>([startTab()]);
    // Another commit landing first, as the label editor's does just before its Tab / Enter.
    const patch = (map: (els: Element[]) => Element[]) =>
      setTabs((ts) => ts.map((t) => ({ ...t, elements: map(t.elements) })));
    const api = useMindGrowth({
      editsBlocked: false,
      activeId: 't',
      activeTab: tabs[0]!,
      commitTabs: (update) => setTabs(update),
      setSelectedId,
      setEditingId,
      scrollIntoView: () => {},
    });
    return { api, tab: tabs[0]!, patch };
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

  it('places the new node against the map as it stands in the commit, clear of a node just grown taller', () => {
    const { hook, setSelectedId } = setup();
    act(() => hook.result.current.api.growMindNode('root', 'child'));
    const first = grownId(setSelectedId);
    // The label commit grows the node (docs/specs/009-elements/mind-node.md "A node grows to fit
    // its label"), then Enter grows a sibling, before any re-render.
    act(() => {
      hook.result.current.patch((els) => fitMindNodeHeight(els, first, 220));
      hook.result.current.api.growMindNode(first, 'sibling');
    });
    const els = hook.result.current.tab.elements;
    const at = (id: string) => els.find((e) => e.id === id) as ShapeElement;
    const tall = at(first);
    const next = at(grownId(setSelectedId));
    expect(tall.height).toBe(220);
    expect(next.y - (tall.y + tall.height)).toBe(MIND_SIBLING_GAP_Y);
  });
});
