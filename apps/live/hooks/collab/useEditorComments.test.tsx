// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const { useEditorComments } = await import('./useEditorComments');

// The hook owns the Comment telemetry (spec/22) so the anchored popover and
// the Comment panel (spec/136) both count, once each. `tickTabs` is a no-op
// here: the emits are what's under test, not the thread mutation.
function setup() {
  return renderHook(() =>
    useEditorComments({
      activeId: 'tab-1',
      tickTabs: () => {},
      selfParticipant: { id: 'me', name: 'Me', color: '#000' },
    }),
  );
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useEditorComments telemetry', () => {
  beforeEach(() => trackMock.mockReset());

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
});
