// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useViewPreview } from './useViewPreview';

// The role pill's toggle (docs/specs/007-editor/editor-app.md#role-pill): anyone whose role allows
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
