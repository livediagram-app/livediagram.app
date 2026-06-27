import type { Tab } from '@livediagram/diagram';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiCreateDiagram,
  apiCreateShareLink,
  apiDeleteImage,
  apiDeleteShareLink,
  apiDeleteTab,
  apiDismissSharedWith,
  apiHeaders,
  apiLoadDiagram,
  apiLoadShared,
  apiSaveDiagramMeta,
  setSessionSharePassword,
  setTokenProvider,
} from './api-client';

// Reset the module-level token provider between tests so the order of
// the cases below doesn't leak. The Bearer-path tests register a
// provider, the guest-path tests assume none. Without this teardown a
// previous case's provider would silently drive a later "guest" case
// down the Bearer branch.
afterEach(() => {
  setTokenProvider(null);
  // Clear the session share password (spec/24) so a password-path case
  // doesn't leak X-Share-Password into a later case's headers.
  setSessionSharePassword(null);
});

// Helper: apiHeaders returns HeadersInit which can be either a plain
// object or a Headers / [string, string][] tuple list. In this file
// every branch returns a plain object, so the cast is safe and the
// tests can treat the result as a Record for index assertions.
async function call(...args: Parameters<typeof apiHeaders>): Promise<Record<string, string>> {
  return (await apiHeaders(...args)) as Record<string, string>;
}

