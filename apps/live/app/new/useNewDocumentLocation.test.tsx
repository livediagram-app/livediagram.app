// @vitest-environment jsdom

// docs/specs/006-document/save-locations.md "The default depends on who is creating": /new starts a guest
// on Local Browser, a signed-in person on livediagram, and never makes a signed-in person's
// wizard-less create Local only because Clerk had not answered yet.

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({ clerkEnabled: true }));
vi.mock('@/lib/clerk-config', () => clerk);

import { useNewDocumentLocation } from './useNewDocumentLocation';

function setUat(value: string | null) {
  document.cookie =
    value === null
      ? '__client_uat=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      : `__client_uat=${value}`;
}

type Props = { authLoaded: boolean; clerkUserId: string | null; hasPlacementContext?: boolean };
const render = (initial: Props) =>
  renderHook((p: Props) => useNewDocumentLocation({ hasPlacementContext: false, ...p }), {
    initialProps: initial,
  });

describe('useNewDocumentLocation', () => {
  afterEach(() => {
    setUat(null);
    clerk.clerkEnabled = true;
  });

  it('defaults a guest to Local Browser before Clerk answers', () => {
    setUat('0');
    const { result } = render({ authLoaded: false, clerkUserId: null });
    expect(result.current.defaultLocation).toBe('browser');
  });

  it('defaults a browser that looks signed in to livediagram, then follows the settled answer', () => {
    setUat('1760000000');
    const { result, rerender } = render({ authLoaded: false, clerkUserId: null });
    expect(result.current.defaultLocation).toBe('livediagram');
    // The session had lapsed: Clerk settles signed out.
    rerender({ authLoaded: true, clerkUserId: null });
    expect(result.current.defaultLocation).toBe('browser');
  });

  it('keeps a signed-in person on livediagram', () => {
    const { result } = render({ authLoaded: true, clerkUserId: 'user_1' });
    expect(result.current.defaultLocation).toBe('livediagram');
  });

  it('uses livediagram for a folder or team context', () => {
    const { result } = render({ authLoaded: true, clerkUserId: null, hasPlacementContext: true });
    expect(result.current.defaultLocation).toBe('livediagram');
  });

  it('uses livediagram on a deployment without sign-in', () => {
    clerk.clerkEnabled = false;
    const { result } = render({ authLoaded: true, clerkUserId: null });
    expect(result.current.defaultLocation).toBe('livediagram');
  });

  describe('resolveBypassLocation', () => {
    it('answers a guest at once, without waiting for identity', async () => {
      const settle = vi.fn(() => new Promise<void>(() => {}));
      const { result } = render({ authLoaded: false, clerkUserId: null });
      await expect(result.current.resolveBypassLocation(false, settle)).resolves.toBe('browser');
      expect(settle).not.toHaveBeenCalled();
    });

    it('waits for identity when the browser looks signed in, then reads the settled answer', async () => {
      setUat('1760000000');
      const hook = render({ authLoaded: false, clerkUserId: null });
      const settle = vi.fn(async () => {
        hook.rerender({ authLoaded: true, clerkUserId: 'user_1' });
      });
      await expect(hook.result.current.resolveBypassLocation(false, settle)).resolves.toBe(
        'livediagram',
      );
      expect(settle).toHaveBeenCalledOnce();
    });

    it('makes a guest Local only when the hint was stale', async () => {
      setUat('1760000000');
      const hook = render({ authLoaded: false, clerkUserId: null });
      const settle = async () => hook.rerender({ authLoaded: true, clerkUserId: null });
      await expect(hook.result.current.resolveBypassLocation(false, settle)).resolves.toBe(
        'browser',
      );
    });

    it('keeps a folder or team link on livediagram', async () => {
      const { result } = render({ authLoaded: false, clerkUserId: null });
      await expect(result.current.resolveBypassLocation(true, vi.fn())).resolves.toBe(
        'livediagram',
      );
    });

    it('keeps everyone on livediagram without sign-in', async () => {
      clerk.clerkEnabled = false;
      const { result } = render({ authLoaded: false, clerkUserId: null });
      await expect(result.current.resolveBypassLocation(false, vi.fn())).resolves.toBe(
        'livediagram',
      );
    });
  });
});
