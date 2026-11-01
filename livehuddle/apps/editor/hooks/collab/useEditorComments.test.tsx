// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof trackMock>) => trackMock(...args),
}));

const { useEditorComments } = await import('./useEditorComments');

// The hook owns the Comment telemetry (docs/specs/017-telemetry/telemetry.md) so the anchored popover and
// the Comment panel (docs/specs/012-collaboration/comment-pin.md) both count, once each. The delta sink is a
// spy: the emits are under test here, plus which delta each action sends.
const applyElementDelta = vi.fn();
function setup() {
  return renderHook(
    ({ tab }: { tab: string }) =>
      useEditorComments({
        applyElementDelta,
        activeTabId: tab,
        selfParticipant: { id: 'me', name: 'Me', color: '#000' },
      }),
    { initialProps: { tab: 't1' } },
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
    expect(applyElementDelta.mock.calls).toMatchObject([
      ['el', { kind: 'comment-add', comment: { id, text: 'hi' } }, 't1'],
      ['el', { kind: 'comment-remove' }, 't1'],
      ['el', { kind: 'comment-resolve' }, 't1'],
      ['el', { kind: 'comment-rekey' }, 't1'],
    ]);
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = setup();
    await act(async () => {
      result.current.addComment('el', 'hi', () => Promise.reject(new Error('403')));
      result.current.deleteComment('el', 'c1', () => Promise.reject(new Error('403')));
      await flush();
    });
    expect(trackMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('takes back a persisted add the server refused, so it never reads as posted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = setup();
    let id = '';
    await act(async () => {
      id = result.current.addComment('el', 'hi', () => Promise.reject(new Error('403')));
      await flush();
    });
    expect(applyElementDelta.mock.calls).toMatchObject([
      ['el', { kind: 'comment-add', comment: { id } }, 't1'],
      ['el', { kind: 'comment-remove', commentId: id }, 't1'],
    ]);
    expect(warn).toHaveBeenCalledWith('[comments] comment not saved', { error: 'Error: 403' });
    warn.mockRestore();
  });

  // docs/specs/012-collaboration/comment-pin.md: a Participant's delete the server refused goes back where it was,
  // as a refused post or resolve does, rather than staying gone on this screen until a reload.
  it('puts back a persisted delete the server refused, in its place, the thread still resolved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = setup();
    const at = (id: string) => ({
      id,
      text: id,
      authorId: 'me',
      authorName: 'Me',
      authorColor: '#000',
      createdAt: 1,
    });
    const thread = { comments: [at('c1'), at('c2'), at('c3')], resolved: true };
    await act(async () => {
      result.current.deleteComment('el', 'c2', () => Promise.reject(new Error('403')), thread);
      await flush();
    });
    expect(applyElementDelta.mock.calls).toEqual([
      ['el', { kind: 'comment-remove', commentId: 'c2' }, 't1'],
      ['el', { kind: 'comment-add', comment: thread.comments[1], before: 'c3' }, 't1'],
      ['el', { kind: 'comment-resolve', resolved: true }, 't1'],
    ]);
    expect(warn).toHaveBeenCalledWith('[comments] comment delete not saved', {
      error: 'Error: 403',
    });
    warn.mockRestore();
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
    expect(applyElementDelta.mock.calls).toMatchObject([
      ['el', { resolved: true }, 't1'],
      ['el', { resolved: false }, 't1'],
      ['el', { resolved: true }, 't1'],
    ]);
    expect(warn).toHaveBeenCalledWith('[comments] thread state not saved', {
      resolved: false,
      error: 'Error: 403',
    });
    warn.mockRestore();
  });
});

// A refused write goes back onto the tab its comment is on, not whichever tab is active by the time the server
// answers (docs/specs/012-collaboration/comment-pin.md).
describe('useEditorComments across a tab switch', () => {
  beforeEach(() => {
    trackMock.mockReset();
    applyElementDelta.mockReset();
  });

  const pending = () => {
    let settle: { accept: (v?: unknown) => void; refuse: (e: Error) => void } = {
      accept: () => {},
      refuse: () => {},
    };
    const promise = new Promise<unknown>((accept, refuse) => (settle = { accept, refuse }));
    return { promise, settle };
  };

  it('takes back a refused post, a refused delete and a refused resolve on the tab they began on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result, rerender } = setup();
    const add = pending();
    const del = pending();
    const resolve = pending();
    const comment = {
      id: 'c1',
      text: 'c1',
      authorId: 'me',
      authorName: 'Me',
      authorColor: '#000',
      createdAt: 1,
    };
    let id = '';
    act(() => {
      id = result.current.addComment('el', 'hi', () => add.promise as Promise<{ id: string }>);
      result.current.deleteComment('el', 'c1', () => del.promise, {
        comments: [comment],
        resolved: false,
      });
      result.current.resolveThread('el', () => resolve.promise);
    });
    rerender({ tab: 't2' });
    await act(async () => {
      add.settle.refuse(new Error('403'));
      del.settle.refuse(new Error('403'));
      resolve.settle.refuse(new Error('403'));
      await flush();
    });
    expect(applyElementDelta.mock.calls).toEqual([
      ['el', expect.objectContaining({ kind: 'comment-add' }), 't1'],
      ['el', { kind: 'comment-remove', commentId: 'c1' }, 't1'],
      ['el', { kind: 'comment-resolve', resolved: true }, 't1'],
      ['el', { kind: 'comment-remove', commentId: id }, 't1'],
      ['el', { kind: 'comment-add', comment }, 't1'],
      ['el', { kind: 'comment-resolve', resolved: false }, 't1'],
    ]);
    warn.mockRestore();
  });

  it('adopts the server’s id for a post on the tab it began on', async () => {
    const { result, rerender } = setup();
    const add = pending();
    let id = '';
    act(() => {
      id = result.current.addComment('el', 'hi', () => add.promise as Promise<{ id: string }>);
    });
    rerender({ tab: 't2' });
    await act(async () => {
      add.settle.accept({ id: 'server-id' });
      await flush();
    });
    expect(applyElementDelta.mock.calls[1]).toEqual([
      'el',
      { kind: 'comment-rekey', from: id, to: 'server-id' },
      't1',
    ]);
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
        activeTabId: 't1',
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
