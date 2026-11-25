// @vitest-environment jsdom
// docs/specs/006-document/layers.md and liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md: deleting
// or clearing a layer that holds elements acts at once, and its toast's Undo puts back exactly what went.
import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@liveworkspace/ui/toast';
import type { Element, Layer, Tab } from '@livediagram/document';
import { useLayersState } from './useLayersState';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const box = (id: string, layerId: string) =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, layerId }) as Element;
const L = (id: string): Layer => ({ id, name: id === 'b' ? 'Notes' : id });
const START: Tab[] = [
  {
    id: 't1',
    name: 'One',
    elements: [box('a1', 'a'), box('b1', 'b'), box('a2', 'a'), box('b2', 'b')],
    layers: [L('a'), L('b'), L('c')],
  },
  { id: 't2', name: 'Two', elements: [] },
];

function setup(editsBlocked = false) {
  let tabs = START;
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const hook = renderHook(
    ({ active }: { active: string }) =>
      useLayersState({
        activeId: active,
        activeTab: tabs.find((t) => t.id === active)!,
        editsBlocked,
        commitActiveTab: (map) => commitTabs((ts) => ts.map((t) => (t.id === active ? map(t) : t))),
        commitTabs,
        tickTabs: commitTabs,
        markCheckpoint: vi.fn(),
        toastInfo: vi.fn(),
      }),
    { wrapper: ToastProvider, initialProps: { active: 't1' } },
  );
  return {
    layers: () => hook.result.current,
    rerender: (active = 't1') => hook.rerender({ active }),
    tab: () => tabs[0]!,
    commitTabs,
  };
}
const run = (fn: () => void) =>
  act(async () => {
    fn();
  });

describe('deleting a layer', () => {
  it('goes at once with its elements, and Undo puts the layer back in its place with them', async () => {
    const s = setup();
    await run(() => s.layers().removeLayer('b'));
    expect(s.tab().layers!.map((l) => l.id)).toEqual(['a', 'c']);
    expect(s.tab().elements.map((e) => e.id)).toEqual(['a1', 'a2']);
    expect(screen.getByText('Deleted “Notes” and its 2 elements.')).toBeTruthy();
    // Even after the person moves to another tab, Undo lands on this one.
    s.rerender('t2');
    fireEvent.click(screen.getByRole('button', { name: 'Undo deleting Notes' }));
    await run(() => {});
    expect(s.tab()).toEqual(START[0]);
    expect(screen.queryByRole('button', { name: 'Undo deleting Notes' })).toBeNull();
  });

  it('moves focus off the gone row, and back onto it after Undo', async () => {
    const s = setup();
    const focus = { removed: vi.fn(), restored: vi.fn() };
    await run(() => s.layers().removeLayer('b', focus));
    expect(focus.removed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Undo deleting Notes' }));
    await run(() => {});
    expect(focus.restored).toHaveBeenCalledOnce();
  });

  it('just deletes an empty layer, with no toast', async () => {
    const s = setup();
    await run(() => s.layers().removeLayer('c'));
    expect(s.tab().layers!.map((l) => l.id)).toEqual(['a', 'b']);
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
  });

  it('leaves the toast to expire without changing anything', async () => {
    vi.useFakeTimers();
    try {
      const s = setup();
      await run(() => s.layers().removeLayer('b'));
      const after = s.tab();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(s.tab()).toBe(after);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('clearing a layer', () => {
  it('empties it at once, and Undo puts each element back in its old order', async () => {
    const s = setup();
    await run(() => s.layers().clearLayer('b'));
    expect(s.tab().elements.map((e) => e.id)).toEqual(['a1', 'a2']);
    expect(s.tab().layers!.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(screen.getByText('Cleared 2 elements from “Notes”.')).toBeTruthy();
    // A collaborator adds an element meanwhile: it stays.
    s.commitTabs((ts) =>
      ts.map((t) => (t.id === 't1' ? { ...t, elements: [...t.elements, box('n', 'a')] } : t)),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo clearing Notes' }));
    await run(() => {});
    expect(s.tab().elements.map((e) => e.id)).toEqual(['a1', 'b1', 'a2', 'b2', 'n']);
  });

  it('offers nothing on an empty layer', async () => {
    const s = setup();
    await run(() => s.layers().clearLayer('c'));
    expect(s.commitTabs).not.toHaveBeenCalled();
  });
});

// Share roles (docs/specs/013-workspace/share-roles.md): a session that may not edit the structure (a Viewer, or a
// Participant where layers are an Editor's) never deletes or clears, so never sees the toast.
describe('without edit rights', () => {
  it('neither deletes nor clears, and offers no Undo', async () => {
    const s = setup(true);
    await run(() => s.layers().removeLayer('b'));
    await run(() => s.layers().clearLayer('b'));
    expect(s.commitTabs).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
  });
});
