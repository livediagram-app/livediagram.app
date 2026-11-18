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
  it('steps an edit session, owner or edit-link visitor, between Editing and Participating (no Viewing)', () => {
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
    expect(result.current.previewLevel).toBe('edit');
    expect(result.current.viewPreview).toBe(false);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  // The key pins its notes on a Notice Board; an add is refused it as the room refuses a real Participant's
  // (docs/specs/013-workspace/share-roles.md "A Participant walks").
  it("gives the Participant preview a key of its own, of the room's shape, that adds nothing", async () => {
    const { previewAdderKey } = await import('./useViewPreview');
    const { applyParticipantOp, createSticky } = await import('@livehuddle/document');
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
    expect(added.result).toBe('refused');
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

  // One answer to "may this person edit?", read by the editor and the mode switch alike
  // (docs/specs/007-editor/editor-modes.md "The mode switch").
  it('says whether the person may edit: an edit session not previewing', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const edit = renderHook(() => useViewPreview('edit', vi.fn()));
    expect(edit.result.current.canEdit).toBe(true);
    act(() => edit.result.current.toggleViewPreview());
    expect(edit.result.current.canEdit).toBe(false);
    // Participating steps back to Editing (no Viewing step).
    act(() => edit.result.current.toggleViewPreview());
    expect(edit.result.current.canEdit).toBe(true);
    expect(renderHook(() => useViewPreview('view', vi.fn())).result.current.canEdit).toBe(false);
  });
});

// The Editing Mode button (docs/specs/007-editor/editor-app.md#role-pill, Work Tracker 1291): no Viewer step, so an
// Editor steps Editor and Participant, and a Participant (or a legacy Viewer) has one mode.
describe('useViewPreview modes', () => {
  it('offers an Editor two modes and a Participant or a legacy Viewer one', () => {
    expect(renderHook(() => useViewPreview('edit', vi.fn())).result.current.previewModes).toEqual([
      'edit',
      'participate',
    ]);
    const participant = renderHook(() => useViewPreview('participate', vi.fn()));
    expect(participant.result.current.previewModes).toEqual(['participate']);
    act(() => participant.result.current.toggleViewPreview());
    act(() => participant.result.current.setViewPreview('view'));
    expect(participant.result.current.previewLevel).toBe('participate');
    expect(renderHook(() => useViewPreview('view', vi.fn())).result.current.previewModes).toEqual([
      'view',
    ]);
  });

  it('picks a level straight, and ignores the one in force and one the session may not take', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const onEnter = vi.fn();
    const { result } = renderHook(() => useViewPreview('edit', onEnter));
    act(() => result.current.setViewPreview('edit'));
    expect(onEnter).not.toHaveBeenCalled();
    act(() => result.current.setViewPreview('view'));
    expect(result.current.previewLevel).toBe('edit');
    act(() => result.current.setViewPreview('participate'));
    expect(result.current.previewLevel).toBe('participate');
    act(() => result.current.setViewPreview('edit'));
    expect(result.current.previewLevel).toBe('edit');
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('falls back to the session role when the role narrows under a preview', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { result, rerender } = renderHook(
      ({ role }: { role: 'edit' | 'participate' | 'view' }) => useViewPreview(role, vi.fn()),
      { initialProps: { role: 'edit' } },
    );
    act(() => result.current.setViewPreview('participate'));
    rerender({ role: 'view' });
    expect(result.current.previewLevel).toBe('view');
    expect(result.current.viewPreview).toBe(false);
  });
});
