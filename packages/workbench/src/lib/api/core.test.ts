// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createApiCore,
  saveTimeoutMs,
  saveTimeoutSignal,
  SAVE_TIMEOUT_BASE_MS,
  SESSION_TOKEN_TIMEOUT_MS,
  SessionTokenUnavailableError,
  stripUiTabFields,
  wsUrl,
  type ApiCoreConfig,
} from './core';
import { ApiError } from './api-error';

// The XMLHttpRequest transport (xhr-fetch.test.ts covers it): here only which requests take it.
const xhr = vi.hoisted(() => ({ xhrFetch: vi.fn() }));
vi.mock('./xhr-fetch', () => xhr);

// The shared api core every editor binds (each editor's lib/api/core.ts, whose own tests drive it through the
// binding with its real guest token, telemetry and grants). These cases cover the shared rules with fakes.

function setup(overrides: Partial<ApiCoreConfig> = {}) {
  const report = {
    apiError: vi.fn(),
    apiWarning: vi.fn(),
    networkError: vi.fn(),
    noSessionToken: vi.fn(),
    markReported: vi.fn(),
  };
  const config: ApiCoreConfig = {
    readGuestToken: vi.fn(() => ({ token: 'guest-jwt' })),
    report,
    withGrant: vi.fn(async (_base: string, _input: string, init: RequestInit | undefined) => ({
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), 'X-Grant': 'g' },
    })),
    noteResponse: vi.fn(),
    sharePasswordCachePrefix: 'app:share-password:',
    ...overrides,
  };
  return { core: createApiCore(config), config, report };
}

const H = (h: HeadersInit) => h as Record<string, string>;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the autosave time bound', () => {
  it('grows with the body', () => {
    expect(saveTimeoutMs(0)).toBe(SAVE_TIMEOUT_BASE_MS);
    expect(saveTimeoutMs(16 * 1024)).toBe(SAVE_TIMEOUT_BASE_MS + 1000);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    saveTimeoutSignal('é');
    expect(timeout).toHaveBeenCalledWith(saveTimeoutMs(2));
  });
});

describe('wsUrl', () => {
  it('builds from the page for the same-origin base', () => {
    expect(wsUrl('/room')).toBe(`ws://${window.location.host}/api/room`);
    vi.stubGlobal('location', { protocol: 'https:', host: 'example.test' });
    expect(wsUrl('/room')).toBe('wss://example.test/api/room');
  });

  it('turns an absolute base into its WebSocket scheme', async () => {
    for (const [base, want] of [
      ['http://localhost:8687/api', 'ws://localhost:8687/api/room'],
      ['https://www.example.test/api', 'wss://www.example.test/api/room'],
    ] as const) {
      vi.resetModules();
      vi.doMock('./base', () => ({ API_BASE: base }));
      const mod = await import('./core');
      expect(mod.wsUrl('/room')).toBe(want);
    }
    vi.doUnmock('./base');
  });
});

describe('stripUiTabFields', () => {
  it('returns a clean tab as it is, and drops the UI-only fields', () => {
    const clean: { id: string; templateChosen?: boolean } = { id: 't' };
    expect(stripUiTabFields(clean)).toBe(clean);
    expect(stripUiTabFields({ id: 't', templateChosen: true })).toEqual({ id: 't' });
    expect(stripUiTabFields({ id: 't', folder: 'f' })).toEqual({ id: 't' });
  });
});

