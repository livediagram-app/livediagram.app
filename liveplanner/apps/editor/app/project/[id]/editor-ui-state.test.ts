// @vitest-environment jsdom

// docs/specs/013-workspace/tab-scoped-share-links.md: a session scoped to one tab can't make another tab
// active, whichever control asks (tab bar, a link, search, the keyboard,
// a slide), because they all go through this one setter.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { toast } = vi.hoisted(() => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

const { useEditorUiState } = await import('./editor-ui-state');

describe('useEditorUiState active tab', () => {
  it('switches freely without a scope', () => {
    const scope = { current: null };
    const { result } = renderHook(() => useEditorUiState('t1', scope));
    act(() => result.current.setActiveId('t2'));
    expect(result.current.activeId).toBe('t2');
  });

  it('refuses a tab outside the scope and says why', () => {
    const scope = { current: 't1' };
    const { result } = renderHook(() => useEditorUiState('t1', scope));
    act(() => result.current.setActiveId('t2'));
    expect(result.current.activeId).toBe('t1');
    expect(toast.info).toHaveBeenCalledWith("That tab isn't shared with you");
  });

  it('allows the scoped tab', () => {
    const scope: { current: string | null } = { current: null };
    const { result } = renderHook(() => useEditorUiState('t1', scope));
    scope.current = 't2';
    act(() => result.current.setActiveId('t2'));
    expect(result.current.activeId).toBe('t2');
  });
});

// docs/specs/008-canvas/canvas-performance.md "A selection change re-renders what it touches": the editor
// root holds the selection store but never renders for a change to it.
describe('useEditorUiState selection', () => {
  it('does not render its host for a selection change, and reads the newest selection', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useEditorUiState('t1', { current: null });
    });
    const before = renders;

    act(() => result.current.setSelectedId('a'));
    act(() => result.current.setMultiSelectedIds(new Set(['a', 'b'])));

    expect(renders).toBe(before);
    expect(result.current.readSelection().selectedId).toBe('a');
    expect([...result.current.readSelection().multiSelectedIds]).toEqual(['a', 'b']);
  });
});

// docs/specs/026-plan/plan-overview.md "A built-in page, not a tab": the Overview opens over the open tab, and any tab
// switch closes it but the fallbacks that only keep the active tab a real one.
describe('useEditorUiState Overview', () => {
  it('opens once, clears the selection, and counts the open once', () => {
    const { result } = renderHook(() => useEditorUiState('t1', { current: null }));
    act(() => result.current.setSelectedId('a'));
    act(() => result.current.setEditingId('a'));
    act(() => result.current.openOverview());
    expect(result.current.overviewOpen).toBe(true);
    expect(result.current.activeId).toBe('t1');
    expect(result.current.readSelection().selectedId).toBeNull();
    expect(result.current.editingId).toBeNull();
    act(() => result.current.openOverview());
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Overview');
  });

  it('closes on a tab switch, the tab that was open included', () => {
    const { result } = renderHook(() => useEditorUiState('t1', { current: null }));
    act(() => result.current.openOverview());
    act(() => result.current.setActiveId('t1'));
    expect(result.current.overviewOpen).toBe(false);
    act(() => result.current.openOverview());
    act(() => result.current.setActiveId('t2'));
    expect(result.current.overviewOpen).toBe(false);
    expect(result.current.activeId).toBe('t2');
  });

  it('stays open when a fallback only keeps the active tab a real one', () => {
    const { result } = renderHook(() => useEditorUiState('t1', { current: null }));
    act(() => result.current.openOverview());
    act(() => result.current.setActiveId('t2', { keepOverview: true }));
    expect(result.current.overviewOpen).toBe(true);
    expect(result.current.activeId).toBe('t2');
  });
});
