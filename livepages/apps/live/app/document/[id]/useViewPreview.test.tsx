// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useViewPreview } from './useViewPreview';

// The role pill's toggle (docs/specs/007-editor/live-app.md#role-pill): anyone whose role allows
// editing (the owner, or a visitor on an edit link) may preview read-only; a
// view-link visitor may not.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useViewPreview', () => {
  it('steps an edit session, owner or edit-link visitor, through Participating and Viewing and back', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const onEnter = vi.fn();
    const { result } = renderHook(() => useViewPreview('edit', onEnter));
    expect(result.current.canToggleRole).toBe(true);
    expect(result.current.previewLevel).toBe('edit');
    act(() => result.current.toggleViewPreview());
    expect(result.current.previewLevel).toBe('participate');
    expect(result.current.viewPreview).toBe(true);
    expect(onEnter).toHaveBeenCalledTimes(1);
    act(() => result.current.toggleViewPreview());
    expect(result.current.previewLevel).toBe('view');
    expect(onEnter).toHaveBeenCalledTimes(2);
    act(() => result.current.toggleViewPreview());
    expect(result.current.previewLevel).toBe('edit');
    expect(result.current.viewPreview).toBe(false);
    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it('gives the Participant preview a key of its own, shaped so the Participant rule takes its adds', async () => {
    const { previewAdderKey } = await import('./useViewPreview');
    const { applyParticipantOp, createSticky } = await import('@livepages/document');
    const key = previewAdderKey();
    // A random key of the room's shape, the same for the whole visit, and nothing of the person's id in it.
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(previewAdderKey()).toBe(key);
    const sticky = createSticky(0, 0);
    const added = applyParticipantOp(
      { id: 't', name: 'T', elements: [] },
      { kind: 'add', element: sticky, at: 0 },
      key,
    );
    expect(added.result).toBe('applied');
  });

  it('gives a view-link visitor no toggle', () => {
    const onEnter = vi.fn();
    const { result } = renderHook(() => useViewPreview('view', onEnter));
    expect(result.current.canToggleRole).toBe(false);
    act(() => result.current.toggleViewPreview());
    expect(result.current.viewPreview).toBe(false);
    expect(result.current.previewLevel).toBe('view');
    expect(onEnter).not.toHaveBeenCalled();
  });

  // One answer to "may this person edit?", read by the editor.
  it('says whether the person may edit: an edit session not previewing', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const edit = renderHook(() => useViewPreview('edit', vi.fn()));
    expect(edit.result.current.canEdit).toBe(true);
    act(() => edit.result.current.toggleViewPreview());
    expect(edit.result.current.canEdit).toBe(false);
    act(() => edit.result.current.toggleViewPreview());
    expect(edit.result.current.canEdit).toBe(false);
    expect(renderHook(() => useViewPreview('view', vi.fn())).result.current.canEdit).toBe(false);
  });
});