describe('apiFetch', () => {
  it('adds the grant, reads the release signal and passes a confined session', async () => {
    const noteResponse = vi.fn();
    const { core, config } = setup({
      confinement: { refusal: () => null, noteResponse },
    });
    const res = new Response('ok');
    fetchMock.mockResolvedValue(res);
    await expect(core.apiFetch('/api/x', { method: 'post' })).resolves.toBe(res);
    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      method: 'post',
      headers: { 'X-Grant': 'g' },
    });
    expect(config.withGrant).toHaveBeenCalledWith('/api', '/api/x', { method: 'post' });
    expect(config.noteResponse).toHaveBeenCalledWith(res);
    expect(noteResponse).toHaveBeenCalledWith({ method: 'post' }, res);
  });

  it('sends as it is with grant: false', async () => {
    const { core, config } = setup();
    fetchMock.mockResolvedValue(new Response('ok'));
    await core.apiFetch('/api/x', undefined, { grant: false });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', undefined);
    expect(config.withGrant).not.toHaveBeenCalled();
  });

  it('refuses a confined request unsent', async () => {
    const refused = new Error('confined');
    const { core, report } = setup({
      confinement: { refusal: () => refused, noteResponse: vi.fn() },
    });
    await expect(core.apiFetch('/api/x')).rejects.toBe(refused);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(report.networkError).not.toHaveBeenCalled();
  });

  it('sends a request that asks for its upload progress by XMLHttpRequest, as fetch would be', async () => {
    const noteResponse = vi.fn();
    const { core, config } = setup({ confinement: { refusal: () => null, noteResponse } });
    const res = new Response('ok');
    xhr.xhrFetch.mockResolvedValueOnce(res);
    const uploadProgress = vi.fn();
    const init = { method: 'POST', body: 'bytes' };
    await expect(core.apiFetch('/api/up', init, { uploadProgress })).resolves.toBe(res);
    expect(xhr.xhrFetch).toHaveBeenCalledWith(
      '/api/up',
      { ...init, headers: { 'X-Grant': 'g' } },
      uploadProgress,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(config.noteResponse).toHaveBeenCalledWith(res);
    expect(noteResponse).toHaveBeenCalledWith(init, res);
  });

  it('reports an upload that fails before any response, as fetch would be', async () => {
    const { core, report } = setup();
    const err = new TypeError('Failed to fetch');
    xhr.xhrFetch.mockRejectedValueOnce(err);
    await expect(
      core.apiFetch('/api/up', { method: 'POST' }, { uploadProgress: vi.fn() }),
    ).rejects.toBe(err);
    expect(report.networkError).toHaveBeenCalledWith('POST', '/api/up', err);
  });

  it('falls back to fetch where there is no XMLHttpRequest', async () => {
    vi.stubGlobal('XMLHttpRequest', undefined);
    xhr.xhrFetch.mockClear();
    const { core } = setup();
    fetchMock.mockResolvedValue(new Response('ok'));
    await core.apiFetch('/api/up', undefined, { grant: false, uploadProgress: vi.fn() });
    expect(fetchMock).toHaveBeenCalledWith('/api/up', undefined);
    expect(xhr.xhrFetch).not.toHaveBeenCalled();
  });

  it('reports a network failure and rethrows it', async () => {
    const { core, report } = setup();
    const err = new TypeError('offline');
    fetchMock.mockRejectedValue(err);
    await expect(core.apiFetch('/api/x')).rejects.toBe(err);
    expect(report.networkError).toHaveBeenCalledWith('GET', '/api/x', err);
  });
});

describe('the token provider', () => {
  it('keeps the newest registration in force until the last goes', async () => {
    const { core } = setup();
    const a = () => Promise.resolve('a');
    const b = () => Promise.resolve('b');
    const offA = core.registerTokenProvider(a);
    const offB = core.registerTokenProvider(b);
    expect(await core.currentBearer()).toBe('b');
    expect(core.getLastKnownToken()).toBe('b');
    offB();
    expect(core.getLastKnownToken()).toBeNull();
    expect(await core.currentBearer()).toBe('a');
    offB();
    offA();
    expect(await core.currentBearer()).toBe('guest-jwt');
  });

  it('is replaced outright by setTokenProvider', async () => {
    const { core } = setup();
    core.registerTokenProvider(() => Promise.resolve('a'));
    core.setTokenProvider(() => Promise.resolve('z'));
    expect(await core.currentBearer()).toBe('z');
    core.setTokenProvider(null);
    expect(core.getLastKnownToken()).toBeNull();
  });

  it('asks once more, past the held token, when the session answers null', async () => {
    const { core } = setup();
    const provider = vi.fn(async (opts?: { skipCache?: boolean }) =>
      opts?.skipCache ? 'fresh' : null,
    );
    core.setTokenProvider(provider);
    expect(await core.currentBearer()).toBe('fresh');
    expect(provider).toHaveBeenLastCalledWith({ skipCache: true });
  });

  it('gives up on a session that never answers', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { core, config, report } = setup();
    vi.mocked(config.readGuestToken).mockReturnValue(null);
    core.setTokenProvider(() => new Promise(() => {}));
    const bearer = core.currentBearer();
    await vi.advanceTimersByTimeAsync(SESSION_TOKEN_TIMEOUT_MS * 2);
    expect(await bearer).toBeNull();
    expect(report.apiWarning).toHaveBeenCalledWith('SessionToken.TimedOut');
    warn.mockRestore();
  });
});

