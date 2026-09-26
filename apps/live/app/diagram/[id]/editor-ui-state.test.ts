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
