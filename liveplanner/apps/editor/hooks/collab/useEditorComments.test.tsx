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
    expect(applyElementDelta.mock.calls).toMatchObject([
      ['el', { kind: 'comment-add', comment: { id, text: 'hi' } }],
      ['el', { kind: 'comment-remove' }],
      ['el', { kind: 'comment-resolve' }],
      ['el', { kind: 'comment-rekey' }],
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
    expect(applyElementDelta.mock.calls).toMatchObject([
      ['el', { resolved: true }],
      ['el', { resolved: false }],
      ['el', { resolved: true }],
    ]);
    expect(warn).toHaveBeenCalledWith('[comments] thread state not saved', {
      resolved: false,
      error: 'Error: 403',
    });
    warn.mockRestore();
  });
});

// A Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments"): every change names the cell, and opening
// one is its own toggle beside the element's.
describe('useEditorComments on a Sheet cell', () => {
  beforeEach(() => {
    trackMock.mockReset();
    applyElementDelta.mockReset();
  });

  it('opens and toggles a cell thread apart from the element thread', () => {
    const { result } = setup();
    act(() => result.current.openComments('sheet', 'r1:c1'));
    expect([result.current.commentThreadOpenId, result.current.commentThreadOpenCell]).toEqual([
      'sheet',
      'r1:c1',
    ]);
    act(() => result.current.openComments('sheet'));
    expect(result.current.commentThreadOpenCell).toBeNull();
    act(() => result.current.openComments('sheet'));
    expect(result.current.commentThreadOpenId).toBeNull();
    expect(trackMock.mock.calls.filter((c) => c[1] === 'Opened')).toHaveLength(2);
  });

  it('names the cell on an add and a resolve, and on the revert of a refused resolve', async () => {
    const { result } = setup();
    act(() => {
      result.current.addComment('sheet', 'hi', undefined, undefined, 'r1:c1');
      result.current.resolveThread('sheet', () => Promise.reject(new Error('no')), 'r1:c1');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(flush);
    expect(applyElementDelta.mock.calls).toMatchObject([
      ['sheet', { kind: 'comment-add', cell: 'r1:c1' }],
      ['sheet', { kind: 'comment-resolve', cell: 'r1:c1', resolved: true }],
      ['sheet', { kind: 'comment-resolve', cell: 'r1:c1', resolved: false }],
    ]);
    expect(applyElementDelta.mock.calls[0]![1]).toEqual(
      expect.not.objectContaining({ resolved: expect.anything() }),
    );
  });
});