describe('apiHeaders (hybrid identity gate, spec/04 + spec/11)', () => {
  it('guest path: no provider, no token, emits X-Owner-Id', async () => {
    const h = await call('guest-uuid-1');
    expect(h['X-Owner-Id']).toBe('guest-uuid-1');
    expect(h.Authorization).toBeUndefined();
  });

  it('guest path: provider returning null falls back to X-Owner-Id', async () => {
    // Signed-out Clerk session: useAuth().getToken() resolves to
    // null, so the provider is registered but currently inert. The
    // request must still carry the X-Owner-Id header (the editor
    // stays usable for signed-out visitors).
    setTokenProvider(async () => null);
    const h = await call('guest-uuid-2');
    expect(h['X-Owner-Id']).toBe('guest-uuid-2');
    expect(h.Authorization).toBeUndefined();
  });

  it('bearer path: provider returning a token emits Authorization and drops X-Owner-Id', async () => {
    // The invariant that matters: a request must NOT carry both
    // headers simultaneously. The api worker would prefer the JWT
    // (verifies it, derives the owner from sub) but the duplicate
    // owner signal would leave a confusing trail in any per-request
    // audit. Bearer-only is the only correct shape.
    setTokenProvider(async () => 'jwt-token-abc');
    const h = await call('client-passed-id-ignored');
    expect(h.Authorization).toBe('Bearer jwt-token-abc');
    expect(h['X-Owner-Id']).toBeUndefined();
  });

  it('body opt adds Content-Type: application/json on guest path', async () => {
    const h = await call('guest-uuid-3', { body: true });
    expect(h['X-Owner-Id']).toBe('guest-uuid-3');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('body opt adds Content-Type on bearer path too', async () => {
    setTokenProvider(async () => 'jwt-token-def');
    const h = await call('ignored', { body: true });
    expect(h.Authorization).toBe('Bearer jwt-token-def');
    expect(h['Content-Type']).toBe('application/json');
    expect(h['X-Owner-Id']).toBeUndefined();
  });

  it('share opt adds X-Share-Code', async () => {
    const h = await call('guest-uuid-4', { share: 'ABCD2345' });
    expect(h['X-Owner-Id']).toBe('guest-uuid-4');
    expect(h['X-Share-Code']).toBe('ABCD2345');
  });

  it('share + body together emit all three headers', async () => {
    const h = await call('guest-uuid-5', { share: 'EFGH6789', body: true });
    expect(h['X-Owner-Id']).toBe('guest-uuid-5');
    expect(h['X-Share-Code']).toBe('EFGH6789');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('bearer + share: signed-in visitor on a share URL still carries the share code', async () => {
    // A signed-in user clicking a share link sends Bearer (their
    // Clerk identity) AND X-Share-Code (the link's role gates write
    // access on the diagram they don't own). spec/04: "Share-code
    // visitors who happen to also be signed in send Bearer +
    // X-Share-Code; the per-link role still gates write access."
    setTokenProvider(async () => 'jwt-token-xyz');
    const h = await call('ignored', { share: 'IJKL0123' });
    expect(h.Authorization).toBe('Bearer jwt-token-xyz');
    expect(h['X-Share-Code']).toBe('IJKL0123');
    expect(h['X-Owner-Id']).toBeUndefined();
  });

  it('share: null is treated as absent (no X-Share-Code header)', async () => {
    // Several call sites pass `share: shareCode ?? null` where the
    // user is an owner (no share code in scope). A null value must
    // not emit an X-Share-Code: "" header, which the api would
    // mis-parse as a share visit. Verifies the truthy guard.
    const h = await call('guest-uuid-6', { share: null });
    expect(h['X-Share-Code']).toBeUndefined();
    expect(h['X-Owner-Id']).toBe('guest-uuid-6');
  });

  it('attaches X-Share-Password once a session password is set (spec/24)', async () => {
    // After the visitor passes the password gate, every request must
    // carry the password automatically so reads/writes stay authorised.
    expect((await call('guest-uuid-7'))['X-Share-Password']).toBeUndefined();
    setSessionSharePassword('hunter2');
    expect((await call('guest-uuid-7'))['X-Share-Password']).toBe('hunter2');
    // Clearing it removes the header again (owner sessions never set it).
    setSessionSharePassword(null);
    expect((await call('guest-uuid-7'))['X-Share-Password']).toBeUndefined();
  });
});

describe('apiLoadShared password gate (spec/24)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSessionSharePassword(null);
  });

  it('returns passwordRequired (not invalid) on 401', async () => {
    stubFetch(401, { error: 'password_required' });
    const res = await apiLoadShared('CODE2345', 'guest-1');
    expect(res).toEqual({ passwordRequired: true, invalid: false });
  });

  it('returns passwordRequired with invalid=true on 403 (wrong password)', async () => {
    stubFetch(403, { error: 'password_invalid' });
    const res = await apiLoadShared('CODE2345', 'guest-2');
    expect(res).toEqual({ passwordRequired: true, invalid: true });
  });

  it('returns null on 404 (revoked / nonexistent)', async () => {
    stubFetch(404, {});
    expect(await apiLoadShared('CODE2345', 'guest-3')).toBeNull();
  });

  it('resolves the diagram + role on 200', async () => {
    stubFetch(200, { diagram: { id: 'd1' }, role: 'view' });
    const res = await apiLoadShared('CODE2345', 'guest-4');
    expect(res).toMatchObject({ role: 'view', diagram: { id: 'd1' } });
  });
});

// Helper to stub the global fetch with a one-shot mocked Response.
// Each test reaches for its own fixture so the cases don't leak
// state through the shared Response object. `body` is plain JSON
// the helper stringifies; `status` defaults to 200.
function stubFetch(status: number, body: unknown = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

// `expectOk`, `expectOkOrNull`, `expectOkVoid`, and `expectOkOr404Void`
// are module-private helpers that every api function in this file
// passes its Response through. Their contract is observable from the
// outside via the api functions themselves, so the cases below pin
// each helper through a representative caller. A regression in any
// one of these helpers (e.g. the error message format changing, the
// 404-tolerance dropping, a missing await on res.json()) would
// silently break error reporting across every endpoint downstream.
describe('response helpers (observed through api callers)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('expectOk (via apiCreateShareLink)', () => {
    it('returns the parsed body on 200', async () => {
      const link = {
        code: 'ABCD2345',
        role: 'edit' as const,
        createdAt: 0,
        diagramId: 'diag-1',
      };
      stubFetch(200, { link });
      const got = await apiCreateShareLink('owner-1', 'diag-1', 'edit');
      expect(got).toEqual(link);
    });

    it('throws "<action> failed: <status>" on 500', async () => {
      // The thrown message is what the editor surfaces through the
      // generic error toast. Locking the shape ("create share link
      // failed: 500") ensures a regression in `expectOk` (e.g.
      // dropping the status) doesn't quietly remove the diagnostic
      // signal users see when they report an issue.
      stubFetch(500);
      await expect(apiCreateShareLink('owner-1', 'diag-1', 'edit')).rejects.toThrow(
        'create share link failed: 500',
      );
    });
  });

  describe('expectOkOrNull (via apiLoadDiagram)', () => {
    it('returns the parsed diagram on 200', async () => {
      // apiLoadDiagram is wrapped in dedupeInFlight keyed by
      // `${ownerId}|${id}`, so each test below uses a unique key
      // pair to avoid collecting a cached promise from a prior
      // case. Without unique keys, the second test in this block
      // would observe the first test's resolved value and the
      // fetch mock would never be consulted.
      const diagram = {
        id: 'd-200',
        name: 'Hello',
        createdAt: 0,
        updatedAt: 0,
        shareable: false,
        ownerId: 'o-200',
        tabs: [],
      };
      stubFetch(200, { diagram });
      const got = await apiLoadDiagram('o-200', 'd-200');
      expect(got).toEqual(diagram);
    });

    it('returns null on 404 (the load-doesnt-exist path)', async () => {
      // The 404 contract is what lets `/diagram/<unknown-id>`
      // surface the NotFound page instead of throwing into the
      // editor's load effect. A regression that re-threw 404
      // would tip every welcome flow + share-resolution into a
      // crash boundary.
      stubFetch(404, {});
      const got = await apiLoadDiagram('o-404', 'd-404');
      expect(got).toBeNull();
    });

    it('throws "load failed: <status>" on 500', async () => {
      stubFetch(500);
      await expect(apiLoadDiagram('o-500', 'd-500')).rejects.toThrow('load failed: 500');
    });
  });

  describe('expectOkVoid (via apiSaveDiagramMeta)', () => {
    it('resolves quietly on 200 (no body to parse)', async () => {
      // apiSaveDiagramMeta is a write with no response body. The
      // helper must NOT call res.json() or it would throw on an
      // empty body. Asserting the promise resolves without value
      // pins both the no-throw + no-body contract.
      stubFetch(200);
      await expect(
        apiSaveDiagramMeta('owner', { id: 'd-1', name: 'New' }),
      ).resolves.toBeUndefined();
    });

    it('throws "save diagram meta failed: <status>" on 500', async () => {
      stubFetch(500);
      await expect(apiSaveDiagramMeta('owner', { id: 'd-1', name: 'New' })).rejects.toThrow(
        'save diagram meta failed: 500',
      );
    });
  });

  describe('expectOkOr404Void (via apiDeleteShareLink)', () => {
    it('resolves on 200', async () => {
      stubFetch(200);
      await expect(apiDeleteShareLink('owner', 'd-1', 'ABCD2345')).resolves.toBeUndefined();
    });

    it('resolves on 404 (idempotent: concurrent delete already cleared the row)', async () => {
      // The tolerance is the whole point of this helper. "Delete
      // this share link" is a fire-and-forget gesture; another
      // collaborator clicking revoke at the same time, or the
      // share link already being gone, must not surface as an
      // error toast in the UI.
      stubFetch(404, {});
      await expect(apiDeleteShareLink('owner', 'd-1', 'ABCD2345')).resolves.toBeUndefined();
    });

    it('still throws on a non-200 non-404 (500, etc.)', async () => {
      stubFetch(500);
      await expect(apiDeleteShareLink('owner', 'd-1', 'ABCD2345')).rejects.toThrow(
        'delete share link failed: 500',
      );
    });
  });
});

