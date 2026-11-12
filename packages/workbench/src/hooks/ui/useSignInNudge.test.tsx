// @vitest-environment jsdom
// The editor's guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md): five minutes into a guest's
// session, never for an account, an embed or once dismissed, and hidden (not restarted) while `hidden`.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignInNudge } from './useSignInNudge';

const KEY = 'test:signin-dismissed';
const FIVE_MINUTES = 5 * 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

type Props = { accountUserId: string | null; appChrome: boolean; hidden: boolean };
const guest: Props = { accountUserId: null, appChrome: true, hidden: false };
const render = (initialProps: Props) =>
  renderHook((p: Props) => useSignInNudge({ dismissKey: KEY, ...p }), { initialProps });

describe('useSignInNudge', () => {
  it("shows a guest's nudge after five minutes, hides it while hidden without restarting, and dismisses it", () => {
    const { result, rerender } = render(guest);
    act(() => void vi.advanceTimersByTime(FIVE_MINUTES - 1));
    expect(result.current.showSignInBanner).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.showSignInBanner).toBe(true);
    rerender({ ...guest, hidden: true });
    expect(result.current.showSignInBanner).toBe(false);
    rerender(guest);
    expect(result.current.showSignInBanner).toBe(true);
    act(() => result.current.dismissSignIn());
    expect(result.current.showSignInBanner).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('never shows for an account or in an embed', () => {
    for (const props of [
      { ...guest, accountUserId: 'u1' },
      { ...guest, appChrome: false },
    ]) {
      const { result } = render(props);
      act(() => void vi.advanceTimersByTime(FIVE_MINUTES));
      expect(result.current.showSignInBanner).toBe(false);
    }
  });
});
