// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const { useEditorComments } = await import('./useEditorComments');

// The hook owns the Comment telemetry (docs/specs/017-telemetry/telemetry.md) so the anchored popover and
// the Comment panel (docs/specs/012-collaboration/comment-pin.md) both count, once each. The delta sink is a
// spy: the emits are under test here, plus which delta each action sends.
const applyElementDelta = vi.fn();
function setup() {
  return renderHook(() =>
    useEditorComments({
      applyElementDelta,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' },
    }),
  );
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useEditorComments telemetry', () => {
  beforeEach(() => {
    trackMock.mockReset();
    applyElementDelta.mockReset();
  });

  // docs/specs/012-collaboration/collab-race-hardening.md: every thread change is ONE delta, so two replies at once both
  // land instead of the whole thread riding a whole-element update.
  it('sends each thread change as its own delta', () => {
    const { result } = setup();
    let id = '';
    act(() => {
      id = result.current.addComment('el', 'hi');
      result.current.deleteComment('el', 'c1');
      result.current.resolveThread('el');
      result.current.replaceCommentId('el', 'a', 'b');
    });
    expect(applyElementDelta.mock.calls.map((c) => [c[0], c[1].kind])).toEqual([
      ['el', 'comment-add'],
      ['el', 'comment-remove'],
      ['el', 'comment-resolve'],
      ['el', 'comment-rekey'],
    ]);
    expect(applyElementDelta.mock.calls[0]![1].comment).toMatchObject({ id, text: 'hi' });
  });

  it('counts a local add, delete, resolve and unresolve once each', () => {
    const { result } = setup();
    act(() => {
      result.current.addComment('el', 'hi');
      result.current.deleteComment('el', 'c1');
      result.current.resolveThread('el');
      result.current.unresolveThread('el');
    });
    expect(trackMock.mock.calls).toEqual([
      ['Comment', 'Added'],
      ['Comment', 'Deleted'],
      ['Comment', 'Resolved'],
      ['Comment', 'Unresolved'],
    ]);
  });

  it('counts a persisted add only once the server accepted it', async () => {
    const { result } = setup();
    let accept: (v: { id: string }) => void = () => {};
    const persist = vi.fn(() => new Promise<{ id: string }>((r) => (accept = r)));
    act(() => {
      result.current.addComment('el', 'hi', persist);
    });
    expect(persist).toHaveBeenCalledOnce();
    expect(trackMock).not.toHaveBeenCalled();
    await act(async () => {
      accept({ id: 'server-id' });
      await flush();
    });
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Comment', 'Added');
  });

  it('does not count a persisted add or delete the server refused', async () => {
    const { result } = setup();
    await act(async () => {
      result.current.addComment('el', 'hi', () => Promise.reject(new Error('403')));
      result.current.deleteComment('el', 'c1', () => Promise.reject(new Error('403')));
      await flush();
    });
    expect(trackMock).not.toHaveBeenCalled();
  });

  // docs/specs/024-agents/agent-presence.md "Comments": a session that may comment but not edit resolves and
  // reopens through the comment endpoints.
  it('counts a persisted resolve once the server took it, and puts a refused one back', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = setup();
    act(() => {
      result.current.resolveThread('el', () => Promise.resolve());
      result.current.unresolveThread('el', () => Promise.reject(new Error('403')));
    });
    expect(trackMock).not.toHaveBeenCalled();
    await act(flush);
    expect(trackMock.mock.calls).toEqual([['Comment', 'Resolved']]);
    expect(applyElementDelta.mock.calls.map((c) => c[1].resolved)).toEqual([true, false, true]);
    expect(warn).toHaveBeenCalledWith('[comments] thread state not saved', {
      resolved: false,
      error: 'Error: 403',
    });
    warn.mockRestore();
  });
});

// docs/specs/025-community/community.md "Viewing a post's document": a Community visitor has no comments.
describe('useEditorComments with comments off', () => {
  it('opens no thread and adds nothing', async () => {
    trackMock.mockReset();
    applyElementDelta.mockReset();
    const persist = vi.fn();
    const { result } = renderHook(() =>
      useEditorComments({
        applyElementDelta,
        selfParticipant: { id: 'me', name: 'Me', color: '#000' },
        commentsOff: true,
      }),
    );
    act(() => result.current.openComments('e1'));
    expect(result.current.commentThreadOpenId).toBeNull();
    let id = 'unset';
    act(() => {
      id = result.current.addComment('e1', 'Hello', persist);
    });
    await flush();
    expect(id).toBe('');
    expect(applyElementDelta).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
