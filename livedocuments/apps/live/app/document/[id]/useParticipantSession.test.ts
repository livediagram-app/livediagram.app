// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@livedocuments/document';
import { HELD_BACK_NOTICE, useParticipantSession } from './useParticipantSession';

// A Participant's commit guard (docs/specs/013-workspace/share-roles.md; blueprint "Editor state"): text only.
const box = { x: 0, y: 0, width: 10, height: 10 };
const tab = (elements: unknown[]): Tab => ({ id: 't', name: 'T', elements }) as Tab;
const note = { id: 'a', type: 'sticky', ...box, label: 'Hi' };

describe('useParticipantSession', () => {
  it('lets an Editor commit anything, untouched', () => {
    const { result } = renderHook(() => useParticipantSession('edit'));
    const after = tab([]);
    expect(result.current.guardCommit(tab([note]), after)).toBe(after);
  });

  it("lets a Participant's words through, and holds back the rest with one notice", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useParticipantSession('participate', notify));
    const written = tab([{ ...note, label: 'Hello' }]);
    expect(result.current.guardCommit(tab([note]), written)).toBe(written);
    // An add, a move and a delete, in a burst: held back, with one notice.
    expect(result.current.guardCommit(tab([note]), tab([note, { ...note, id: 'n' }]))).toBeNull();
    expect(result.current.guardCommit(tab([note]), tab([{ ...note, x: 50 }]))).toBeNull();
    expect(result.current.guardCommit(tab([note]), tab([]))).toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(HELD_BACK_NOTICE);
  });
});
