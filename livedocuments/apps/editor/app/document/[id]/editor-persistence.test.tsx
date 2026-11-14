// @vitest-environment jsdom

// The autosave toast (docs/specs/006-document/per-tab-storage.md): each failed-save status names its own
// cause, so a sign-in problem never reads as a connection one.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SaveStatus } from '@/components/chrome/EditorHeader';

vi.mock('@/lib/api-client', () => ({
  apiListDocuments: vi.fn(),
  apiListSharedWith: vi.fn(),
  DOCUMENT_LIST_LOAD_SAFETY_MS: 10_000,
}));

import { useEditorPersistence } from './editor-persistence';

function toastAfter(status: SaveStatus): string[] {
  const toast = {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    offer: vi.fn(),
    action: vi.fn(),
    dismissAction: vi.fn(),
  };
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
    expect(message).toBe('Your sign-in has lapsed, so changes aren’t saving. Sign in again.');
    expect(message).not.toMatch(/connection/i);
  });

  // per-tab-storage.md "A tab too big to save says so".
  it('names the tab size, not the connection, for a tab too big to save', () => {
    const [message] = toastAfter('tooLarge');
    expect(message).toBe('This tab is too big to save. Move some of it to another tab.');
    expect(message).not.toMatch(/connection/i);
  });

  it('stays quiet while saving and once saved', () => {
    expect(toastAfter('saving')).toEqual([]);
    expect(toastAfter('saved')).toEqual([]);
  });

  it('raises a failed save once, however often the autosave says so', () => {
    const toast = { error: vi.fn() };
    const { result } = renderHook(() =>
      useEditorPersistence({
        toast: toast as unknown as Parameters<typeof useEditorPersistence>[0]['toast'],
      }),
    );
    act(() => result.current.setSaveStatus('error'));
    act(() => result.current.setSaveStatus(() => 'error'));
    expect(toast.error).toHaveBeenCalledTimes(1);
    act(() => result.current.setSaveStatus('saving'));
    act(() => result.current.setSaveStatus('error'));
    expect(toast.error).toHaveBeenCalledTimes(2);
  });
});

// docs/specs/007-editor/blueprints/flashcards.md "Performance and limits" (Work Tracker 728): a save renders nothing.
// As state, the status and the time of the last write rendered the whole editor twice more after every typing commit.
describe('useEditorPersistence while saving', () => {
  it('renders nothing as a save starts, lands or is timed', () => {
    let renders = 0;
    const toast = { error: vi.fn() };
    const { result } = renderHook(() => {
      renders++;
      return useEditorPersistence({
        toast: toast as unknown as Parameters<typeof useEditorPersistence>[0]['toast'],
      });
    });
    const before = renders;
    act(() => {
      result.current.setSaveStatus('saving');
      result.current.setSaveStatus('saved');
      result.current.setSavedAt(1);
      result.current.setSavedAt((t) => (t ?? 0) + 1);
    });
    expect(renders).toBe(before);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