// Internal apiDelete helper, observed through the public callers it
// backs. Two contracts that matter:
//
//   - allow404 default vs opt-out. Most DELETEs are idempotent
//     ("remove if it exists") and tolerate 404 silently; two callers
//     (apiDismissSharedWith, apiDeleteImage) opted in to a stricter
//     behaviour where 404 surfaces as a real error. The helper's
//     `allow404: false` flag preserves that distinction.
//   - share-code forwarding. The three DELETEs that take a
//     `shareCode` (delete tab, delete change-log-for-tab, delete
//     change-log entry) must round-trip the code as an
//     `X-Share-Code` request header, otherwise an edit-role
//     visitor's revoke would 403 server-side.
//
// Each branch lives behind a different public function, so the cases
// below pin both through the smallest representative caller. A
// regression in the helper (e.g. accidentally inverting the default,
// or dropping the share-header wire) would silently break either
// "delete after a peer already removed it" UX or every share-role
// write path downstream.
describe('apiDelete (internal, via public DELETE callers)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('allow404 default vs opt-out', () => {
    it('apiDismissSharedWith (allow404:false) throws on 404', async () => {
      // Strict mode: the caller explicitly opted out of the
      // idempotent-delete contract, so a 404 must NOT collapse to a
      // silent resolve. The thrown message includes the action label
      // so the existing error toast still says something useful.
      stubFetch(404, {});
      await expect(apiDismissSharedWith('owner', 'diag-404')).rejects.toThrow(
        'dismiss shared failed: 404',
      );
    });

    it('apiDeleteImage (allow404:false) throws on 404', async () => {
      stubFetch(404, {});
      await expect(apiDeleteImage('owner', 'img-404')).rejects.toThrow('delete image failed: 404');
    });

    it('apiDeleteImage resolves on 200 (smoke check the happy path still works)', async () => {
      stubFetch(200);
      await expect(apiDeleteImage('owner', 'img-200')).resolves.toBeUndefined();
    });

    it('apiDeleteShareLink (allow404:true) STILL tolerates 404 after the refactor', async () => {
      // Cross-check against the apiDelete extraction at a078e62:
      // the prior expectOkOr404Void inline call path collapsed to
      // `allow404: true` (the helper's default), so a regression to
      // `false` here would surface as a thrown error toast in the
      // share-revoke UI.
      stubFetch(404, {});
      await expect(apiDeleteShareLink('owner', 'd-1', 'CODE2345')).resolves.toBeUndefined();
    });
  });

  describe('share-code forwarding (X-Share-Code header)', () => {
    it('apiDeleteTab forwards a non-null shareCode as the X-Share-Code header', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchSpy);
      await apiDeleteTab('owner', 'diag-1', 'tab-1', 'SHARE2345');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Share-Code']).toBe('SHARE2345');
    });

    it('apiDeleteTab omits the X-Share-Code header when shareCode is null', async () => {
      // The owner-path DELETE never wants the share-code header set
      // (it would force the server's share-code branch instead of
      // the simpler owner check). Skipping the field at the call
      // site preserves that.
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchSpy);
      await apiDeleteTab('owner', 'diag-1', 'tab-1', null);
      const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Share-Code']).toBeUndefined();
    });

    it('apiDeleteShareLink (no share-code param at all) never sets X-Share-Code', async () => {
      // The endpoint takes the share code IN THE URL path, never
      // in the header. The helper must not invent a share-header
      // out of `code` (the path segment).
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchSpy);
      await apiDeleteShareLink('owner', 'diag-1', 'CODE2345');
      const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Share-Code']).toBeUndefined();
    });
  });
});

describe('apiCreateDiagram persisted body (spec/30)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('strips UI-only tab fields (templateChosen, folder) before POSTing', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ diagram: { id: 'd1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    // A tab carrying the editor-only fields that must NOT reach tabs.data:
    // templateChosen (UI state) + folder (per-diagram link, spec/30).
    const tab = {
      id: 't1',
      name: 'Tab',
      elements: [],
      templateChosen: true,
      folder: 'f1',
    } as unknown as Tab;

    const out = await apiCreateDiagram('owner', { id: 'd1', name: 'N', tabs: [tab] });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/diagrams$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { tabs: Record<string, unknown>[] };
    expect(body.tabs[0]).not.toHaveProperty('templateChosen');
    expect(body.tabs[0]).not.toHaveProperty('folder');
    expect(body.tabs[0]).toMatchObject({ id: 't1', name: 'Tab' });
    expect(out).toEqual({ id: 'd1' });
  });
});
