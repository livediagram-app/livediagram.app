import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsRequest } from '../request';
import { bearerAccountSecurity, signInReturnUrl } from './bearer-security';

// Sign-in and devices over the account API's bearer door (liveworkspace/docs/specs/010-site/site.md "Settings",
// "Profile"): what an editor and an app's Explorer draw in place, each call on the door's own routes.

type Answer = { ok: true; data: unknown } | { ok: false; status: number; error: string };

function door(answers: Record<string, Answer>) {
  const calls: [string, string | undefined, unknown][] = [];
  const request = vi.fn(async (path: string, method?: string, body?: unknown) => {
    calls.push([path, method, body]);
    return answers[`${method ?? 'GET'} ${path}`] ?? { ok: false, status: 404, error: 'not_found' };
  }) as unknown as SettingsRequest;
  return { request, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('bearerAccountSecurity', () => {
  it('lists the sessions, revoking one by its id', async () => {
    const { request, calls } = door({
      'GET /sessions': {
        ok: true,
        data: {
          sessions: [
            {
              id: 's1',
              current: true,
              userAgent: 'Chrome/120',
              createdAt: '2026-11-01T10:00:00.000Z',
              updatedAt: '2026-11-02T10:00:00.000Z',
            },
            { id: 's 2', current: false, userAgent: null, createdAt: 1_790_000_000_000 },
          ],
        },
      },
      'DELETE /sessions/s%202': { ok: true, data: { id: 's 2' } },
    });
    const security = bearerAccountSecurity(request, { settingsParam: 'account:account' });
    const sessions = await security.sessions();
    expect(sessions).toEqual([
      {
        id: 's1',
        token: 's1',
        current: true,
        userAgent: 'Chrome/120',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-02T10:00:00.000Z',
      },
      {
        id: 's 2',
        token: 's 2',
        current: false,
        userAgent: null,
        createdAt: new Date(1_790_000_000_000).toISOString(),
        updatedAt: new Date(1_790_000_000_000).toISOString(),
      },
    ]);
    expect(await security.revokeSession(sessions![1]!.token)).toBe(true);
    expect(calls.at(-1)).toEqual(['/sessions/s%202', 'DELETE', undefined]);
  });

  it('answers null for a refused or malformed list, and signs out the others in one call', async () => {
    const { request, calls } = door({
      'GET /sessions': { ok: true, data: {} },
      'POST /sessions/revoke-others': { ok: true, data: { ended: 2 } },
    });
    const security = bearerAccountSecurity(request, { settingsParam: 'account:account' });
    expect(await security.sessions()).toBeNull();
    expect(await security.revokeOtherSessions?.()).toBe(true);
    expect(calls.at(-1)).toEqual(['/sessions/revoke-others', 'POST', {}]);
    const refused = bearerAccountSecurity(door({}).request, { settingsParam: 'x' });
    expect(await refused.sessions()).toBeNull();
    expect(await refused.revokeOtherSessions?.()).toBe(false);
  });

  it('reads the sign-in methods, refusing an answer it does not know', async () => {
    const ok = door({ 'GET /sign-in-methods': { ok: true, data: { google: 'available' } } });
    expect(await bearerAccountSecurity(ok.request, { settingsParam: 'x' }).signInMethods()).toEqual(
      { google: 'available' },
    );
    const odd = door({ 'GET /sign-in-methods': { ok: true, data: { google: 'maybe' } } });
    expect(
      await bearerAccountSecurity(odd.request, { settingsParam: 'x' }).signInMethods(),
    ).toBeNull();
    expect(
      await bearerAccountSecurity(door({}).request, { settingsParam: 'x' }).signInMethods(),
    ).toBeNull();
  });

  it('connects Google with a full way back that reopens Settings, and leaves for Google', async () => {
    window.history.replaceState(null, '', '/document/d1?settings=privacy&section=x&error=old&q=1');
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, href: window.location.href, assign });
    const { request, calls } = door({
      'POST /sign-in-methods/google': { ok: true, data: { url: 'https://accounts.google.com/o' } },
    });
    expect(
      await bearerAccountSecurity(request, { settingsParam: 'account:account' }).connectGoogle(),
    ).toBe(true);
    expect(calls[0]).toEqual([
      '/sign-in-methods/google',
      'POST',
      { callbackURL: 'http://localhost:3000/document/d1?settings=account%3Aaccount&q=1' },
    ]);
    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o');
  });

  it('stays put when the door refuses to start the link', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, href: window.location.href, assign });
    const { request } = door({
      'POST /sign-in-methods/google': { ok: false, status: 409, error: 'google_off' },
    });
    expect(await bearerAccountSecurity(request, { settingsParam: 'x' }).connectGoogle()).toBe(
      false,
    );
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('signInReturnUrl', () => {
  it('keeps the page and its other parameters, naming the Settings category to reopen', () => {
    expect(
      signInReturnUrl('https://www.livediagram.app/document/a?section=s&b=1#h', 'account:account'),
    ).toBe('https://www.livediagram.app/document/a?b=1&settings=account%3Aaccount#h');
  });
});
