import type { Tab } from '@liveplanner/project';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD_ID_HEADER, PROJECT_FORMAT, PROJECT_FORMAT_HEADER } from '@liveplanner/api-schema';
import { resetServerReleaseForTests, serverBuild, serverProjectFormat } from '../server-release';

// The guest token is the only identity core.ts reads besides the session's (liveworkspace/docs/one-explorer-
// contracts.md "Guests"); mock it so each case says whether there is one.
const { guest } = vi.hoisted(() => ({
  guest: {
    readGuestToken: vi.fn((): { token: string; id: string; expiresAt: number } | null => null),
  },
}));
vi.mock('../guest-token', () => guest);

import {
  API_BASE,
  ApiError,
  apiFetch,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  getLastKnownToken,
  identityHeaders,
  SESSION_TOKEN_TIMEOUT_MS,
  SessionTokenUnavailableError,
  setSessionSharePassword,
  setTokenProvider,
  setWorkbenchConfinement,
  stripUiTabFields,
  WorkbenchConfinedError,
  tabForWire,
} from './core';
import { setApiErrorReporter, setApiWarningReporter } from './error-report';

const H = (h: HeadersInit) => h as Record<string, string>;

beforeEach(() => {
  setTokenProvider(null);
  setSessionSharePassword(null);
  guest.readGuestToken.mockReturnValue(null);
});

const GUEST = { token: 'guest-jwt', id: 'guest_1', expiresAt: Date.now() + 1e9 };

