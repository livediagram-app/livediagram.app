// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Tab } from '@livehuddle/document';
import { HELD_BACK_NOTICE, useParticipantSession } from './useParticipantSession';

// A Participant's commit guard (docs/specs/013-workspace/share-roles.md; blueprint "Editor state").
const box = { x: 0, y: 0, width: 10, height: 10 };
const tab = (elements: unknown[]): Tab => ({ id: 't', name: 'T', elements }) as Tab;
const theirs = { id: 'a', type: 'sticky', ...box, addedBy: 'b'.repeat(32) };

describe('useParticipantSession', () => {
  it('lets an Editor commit anything, untouched', () => {
    const { result } = renderHook(() => useParticipantSession('edit'));
    const after = tab([]);
    expect(result.current.guardCommit(tab([theirs]), after)).toBe(after);
    expect(result.current.can.remove(theirs as never)).toBe(true);
  });

  // docs/specs/013-workspace/share-roles.md "A Participant walks": no add, write, move or delete lands, with a key or
  // without, its own earlier sticky included; a burst says so once.
  it("holds back a Participant's add and delete with one notice, its key held or not", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useParticipantSession('participate', notify));
    const added = tab([theirs, { id: 'n', type: 'sticky', ...box }]);
    expect(result.current.guardCommit(tab([theirs]), added)).toBeNull();
    act(() => result.current.setAdderKey('a'.repeat(32)));
    expect(result.current.guardCommit(tab([theirs]), added)).toBeNull();
    const mine = { ...theirs, addedBy: 'a'.repeat(32) };
    expect(result.current.guardCommit(tab([mine]), tab([]))).toBeNull();
    expect(result.current.guardCommit(tab([theirs]), tab([]))).toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(HELD_BACK_NOTICE);
  });

  it("lets a Participant's door swing through", () => {
    const { result } = renderHook(() => useParticipantSession('participate'));
    const door = { id: 'd', type: 'shape', shape: 'door', ...box, doorClosed: true };
    const swung = tab([{ ...door, doorClosed: false }]);
    expect(result.current.guardCommit(tab([door]), swung)?.elements[0]).toMatchObject({
      doorClosed: false,
    });
  });

  // An Editor previewing as a Participant (docs/specs/007-editor/editor-app.md#role-pill): no key from the room, so the
  // preview's own; a room key, once held, wins. The key still adds nothing.
  it('takes the preview key while the room gives none', () => {
    const { result } = renderHook(() =>
      useParticipantSession('participate', undefined, 'preview-p1'),
    );
    expect(result.current.adderKey).toBe('preview-p1');
    expect(result.current.can.addContent).toBe(false);
    expect(result.current.can.alwaysWalks).toBe(true);
    act(() => result.current.setAdderKey('a'.repeat(32)));
    expect(result.current.adderKey).toBe('a'.repeat(32));
  });
});
