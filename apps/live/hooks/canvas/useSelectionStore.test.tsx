// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createSelectionStore, elementSelectionFlags, sameFlags } from '@/lib/selection-store';
import { SelectionStoreProvider, useSelectionOf, useSelectionStore } from './useSelectionStore';

// docs/specs/008-canvas/blueprints/selection-store.md "Subscribing".

describe('useSelectionOf', () => {
  it('re-renders a subscriber only when its slice changes', () => {
    const store = createSelectionStore();
    const renders = vi.fn();
    const View = ({ id }: { id: string }) => {
      const flags = useSelectionOf((s) => elementSelectionFlags(s, id), sameFlags);
      renders(id);
      return <span>{flags.selected ? 'on' : 'off'}</span>;
    };
    render(
      <SelectionStoreProvider store={store}>
        <View id="a" />
        <View id="b" />
        <View id="c" />
      </SelectionStoreProvider>,
    );
    renders.mockClear();

    act(() => store.setSelectedId('a'));
    act(() => store.setSelectedId('b'));

    expect(renders.mock.calls.map(([id]) => id).sort()).toEqual(['a', 'a', 'b']);
  });

  it('returns the current slice', () => {
    const store = createSelectionStore();
    store.setSelectedId('x');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SelectionStoreProvider store={store}>{children}</SelectionStoreProvider>
    );

    const { result } = renderHook(() => useSelectionOf((s) => s.selectedId), { wrapper });
    act(() => store.setSelectedId('y'));

    expect(result.current).toBe('y');
  });
});

describe('useSelectionOf with a selector over other data', () => {
  it('re-selects when the selector changes, though the selection did not', () => {
    const store = createSelectionStore();
    store.setSelectedId('p');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SelectionStoreProvider store={store}>{children}</SelectionStoreProvider>
    );

    const { result, rerender } = renderHook(
      ({ paths }: { paths: Set<string> }) =>
        useSelectionOf((s) => (s.selectedId && paths.has(s.selectedId) ? s.selectedId : null)),
      { wrapper, initialProps: { paths: new Set<string>() } },
    );
    expect(result.current).toBeNull();

    rerender({ paths: new Set(['p']) });

    expect(result.current).toBe('p');
  });
});

describe('useSelectionStore', () => {
  it('throws outside a provider, never yielding a silent empty selection', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useSelectionStore())).toThrow('SelectionStoreMissing');
  });
});
