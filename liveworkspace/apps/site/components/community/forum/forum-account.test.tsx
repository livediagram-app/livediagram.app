// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Who writes in the Forum (liveworkspace/docs/specs/007-community/community.md "Who can do what"): on an app's address
// the app's account, on liveworkspace.app this site's; a guest's workspace token is not an account. And what a failed
// write says.

const h = vi.hoisted(() => ({
  host: null as string | null,
  app: null as { sub: string; name: string; colour: string; token: string } | null,
  session: { state: 'checking' } as
    { state: 'checking' | 'out' } | { state: 'in'; name: string; colour: string },
  identity: null as { kind: 'account' | 'guest'; token: string } | null,
}));

vi.mock('@/lib/explorer/page-app', () => ({ pageApp: () => h.host }));
vi.mock('@/lib/explorer/app-session', () => ({ appAccount: async () => h.app }));
vi.mock('@/lib/explorer/token', () => ({ workspaceIdentity: async () => h.identity }));
vi.mock('@/lib/session', () => ({ useSession: () => h.session }));

afterEach(() => {
  vi.resetModules();
  h.host = null;
  h.app = null;
  h.session = { state: 'checking' };
  h.identity = null;
});

const load = () => import('./useForumAccount');

describe('the Forum account', () => {
  it("is the app's account on its address, with the app's token", async () => {
    h.host = 'livediagram';
    h.app = { sub: 'acc1', name: 'Ada', colour: '#2563eb', token: 'app-tok' };
    const { useForumAccount, authorOf } = await load();
    const { result } = renderHook(() => useForumAccount());
    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current.status).toBe('in'));
    const account = result.current;
    if (account.status !== 'in') throw new Error('not in');
    expect(await account.getToken()).toBe('app-tok');
    expect(authorOf(account)).toEqual({ name: 'Ada', color: '#2563eb' });
  });

  it('is signed out on an app whose session is a guest', async () => {
    h.host = 'livediagram';
    const { useForumAccount } = await load();
    const { result } = renderHook(() => useForumAccount());
    await waitFor(() => expect(result.current.status).toBe('out'));
  });

  it("is this site's session on liveworkspace.app, and never a guest's token", async () => {
    const { useForumAccount, authorOf } = await load();
    const { result, rerender } = renderHook(() => useForumAccount());
    expect(result.current.status).toBe('checking');
    h.session = { state: 'out' };
    rerender();
    expect(result.current.status).toBe('out');
    h.session = { state: 'in', name: 'Bo', colour: 'var(--presence-3)' };
    rerender();
    const account = result.current;
    if (account.status !== 'in') throw new Error('not in');
    // A theme variable is sent as the colour the browser paints it, so the post matches the header's avatar.
    const painted = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ color: 'rgb(139, 92, 246)' } as CSSStyleDeclaration);
    expect(authorOf(account)).toEqual({ name: 'Bo', color: '#8b5cf6' });
    painted.mockRestore();
    h.identity = { kind: 'guest', token: 'guest-tok' };
    expect(await account.getToken()).toBeNull();
    h.identity = { kind: 'account', token: 'ws-tok' };
    expect(await account.getToken()).toBe('ws-tok');
  });
});

describe("the author's colour", () => {
  const as = (color: string | null) => ({
    status: 'in' as const,
    author: { name: 'Ada Lovelace', color },
    getToken: async () => null,
  });

  it("is the header avatar's colour: the profile's, or the one picked from the name for Automatic", async () => {
    const { authorOf } = await load();
    const { avatarColour } = await import('@liveworkspace/account-menu/initials');
    expect(authorOf(as('#0EA5E9')).color).toBe('#0ea5e9');
    expect(authorOf(as(null)).color).toBe(avatarColour('Ada Lovelace').value);
    // One the browser can't paint falls back to the name's, never to a colour the service makes up.
    // (jsdom resolves no variables: the browser's inherited answer stands in.)
    const inherited = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ color: 'rgb(1, 2, 3)' } as CSSStyleDeclaration);
    expect(authorOf(as('var(--nowhere)')).color).toBe(avatarColour('Ada Lovelace').value);
    inherited.mockRestore();
    expect(authorOf(as('url(x)')).color).toBe(avatarColour('Ada Lovelace').value);
  });
});

describe('what a failed write says', () => {
  it('names each refusal, and the connection otherwise', async () => {
    const { forumErrorText } = await import('./forum-api');
    const { CommunityApiError } = await import('../lib/api');
    const codes = [
      'rate_limited',
      'sign_in_required',
      'topic_full',
      'post_hidden',
      'invalid_title',
      'invalid_body',
      'not_found',
    ];
    const texts = codes.map((code) => forumErrorText(new CommunityApiError(400, code)));
    expect(new Set(texts).size).toBe(codes.length);
    expect(forumErrorText(new Error('offline'))).toMatch(/connection/);
  });
});