describe('apiHeaders (docs/specs/014-identity/auth-and-guest-access.md)', () => {
  it('sends the guest token as the Bearer for a guest', async () => {
    guest.readGuestToken.mockReturnValue(GUEST);
    const h = H(await apiHeaders('guest_1'));
    expect(h['Authorization']).toBe('Bearer guest-jwt');
    expect(h['X-Owner-Id']).toBeUndefined();
  });

  it('sends no identity for a visitor with no token of either kind', async () => {
    expect(H(await apiHeaders('guest_1'))).toEqual({});
  });

  it('sends the account token over the guest one', async () => {
    guest.readGuestToken.mockReturnValue(GUEST);
    setTokenProvider(() => Promise.resolve('jwt-xyz'));
    expect(H(await apiHeaders('guest_1'))['Authorization']).toBe('Bearer jwt-xyz');
  });

  it('falls back to the guest token when the provider resolves null', async () => {
    guest.readGuestToken.mockReturnValue(GUEST);
    setTokenProvider(() => Promise.resolve(null));
    expect(H(await apiHeaders('guest_1'))['Authorization']).toBe('Bearer guest-jwt');
  });

  // The session's getToken() can resolve null for a moment on a live session. A
  // null used to fall back to `X-Owner-Id: <account id>`, which the worker
  // refuses (401 account_id_not_a_guest_credential), surfacing as "Couldn't
  // save your changes. Check your connection." on a perfectly good network.
  it('asks for a fresh token, bypassing the cache, when the provider resolves null', async () => {
    const provider = vi.fn((opts?: { skipCache?: boolean }) =>
      Promise.resolve(opts?.skipCache ? 'jwt-fresh' : null),
    );
    setTokenProvider(provider);
    const h = H(await apiHeaders('user_abc'));
    expect(provider).toHaveBeenNthCalledWith(2, { skipCache: true });
    expect(h['Authorization']).toBe('Bearer jwt-fresh');
    expect(h['X-Owner-Id']).toBeUndefined();
    expect(getLastKnownToken()).toBe('jwt-fresh');
  });

  it('does not re-ask when the first token resolves', async () => {
    const provider = vi.fn(() => Promise.resolve('jwt-xyz'));
    setTokenProvider(provider);
    await apiHeaders('user_abc');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('refuses to send an account id as the guest header when no token comes back', async () => {
    setTokenProvider(() => Promise.resolve(null));
    await expect(apiHeaders('user_abc')).rejects.toBeInstanceOf(SessionTokenUnavailableError);
  });

  it('refuses an account id with no provider registered at all', async () => {
    await expect(apiHeaders('user_abc')).rejects.toBeInstanceOf(SessionTokenUnavailableError);
  });

  it('adds Content-Type only for body requests, and the share code when given', async () => {
    expect(H(await apiHeaders('g'))['Content-Type']).toBeUndefined();
    expect(H(await apiHeaders('g', { body: true }))['Content-Type']).toBe('application/json');
    expect(H(await apiHeaders('g', { share: 'code1' }))['X-Share-Code']).toBe('code1');
  });

  it('rides the session share password on every request once set', async () => {
    expect(H(await apiHeaders('g'))['X-Share-Password']).toBeUndefined();
    setSessionSharePassword('pw');
    expect(H(await apiHeaders('g'))['X-Share-Password']).toBe('pw');
  });
});

// docs/specs/007-editor/load-recovery.md "The load always ends": a session that never hands out a
// token must not hold the request (and the project load behind it) open forever.
describe('session token limit', () => {
  afterEach(() => {
    vi.useRealTimers();
    setApiWarningReporter(null);
  });

  it('gives up on a token that never comes, then refuses the signed-in request', async () => {
    vi.useFakeTimers();
    const warnings: string[] = [];
    setApiWarningReporter((t) => warnings.push(t));
    setTokenProvider(() => new Promise<string | null>(() => {}));
    const headers = apiHeaders('user_abc').catch((e: unknown) => e);
    // Two attempts, each bounded.
    await vi.advanceTimersByTimeAsync(SESSION_TOKEN_TIMEOUT_MS * 2);
    expect(await headers).toBeInstanceOf(SessionTokenUnavailableError);
    expect(warnings).toContain('SessionToken.TimedOut');
  });

  it('uses the fresh token when only the cached one hangs', async () => {
    vi.useFakeTimers();
    setTokenProvider((opts) =>
      opts?.skipCache ? Promise.resolve('jwt-fresh') : new Promise<string | null>(() => {}),
    );
    const headers = apiHeaders('user_abc');
    await vi.advanceTimersByTimeAsync(SESSION_TOKEN_TIMEOUT_MS);
    expect(H(await headers)['Authorization']).toBe('Bearer jwt-fresh');
  });
});

// The one identity rule both header builders share: apiHeaders (async) and
// the unload beacon (sync, cached token).
describe('identityHeaders', () => {
  it('sends only the Bearer when a token is held', () => {
    expect(identityHeaders('user_abc', 'jwt')).toEqual({ Authorization: 'Bearer jwt' });
  });

  it('sends the guest token without an account token', () => {
    guest.readGuestToken.mockReturnValue(GUEST);
    expect(identityHeaders('guest_1', null)).toEqual({ Authorization: 'Bearer guest-jwt' });
  });

  it('throws rather than present an account id as a guest credential', () => {
    expect(() => identityHeaders('user_abc', null)).toThrow(SessionTokenUnavailableError);
  });
});

describe('ApiError', () => {
  it('carries action/status/code and the canonical message', () => {
    const e = new ApiError('save', 403, 'forbidden');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('save failed: 403');
    expect(e.status).toBe(403);
    expect(e.code).toBe('forbidden');
    expect(e.name).toBe('ApiError');
  });
});

describe('expectOk / expectOkOrNull / expectOkVoid', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const err = (status: number, code?: string) =>
    new Response(JSON.stringify(code ? { error: code } : {}), { status });

  it('expectOk parses a 2xx body and throws ApiError with the worker error code on failure', async () => {
    expect(await expectOk<{ a: number }>(ok({ a: 1 }), 'load')).toEqual({ a: 1 });
    await expect(expectOk(err(403, 'forbidden'), 'load')).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });
  });

  it('expectOkOrNull maps 404 to null but still throws other failures', async () => {
    expect(await expectOkOrNull(err(404), 'read')).toBeNull();
    expect(await expectOkOrNull<{ a: number }>(ok({ a: 2 }), 'read')).toEqual({ a: 2 });
    await expect(expectOkOrNull(err(500), 'read')).rejects.toBeInstanceOf(ApiError);
  });

  it('expectOk throws but reports nothing for a refusal the caller expects and retries', async () => {
    const reported: string[] = [];
    setApiErrorReporter((type) => reported.push(type));
    try {
      const expected = (code: string | null) => code === 'tab_not_found';
      await expect(
        expectOk(err(404, 'tab_not_found'), 'sheet create', expected),
      ).rejects.toMatchObject({
        status: 404,
        code: 'tab_not_found',
      });
      expect(reported).toEqual([]);
      await expect(
        expectOk(err(404, 'sheet_not_found'), 'sheet create', expected),
      ).rejects.toBeInstanceOf(ApiError);
      expect(reported).toEqual(['Http404.SheetCreate.SheetNotFound']);
    } finally {
      setApiErrorReporter(null);
    }
  });

  it('expectOkVoid resolves on 2xx and throws otherwise', async () => {
    await expect(expectOkVoid(ok({}), 'del')).resolves.toBeUndefined();
    await expect(expectOkVoid(err(403), 'del')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('stripUiTabFields', () => {
  const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

  it('drops the UI-only templateChosen + folder fields', () => {
    const out = stripUiTabFields(tab({ templateChosen: true, folder: 'f1' }));
    expect('templateChosen' in out).toBe(false);
    expect('folder' in out).toBe(false);
    expect(out.id).toBe('t');
  });

  it('returns the same object when there is nothing to strip', () => {
    const t = tab();
    expect(stripUiTabFields(t)).toBe(t);
  });
});

// The kind is stamped at the PERSISTENCE boundary, not only at the editor's
// commit choke point: several mutation paths reach the wire (history commit,
// the non-undoable session tick, remote applies), and a field that depends on
// which one ran is a field you cannot trust. Every tab that goes out says
// what it is.
describe('tabForWire — tab kind', () => {
  const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

  it('stamps the ordinary kind onto a tab that has none', () => {
    expect(tabForWire(tab()).kind).toBe('diagram');
  });

  it('keeps a specialised kind', () => {
    expect(tabForWire(tab({ kind: 'board' })).kind).toBe('board');
  });

  it('still strips the UI-only fields', () => {
    const out = tabForWire(tab({ templateChosen: true, folder: 'f1' }));
    expect('templateChosen' in out).toBe(false);
    expect('folder' in out).toBe(false);
  });
});

// docs/specs/016-platform/new-version-prompt.md: every response's format header is noted, so an open
// editor learns of a newer server from traffic it already has.
describe('apiFetch and the project format header', () => {
  afterEach(() => {
    resetServerReleaseForTests();
    vi.unstubAllGlobals();
  });

  it('notes the number every response carries, failed ones included', async () => {
    const newer = String(PROJECT_FORMAT + 1);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{}', { status: 404, headers: { [PROJECT_FORMAT_HEADER]: newer } }),
        ),
    );
    await apiFetch(`${API_BASE}/projects/d1`);
    expect(serverProjectFormat()).toBe(PROJECT_FORMAT + 1);
  });

  it('notes the live build id beside it (docs/specs/016-platform/stale-builds.md)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{}', { status: 200, headers: { [BUILD_ID_HEADER]: 'b2' } }),
        ),
    );
    await apiFetch(`${API_BASE}/projects`);
    expect(serverBuild()).toBe('b2');
  });

  it('notes nothing from a response without the header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await apiFetch(`${API_BASE}/projects`);
    expect(serverProjectFormat()).toBeNull();
  });
});

// Client confinement (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB16).
describe('apiFetch under a workbench session', () => {
  afterEach(() => {
    setWorkbenchConfinement(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuses a confined route without sending it or reporting a network error', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setWorkbenchConfinement({ scope: 'project', projectId: 'doc-1', ownerId: 'user_1' });

    await expect(
      apiFetch(`${API_BASE}/folders`, {
        headers: { Authorization: `Bearer lvw_${'s'.repeat(43)}.${'0f'.repeat(32)}` },
      }),
    ).rejects.toBeInstanceOf(WorkbenchConfinedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
