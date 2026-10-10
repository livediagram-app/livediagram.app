import type { Tab } from '@livediagram/document';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD_ID_HEADER, DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER } from '@livediagram/api-schema';
import { resetServerReleaseForTests, serverBuild, serverDocumentFormat } from '../server-release';

// getGuestSelfSig is the only ../local-identity symbol core.ts uses; mock
// it so the guest-signature header is deterministic per case.
const { identity } = vi.hoisted(() => ({
  identity: { getGuestSelfSig: vi.fn((): string | null => null) },
}));
vi.mock('../local-identity', () => identity);

import {
  API_BASE,
  ApiError,
  apiDelete,
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
import { resetApiWriteListeners, subscribeApiWrites } from './write-signal';
import { setApiWarningReporter } from './error-report';

const H = (h: HeadersInit) => h as Record<string, string>;

beforeEach(() => {
  setTokenProvider(null);
  setSessionSharePassword(null);
  identity.getGuestSelfSig.mockReturnValue(null);
});

describe('apiHeaders (hybrid identity gate, docs/specs/014-identity/auth-and-guest-access.md)', () => {
  it('sends X-Owner-Id for a guest, no Authorization', async () => {
    const h = H(await apiHeaders('guest-1'));
    expect(h['X-Owner-Id']).toBe('guest-1');
    expect(h['Authorization']).toBeUndefined();
  });

  it('attaches the guest signature when one is held', async () => {
    identity.getGuestSelfSig.mockReturnValue('sig-abc');
    expect(H(await apiHeaders('guest-1'))['X-Owner-Sig']).toBe('sig-abc');
  });

  it('sends Bearer and NOT X-Owner-Id when a token resolves (never both)', async () => {
    setTokenProvider(() => Promise.resolve('jwt-xyz'));
    const h = H(await apiHeaders('guest-1'));
    expect(h['Authorization']).toBe('Bearer jwt-xyz');
    expect(h['X-Owner-Id']).toBeUndefined();
    expect(h['X-Owner-Sig']).toBeUndefined();
  });

  it('falls back to X-Owner-Id when the provider resolves null', async () => {
    setTokenProvider(() => Promise.resolve(null));
    const h = H(await apiHeaders('guest-1'));
    expect(h['X-Owner-Id']).toBe('guest-1');
    expect(h['Authorization']).toBeUndefined();
  });

  // Clerk's getToken() can resolve null for a moment on a live session. A
  // null used to fall back to `X-Owner-Id: <Clerk id>`, which the worker
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
// token must not hold the request (and the document load behind it) open forever.
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

  it('sends the guest id and its signature without a token', () => {
    identity.getGuestSelfSig.mockReturnValue('sig-abc');
    expect(identityHeaders('guest-1', null)).toEqual({
      'X-Owner-Id': 'guest-1',
      'X-Owner-Sig': 'sig-abc',
    });
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

  it('expectOkVoid resolves on 2xx and throws otherwise', async () => {
    await expect(expectOkVoid(ok({}), 'del')).resolves.toBeUndefined();
    await expect(expectOkVoid(err(403), 'del')).rejects.toBeInstanceOf(ApiError);
  });
});

// The write signal the Timeline re-reads off (docs/specs/013-workspace/timeline.md §2.4b). Raised
// from the one place every request passes through, so no call site has
// to remember it — and only for a write that actually landed.
describe('apiFetch / apiDelete write signal', () => {
  const heard = vi.fn();
  beforeEach(() => {
    resetApiWriteListeners();
    heard.mockReset();
    subscribeApiWrites(heard);
  });

  it('announces a successful non-GET', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await apiFetch(`${API_BASE}/documents/d1`, { method: 'PUT' });
    expect(heard).toHaveBeenCalledWith({});
    vi.unstubAllGlobals();
  });

  it('stays silent for a GET, a failed write, and the feeds own endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await apiFetch(`${API_BASE}/documents`);
    await apiFetch(`${API_BASE}/timeline/events/e1`, { method: 'DELETE' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    await apiFetch(`${API_BASE}/documents/d1`, { method: 'PUT' });
    expect(heard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('names the entity a DELETE ended, after the plain signal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await apiDelete(`${API_BASE}/documents/d1`, 'g', {
      action: 'delete document',
      purge: { sourceType: 'document', sourceId: 'd1' },
    });
    expect(heard.mock.calls.map(([s]) => s)).toEqual([
      {},
      { purge: { sourceType: 'document', sourceId: 'd1' } },
    ]);
    vi.unstubAllGlobals();
  });

  it('does not name the entity when the DELETE found nothing to end', async () => {
    // A tolerated 404: nothing was removed, so nothing should vanish
    // from the feed on the strength of it.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await apiDelete(`${API_BASE}/documents/d1`, 'g', {
      action: 'delete document',
      purge: { sourceType: 'document', sourceId: 'd1' },
    });
    expect(heard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('stripUiTabFields', () => {
  const tab = (over: Partial<Tab> = {}): Tab =>
    ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

  it('drops the UI-only templateChosen + folder fields', () => {
    const out = stripUiTabFields(tab({ templateChosen: true, folder: 'f1' } as Partial<Tab>));
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
  const tab = (over: Partial<Tab> = {}): Tab =>
    ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

  it('stamps the ordinary kind onto a tab that has none', () => {
    expect(tabForWire(tab()).kind).toBe('diagram');
  });

  it('keeps a specialised kind', () => {
    expect(tabForWire(tab({ kind: 'event-storming' })).kind).toBe('event-storming');
  });

  it('resolves a legacy board by its layer instead of branding it a diagram', () => {
    const legacy = tab({ layers: [{ id: 'layer:es:big-picture', name: 'Big picture' }] });
    expect(tabForWire(legacy).kind).toBe('event-storming');
  });

  it('still strips the UI-only fields', () => {
    const out = tabForWire(tab({ templateChosen: true, folder: 'f1' } as Partial<Tab>));
    expect('templateChosen' in out).toBe(false);
    expect('folder' in out).toBe(false);
  });

  // Timeline lanes (docs/specs/021-event-storming/event-storming.md Phase 6) are BOARD state, not UI state: the
  // facilitator turns them on for the room, so the field has to reach the
});

// docs/specs/016-platform/new-version-prompt.md: every response's format header is noted, so an open
// editor learns of a newer server from traffic it already has.
describe('apiFetch and the document format header', () => {
  afterEach(() => {
    resetServerReleaseForTests();
    vi.unstubAllGlobals();
  });

  it('notes the number every response carries, failed ones included', async () => {
    const newer = String(DOCUMENT_FORMAT + 1);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{}', { status: 404, headers: { [DOCUMENT_FORMAT_HEADER]: newer } }),
        ),
    );
    await apiFetch(`${API_BASE}/documents/d1`);
    expect(serverDocumentFormat()).toBe(DOCUMENT_FORMAT + 1);
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
    await apiFetch(`${API_BASE}/documents`);
    expect(serverBuild()).toBe('b2');
  });

  it('notes nothing from a response without the header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await apiFetch(`${API_BASE}/documents`);
    expect(serverDocumentFormat()).toBeNull();
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
    setWorkbenchConfinement({ documentId: 'doc-1', ownerId: 'user_1' });

    await expect(
      apiFetch(`${API_BASE}/folders`, {
        headers: { Authorization: `Bearer lvw_${'s'.repeat(43)}` },
      }),
    ).rejects.toBeInstanceOf(WorkbenchConfinedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
