// @vitest-environment jsdom

// docs/specs/006-design/save-locations.md "The default depends on who is creating": /new stores a guest's
// design on This Browser, a signed-in person's on livedesign, and never makes a signed-in person's
// create This Browser because sign-in had not answered yet.

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useNewDesignLocation } from './useNewDesignLocation';

function setHint(signedIn: boolean) {
  document.cookie = signedIn
    ? 'ldes_signed_in=1'
    : 'ldes_signed_in=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

type Props = { authLoaded: boolean; sessionAnswered?: boolean; accountUserId: string | null };
const render = (initial: Props) =>
  renderHook((p: Props) => useNewDesignLocation(p), { initialProps: initial });

describe('useNewDesignLocation', () => {
  afterEach(() => {
    setHint(false);
  });

  describe('resolveSaveLocation', () => {
    it('keeps a signed-in person on livedesign', async () => {
      const { result } = render({ authLoaded: true, accountUserId: 'user_1' });
      await expect(result.current.resolveSaveLocation(false, vi.fn())).resolves.toBe('livedesign');
    });

    it('answers a guest at once, without waiting for identity', async () => {
      const settle = vi.fn(() => new Promise<void>(() => {}));
      const { result } = render({ authLoaded: false, accountUserId: null });
      await expect(result.current.resolveSaveLocation(false, settle)).resolves.toBe('browser');
      expect(settle).not.toHaveBeenCalled();
    });

    it('waits for identity when the browser looks signed in, then reads the settled answer', async () => {
      setHint(true);
      const hook = render({ authLoaded: false, accountUserId: null });
      const settle = vi.fn(async () => {
        hook.rerender({ authLoaded: true, accountUserId: 'user_1' });
      });
      await expect(hook.result.current.resolveSaveLocation(false, settle)).resolves.toBe(
        'livedesign',
      );
      expect(settle).toHaveBeenCalledOnce();
    });

    it('makes a guest This Browser when the hint was stale', async () => {
      setHint(true);
      const hook = render({ authLoaded: false, accountUserId: null });
      const settle = async () => hook.rerender({ authLoaded: true, accountUserId: null });
      await expect(hook.result.current.resolveSaveLocation(false, settle)).resolves.toBe('browser');
    });

    it('waits past the 5 s give-up for a slow session, so a signed-in person still saves on livedesign', async () => {
      setHint(true);
      // The page gave up on sign-in: authLoaded with no one in it, the session not yet answered.
      const hook = render({ authLoaded: true, sessionAnswered: false, accountUserId: null });
      const pending = hook.result.current.resolveSaveLocation(false, vi.fn());
      await new Promise((r) => setTimeout(r, 250));
      hook.rerender({ authLoaded: true, sessionAnswered: true, accountUserId: 'user_1' });
      await expect(pending).resolves.toBe('livedesign');
    });

    it('keeps a folder or team link on livedesign', async () => {
      const { result } = render({ authLoaded: false, accountUserId: null });
      await expect(result.current.resolveSaveLocation(true, vi.fn())).resolves.toBe('livedesign');
    });
  });
});