describe('identity', () => {
  it("sends the account's token, else the guest's, else nothing", () => {
    const { core, config } = setup();
    expect(core.identityHeaders('guest_1', 'jwt')).toEqual({ Authorization: 'Bearer jwt' });
    expect(core.identityHeaders('guest_1', null)).toEqual({ Authorization: 'Bearer guest-jwt' });
    vi.mocked(config.readGuestToken).mockReturnValue(null);
    expect(core.identityHeaders('guest_1', null)).toEqual({});
    expect(() => core.identityHeaders('user_1', null)).toThrow(SessionTokenUnavailableError);
    expect(new SessionTokenUnavailableError().name).toBe('SessionTokenUnavailableError');
  });

  it('builds the headers with the body type, share code, share password and extras', async () => {
    const { core } = setup();
    core.setSessionSharePassword('pw');
    expect(core.getSessionSharePassword()).toBe('pw');
    const h = H(
      await core.apiHeaders('guest_1', {
        body: true,
        share: 'code',
        extra: { 'X-Allow-Empty': '1' },
      }),
    );
    expect(h).toEqual({
      Authorization: 'Bearer guest-jwt',
      'Content-Type': 'application/json',
      'X-Share-Code': 'code',
      'X-Share-Password': 'pw',
      'X-Allow-Empty': '1',
    });
    core.setSessionSharePassword('');
    expect(core.getSessionSharePassword()).toBeNull();
    expect(H(await core.apiHeaders('guest_1'))).toEqual({ Authorization: 'Bearer guest-jwt' });
  });

  it('refuses a signed-in owner with no token, reported once', async () => {
    const { core, report } = setup();
    await expect(core.apiHeaders('user_1')).rejects.toBeInstanceOf(SessionTokenUnavailableError);
    expect(report.noSessionToken).toHaveBeenCalledTimes(1);
    expect(report.markReported).toHaveBeenCalledWith(expect.any(SessionTokenUnavailableError));
  });
});

describe('the share-password cache', () => {
  it('keeps a password per share code under the prefix, an empty one read as none', () => {
    const { core } = setup();
    expect(core.readCachedSharePassword('c')).toBeNull();
    core.writeCachedSharePassword('c', 'pw');
    expect(localStorage.getItem('app:share-password:c')).toBe('pw');
    expect(core.readCachedSharePassword('c')).toBe('pw');
    core.writeCachedSharePassword('c', null);
    expect(core.readCachedSharePassword('c')).toBeNull();
  });
});

describe('the response helpers', () => {
  it('parses a 2xx and throws a reported ApiError otherwise', async () => {
    const { core, report } = setup();
    await expect(core.expectOk(json(200, { a: 1 }), 'load')).resolves.toEqual({ a: 1 });
    const err = await core
      .expectOk(json(409, { error: 'conflict' }), 'save')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(report.apiError).toHaveBeenCalledWith(409, 'save', 'conflict');
    expect(report.markReported).toHaveBeenCalledWith(err);
  });

  it('leaves an expected refusal unreported', async () => {
    const { core, report } = setup();
    await expect(
      core.expectOk(json(409, { error: 'race' }), 'create', (code) => code === 'race'),
    ).rejects.toBeInstanceOf(ApiError);
    expect(report.apiError).not.toHaveBeenCalled();
  });

  it('answers null for a 404 where asked', async () => {
    const { core } = setup();
    await expect(core.expectOkOrNull(json(404, {}), 'read')).resolves.toBeNull();
    await expect(core.expectOkOrNull(json(200, { a: 1 }), 'read')).resolves.toEqual({ a: 1 });
    await expect(core.expectOkOrNull(json(500, {}), 'read')).rejects.toBeInstanceOf(ApiError);
    await expect(core.expectOkVoid(json(200, null), 'write')).resolves.toBeUndefined();
    await expect(core.expectOkVoid(json(500, {}), 'write')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiDelete', () => {
  it('tolerates a 404 by default and carries the share code and extras', async () => {
    const { core } = setup();
    fetchMock.mockResolvedValue(json(404, {}));
    await core.apiDelete('/api/x', 'guest_1', {
      action: 'delete',
      share: 'code',
      extra: { 'X-M': '1' },
    });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe('DELETE');
    expect(H(init.headers!)).toMatchObject({ 'X-Share-Code': 'code', 'X-M': '1' });
    fetchMock.mockResolvedValue(json(500, {}));
    await expect(core.apiDelete('/api/x', 'guest_1', { action: 'delete' })).rejects.toBeInstanceOf(
      ApiError,
    );
    fetchMock.mockResolvedValue(json(200, null));
    await expect(
      core.apiDelete('/api/x', 'guest_1', { action: 'delete' }),
    ).resolves.toBeUndefined();
  });

  it('surfaces a 404 with allow404: false', async () => {
    const { core } = setup();
    fetchMock.mockResolvedValue(json(404, {}));
    await expect(
      core.apiDelete('/api/x', 'guest_1', { action: 'delete', share: null, allow404: false }),
    ).rejects.toBeInstanceOf(ApiError);
    fetchMock.mockResolvedValue(json(200, null));
    await expect(
      core.apiDelete('/api/x', 'guest_1', { action: 'delete', allow404: false }),
    ).resolves.toBeUndefined();
  });
});
