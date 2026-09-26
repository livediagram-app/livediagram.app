// @vitest-environment jsdom

// The autosave toast (docs/specs/006-diagram/per-tab-storage.md): each failed-save status names its own
// cause, so a sign-in problem never reads as a connection one.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SaveStatus } from '@/components/chrome/EditorHeader';

vi.mock('@/lib/api-client', () => ({
  apiListDiagrams: vi.fn(),
  apiListSharedWith: vi.fn(),
  DIAGRAM_LIST_LOAD_SAFETY_MS: 10_000,
}));

import { useEditorPersistence } from './editor-persistence';

function toastAfter(status: SaveStatus): string[] {
  const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
  const { result } = renderHook(() => useEditorPersistence({ toast }));
  act(() => result.current.setSaveStatus(status));
  return toast.error.mock.calls.map((c) => c[0] as string);
}

describe('useEditorPersistence save toast', () => {
  it('blames the connection only for a failed save', () => {
    expect(toastAfter('error')).toEqual(['Couldn’t save your changes. Check your connection.']);
  });

  it('names the sign-in, not the connection, for an unauthenticated save', () => {
    const [message] = toastAfter('unauthenticated');
    expect(message).toBe(
      'Couldn’t confirm you’re signed in, so your changes aren’t saving. Sign in again to keep them.',
    );
    expect(message).not.toMatch(/connection/i);
  });

  it('stays quiet while saving and once saved', () => {
    expect(toastAfter('saving')).toEqual([]);
    expect(toastAfter('saved')).toEqual([]);
  });
});
