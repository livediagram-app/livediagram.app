// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFocusInvite } from './useFocusInvite';

const AT = { x: 400, y: 300 };

function setup(isAlreadyThere = () => false) {
  const onFollowTab = vi.fn();
  const onCentreOn = vi.fn();
  const hook = renderHook(() => useFocusInvite({ onFollowTab, onCentreOn, isAlreadyThere }));
  return { hook, onFollowTab, onCentreOn };
}

describe('useFocusInvite', () => {
  it('offers an invitation to somebody looking elsewhere', () => {
    const { hook } = setup();
    act(() => hook.result.current.receiveFocusHere('alex', 'tab-a', AT, 0.5));
    expect(hook.result.current.invite).toEqual({ from: 'alex', tabId: 'tab-a', at: AT, zoom: 0.5 });
  });

  it('stays silent for somebody already looking at it', () => {
    // The second press of the same button: it has to reach the people who
    // declined without putting a dialog over the people who already came.
    const { hook } = setup(() => true);
    act(() => hook.result.current.receiveFocusHere('alex', 'tab-a', AT, 0.5));
    expect(hook.result.current.invite).toBeNull();
  });

  it('takes the tab first, then the point', () => {
    const { hook, onFollowTab, onCentreOn } = setup();
    act(() => hook.result.current.receiveFocusHere('alex', 'tab-b', AT, 0.75));
    act(() => hook.result.current.acceptFocus());
    expect(onFollowTab).toHaveBeenCalledWith('tab-b');
    expect(onCentreOn).toHaveBeenCalledWith(AT, 0.75);
    // One-off: nothing stays pinned to follow.
    expect(hook.result.current.invite).toBeNull();
  });

  it('replaces an earlier invitation rather than queueing it', () => {
    const { hook } = setup();
    act(() => hook.result.current.receiveFocusHere('alex', 'tab-a', AT, 0.5));
    act(() => hook.result.current.receiveFocusHere('robin', 'tab-b', { x: 10, y: 20 }, 1));
    expect(hook.result.current.invite?.from).toBe('robin');
  });

  it('moves nobody when it is dismissed', () => {
    const { hook, onFollowTab, onCentreOn } = setup();
    act(() => hook.result.current.receiveFocusHere('alex', 'tab-a', AT, 0.5));
    act(() => hook.result.current.dismissFocus());
    expect(hook.result.current.invite).toBeNull();
    act(() => hook.result.current.acceptFocus());
    expect(onFollowTab).not.toHaveBeenCalled();
    expect(onCentreOn).not.toHaveBeenCalled();
  });

  it('expires on its own after a minute', () => {
    vi.useFakeTimers();
    try {
      const { hook } = setup();
      act(() => hook.result.current.receiveFocusHere('alex', 'tab-a', AT, 0.5));
      act(() => vi.advanceTimersByTime(60_001));
      expect(hook.result.current.invite).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
