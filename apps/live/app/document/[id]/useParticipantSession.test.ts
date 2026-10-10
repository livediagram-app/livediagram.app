// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Tab } from '@livediagram/document';
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

  it("stamps a Participant's add once its key is held, and holds back the rest with one notice", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useParticipantSession('participate', notify));
    const added = tab([theirs, { id: 'n', type: 'sticky', ...box }]);
    // No key yet: an add is held back.
    expect(result.current.guardCommit(tab([theirs]), added)).toBeNull();
    act(() => result.current.setAdderKey('a'.repeat(32)));
    expect(result.current.guardCommit(tab([theirs]), added)?.elements[1]).toMatchObject({
      addedBy: 'a'.repeat(32),
    });
    // Deleting someone else's sticky, twice in a burst: one notice.
    expect(result.current.guardCommit(tab([theirs]), tab([]))).toBeNull();
    expect(result.current.guardCommit(tab([theirs]), tab([]))).toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(HELD_BACK_NOTICE);
  });
});
