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
  it('lets an edit session, owner or edit-link visitor, switch to viewing and back', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const onEnter = vi.fn();
    const { result } = renderHook(() => useViewPreview('edit', onEnter));
    expect(result.current.canToggleRole).toBe(true);
    act(() => result.current.toggleViewPreview());
    expect(result.current.viewPreview).toBe(true);
    expect(onEnter).toHaveBeenCalledTimes(1);
    act(() => result.current.toggleViewPreview());
    expect(result.current.viewPreview).toBe(false);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('gives a view-link visitor no toggle', () => {
    const onEnter = vi.fn();
    const { result } = renderHook(() => useViewPreview('view', onEnter));
    expect(result.current.canToggleRole).toBe(false);
    act(() => result.current.toggleViewPreview());
    expect(result.current.viewPreview).toBe(false);
    expect(onEnter).not.toHaveBeenCalled();
  });

  // One answer to "may this person edit?", read by the editor and the tab bar's mode switch alike
  // (docs/specs/007-editor/editor-modes.md "The mode switch").
  it('says whether the person may edit: an edit session not previewing', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const edit = renderHook(() => useViewPreview('edit', vi.fn()));
    expect(edit.result.current.canEdit).toBe(true);
    act(() => edit.result.current.toggleViewPreview());
    expect(edit.result.current.canEdit).toBe(false);
    expect(renderHook(() => useViewPreview('view', vi.fn())).result.current.canEdit).toBe(false);
  });
});
