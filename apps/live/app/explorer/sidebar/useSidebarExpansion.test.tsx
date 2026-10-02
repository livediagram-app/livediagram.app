// @vitest-environment jsdom

// Sidebar expansion (docs/specs/013-workspace/explorer-structure.md#expansion).

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SelectedNode } from '../views';
import { LIBRARY_EXPAND_KEY, MY_DOCUMENTS_EXPAND_KEY } from './sidebar-structure';
import { useSidebarExpansion } from './useSidebarExpansion';

describe('useSidebarExpansion', () => {
  it('starts with My documents open and Library closed', () => {
    const { result } = renderHook(() => useSidebarExpansion({ kind: 'timeline' }));
    expect(result.current.expanded.has(MY_DOCUMENTS_EXPAND_KEY)).toBe(true);
    expect(result.current.expanded.has(LIBRARY_EXPAND_KEY)).toBe(false);
  });

  it('opens Library when a Library page becomes current', () => {
    const { result, rerender } = renderHook(
      ({ selected }: { selected: SelectedNode }) => useSidebarExpansion(selected),
      { initialProps: { selected: { kind: 'timeline' } as SelectedNode } },
    );
    rerender({ selected: { kind: 'gallery' } });
    expect(result.current.expanded.has(LIBRARY_EXPAND_KEY)).toBe(true);
  });

  it('lets the reader collapse Library while on a Library page', () => {
    const { result } = renderHook(() => useSidebarExpansion({ kind: 'themes' }));
    act(() => result.current.toggleExpand(LIBRARY_EXPAND_KEY));
    expect(result.current.expanded.has(LIBRARY_EXPAND_KEY)).toBe(false);
  });

  it('toggles any key, folder ids included', () => {
    const { result } = renderHook(() => useSidebarExpansion({ kind: 'timeline' }));
    act(() => result.current.toggleExpand('folder-1'));
    expect(result.current.expanded.has('folder-1')).toBe(true);
    act(() => result.current.toggleExpand('folder-1'));
    expect(result.current.expanded.has('folder-1')).toBe(false);
  });

  it('opens a row once, however often it is asked', () => {
    const { result } = renderHook(() => useSidebarExpansion({ kind: 'timeline' }));
    act(() => result.current.expand('folder-1'));
    act(() => result.current.expand('folder-1'));
    expect(result.current.expanded.has('folder-1')).toBe(true);
  });
});
