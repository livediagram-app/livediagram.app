// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_TOKEN_URL } from '@/lib/explorer/token';

// Sign Out from the Explorer on liveworkspace.app (liveworkspace/docs/specs/003-accounts/accounts.md "From the
// Explorer", Work Tracker 1443). 2026-11-25 on staging: after POST /api/auth/sign-out the Explorer asked
// GET /api/auth/workspace-token again, got a guest's token and reloaded the team's page as that new guest
// (items?team=… 403, "Sign In to Use Teams"). Now it leaves for the signed-out home page and asks nothing more.

const ACCOUNT = {
  token: 'h.eyJzdWIiOiJ1c2VyX2FkYSJ9.s',
  kind: 'account',
  sub: 'user_ada',
  expiresAt: Date.now() + 15 * 60_000,
};

let requests: string[];

beforeEach(() => {
  // The session and the token are each asked once per page: every test is a fresh page.
  vi.resetModules();
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      requests.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/get-session')) return Response.json({ user: { name: 'Ada Lovelace' } });
      if (url === WORKSPACE_TOKEN_URL) return Response.json(ACCOUNT);
      if (url.endsWith('/sign-out')) return Response.json({ success: true });
      return Response.json({}, { status: 404 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function mountExplorer() {
  const { signOut, useSession } = await import('@/lib/session');
  const { useExplorerIdentity } = await import('./useExplorerIdentity');
  const leave = vi.fn();
  const hook = renderHook(() => {
    const session = useSession();
    return {
      session: session.state,
      ...useExplorerIdentity({ ready: true, sessionState: session.state, leave }),
    };
  });
  // Signed in, and known as the account.
  await waitFor(() => {
    expect(hook.result.current.session).toBe('in');
    expect(hook.result.current.identity?.kind).toBe('account');
  });
  return { hook, leave, signOut };
}

describe('Sign Out from the Explorer', () => {
  it('leaves for the signed-out home page, asking for no token and nothing of the index after', async () => {
    const { hook, leave, signOut } = await mountExplorer();
    expect(requests.filter((r) => r === `GET ${WORKSPACE_TOKEN_URL}`)).toHaveLength(1);

    const before = requests.length;
    await act(async () => {
      expect(await signOut()).toBe(true);
    });

    const after = requests.slice(before);
    // The sign-out itself, and nothing else: no workspace token (so no guest made), no index request.
    expect(after).toHaveLength(1);
    expect(after[0]).toMatch(/^POST .*\/sign-out$/);
    expect(leave).toHaveBeenCalledExactlyOnceWith('/');
    // The old account's teams and items go from the page while it leaves (the Explorer draws its skeleton).
    expect(hook.result.current.identity).toBeNull();
    expect(hook.result.current.failed).toBe(false);

    // Nothing asks again while the page goes, not even Try Again.
    act(() => hook.result.current.retry());
    await act(async () => {});
    expect(requests.slice(before)).toHaveLength(1);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('stays put when the sign-out is refused', async () => {
    const { hook, leave, signOut } = await mountExplorer();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 500 }));
    await act(async () => {
      expect(await signOut()).toBe(false);
    });
    expect(leave).not.toHaveBeenCalled();
    expect(hook.result.current.identity?.kind).toBe('account');
  });
});
