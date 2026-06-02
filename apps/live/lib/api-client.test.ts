import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiCreateShareLink,
  apiDeleteShareLink,
  apiHeaders,
  apiLoadDiagram,
  apiSaveDiagramMeta,
  setTokenProvider,
} from './api-client';

// Reset the module-level token provider between tests so the order of
// the cases below doesn't leak. The Bearer-path tests register a
// provider, the guest-path tests assume none. Without this teardown a
// previous case's provider would silently drive a later "guest" case
// down the Bearer branch.
afterEach(() => {
  setTokenProvider(null);
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
      // The 404 contract is what lets `/live/diagram/<unknown-id>`
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
