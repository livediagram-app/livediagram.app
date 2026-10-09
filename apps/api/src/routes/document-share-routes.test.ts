// The share-link family on a document: list, mint, revoke (one or all), the
// share password, and extend. Every route here is owner-only and every one of
// them changes who can reach the document, so the cases below are mostly about
// two questions — does the owner gate hold, and does the request get exactly
// the link it asked for rather than a more permissive one.
//
// The retraction of the "expires soon" warning at each site has its own suite
// (expiry-retraction.test.ts); this one covers the routes' own behaviour.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifySharePassword } from '../auth/share-password-hash';
import type { Runtime } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    createShareLink: vi.fn(),
    deleteShareLink: vi.fn(),
    extendShareLink: vi.fn(),
    generateShareCode: vi.fn(() => 'CODE1234'),
    getDocument: vi.fn(),
    getCommunityPostForDocument: vi.fn(async () => null),
    getTrashedDocumentMeta: vi.fn(async () => null),
    // No Community post stands in the way of a password here.
    getDocumentSharePassword: vi.fn(),
    getShareLinkIncludingExpired: vi.fn(),
    listShareLinks: vi.fn(),
    retractTimelineWarning: vi.fn(),
    setDocumentShare: vi.fn(),
    setDocumentSharePassword: vi.fn(),
  },
}));
vi.mock('../db', () => db);

const { timeline } = vi.hoisted(() => ({
  timeline: { recordShareLinkCreated: vi.fn(async () => {}) },
}));
vi.mock('../timeline', () => timeline);

const { email } = vi.hoisted(() => ({
  email: { emailEnabled: vi.fn(() => false), notifyFirstShare: vi.fn(async () => {}) },
}));
vi.mock('../email/client', () => ({ emailEnabled: email.emailEnabled }));
vi.mock('../email/notifications', () => ({ notifyFirstShare: email.notifyFirstShare }));

import { makeTestRouteContext } from './test-route-context';
import { handleDocumentShareRoutes } from './document-share-routes';
import { MAX_PASSWORD_LEN } from '../limits';

// Records what the single-code revoke broadcasts into the document's room, so
// the test can read the op rather than trust a no-op stub.
function roomEnv() {
  const broadcasts: unknown[] = [];
  const env = {
    rooms: {
      for: () => ({
        fetch: async (_url: string, init: { body: string }) => {
          broadcasts.push(JSON.parse(init.body));
          return new Response(null, { status: 204 });
        },
      }),
    },
  } as unknown as Runtime;
  return { env, broadcasts };
}

function ctxFor(
  method: string,
  path: string,
  opts: { body?: unknown; owner?: string | null; env?: Runtime; waitUntil?: boolean } = {},
) {
  const dispatched: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? 'user_1' : opts.owner,
    env: opts.env,
    ...(opts.waitUntil
      ? {
          waitUntil: (p: Promise<unknown>) => {
            dispatched.push(p);
          },
        }
      : {}),
  });
  return { ctx, settled: () => Promise.all(dispatched) };
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.getDocument.mockResolvedValue({ id: 'd_1', ownerId: 'user_1', tabs: [] });
  db.listShareLinks.mockResolvedValue([]);
  db.getDocumentSharePassword.mockResolvedValue(null);
  db.generateShareCode.mockReturnValue('CODE1234');
  db.createShareLink.mockImplementation(
    async (_env: Runtime, documentId: string, code: string, role: string) => ({
      code,
      documentId,
      role,
    }),
  );
  db.getShareLinkIncludingExpired.mockResolvedValue({ code: 'c1', documentId: 'd_1' });
  db.extendShareLink.mockResolvedValue({ code: 'c1', expiresAt: 9_999 });
  timeline.recordShareLinkCreated.mockClear();
  email.emailEnabled.mockReturnValue(false);
  email.notifyFirstShare.mockClear();
});

describe('handleDocumentShareRoutes — the owner gate', () => {
  it('403s a caller who is not the document owner, on every verb', async () => {
    db.getDocument.mockResolvedValue({ id: 'd_1', ownerId: 'someone-else', tabs: [] });
    for (const [method, path] of [
      ['GET', '/api/documents/d_1/share'],
      ['POST', '/api/documents/d_1/share'],
      ['DELETE', '/api/documents/d_1/share'],
      ['PUT', '/api/documents/d_1/share-password'],
      ['DELETE', '/api/documents/d_1/share/c1'],
      ['POST', '/api/documents/d_1/share/c1/extend'],
    ] as const) {
      // GET carries no body; the rest send an empty one.
      const { ctx } = ctxFor(method, path, {
        body: method === 'GET' ? undefined : {},
        env: roomEnv().env,
      });
      const res = await handleDocumentShareRoutes(ctx);
      expect(res?.status, `${method} ${path}`).toBe(403);
    }
    expect(db.createShareLink).not.toHaveBeenCalled();
    expect(db.deleteShareLink).not.toHaveBeenCalled();
    expect(db.setDocumentSharePassword).not.toHaveBeenCalled();
  });

  it('404s when the document does not exist', async () => {
    db.getDocument.mockResolvedValue(null);
    const { ctx } = ctxFor('GET', '/api/documents/d_1/share');
    expect((await handleDocumentShareRoutes(ctx))?.status).toBe(404);
  });

  it('400s when no owner resolves at all', async () => {
    const { ctx } = ctxFor('GET', '/api/documents/d_1/share', { owner: null });
    expect((await handleDocumentShareRoutes(ctx))?.status).toBe(400);
  });

  it('returns null for a path that is not a share route, so routing continues', async () => {
    for (const path of [
      '/api/documents/d_1',
      '/api/documents/d_1/tabs',
      '/api/documents/d_1/share/c1/unknown',
    ]) {
      const { ctx } = ctxFor('GET', path);
      expect(await handleDocumentShareRoutes(ctx), path).toBeNull();
    }
  });

  it('returns null for a verb a matched path does not answer', async () => {
    // The owner check still runs, but an unanswered verb must fall through
    // rather than 404 — another handler may own it.
    for (const [method, path] of [
      ['PATCH', '/api/documents/d_1/share'],
      ['GET', '/api/documents/d_1/share-password'],
      ['GET', '/api/documents/d_1/share/c1'],
      ['GET', '/api/documents/d_1/share/c1/extend'],
    ] as const) {
      const { ctx } = ctxFor(method, path, { env: roomEnv().env });
      expect(await handleDocumentShareRoutes(ctx), `${method} ${path}`).toBeNull();
    }
  });
});

describe('GET /api/documents/:id/share', () => {
  // The column holds only a hash, and even the owner gets just whether one is
  // set (docs/specs/013-workspace/share-password.md).
  it('returns the links and whether a password is set, never the password', async () => {
    db.listShareLinks.mockResolvedValue([{ code: 'c1', role: 'view' }]);
    db.getDocumentSharePassword.mockResolvedValue('pbkdf2-sha256$100000$c2FsdA$aGFzaA');
    const { ctx } = ctxFor('GET', '/api/documents/d_1/share');
    const body = await (await handleDocumentShareRoutes(ctx))!.json();
    expect(body).toEqual({ links: [{ code: 'c1', role: 'view' }], passwordSet: true });
    expect(JSON.stringify(body)).not.toContain('pbkdf2');
  });

  it('says no password is set when the column is empty', async () => {
    db.listShareLinks.mockResolvedValue([]);
    db.getDocumentSharePassword.mockResolvedValue(null);
    const { ctx } = ctxFor('GET', '/api/documents/d_1/share');
    expect(await (await handleDocumentShareRoutes(ctx))!.json()).toEqual({
      links: [],
      passwordSet: false,
    });
  });
});

describe('POST /api/documents/:id/share — minting a link', () => {
  it('mints an edit link by default and answers 201', async () => {
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share', { body: {} });
    const res = await handleDocumentShareRoutes(ctx);
    expect(res!.status).toBe(201);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd_1', 'CODE1234', 'edit', 'never', null);
  });

  it('honours an explicit view role', async () => {
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share', { body: { role: 'view' } });
    await handleDocumentShareRoutes(ctx);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd_1', 'CODE1234', 'view', 'never', null);
  });

  it('400s a role it does not recognise instead of granting edit', async () => {
    // THE regression guard: a `=== 'view' ? 'view' : 'edit'` here once turned
    // every typo — including 'veiw' — into an edit link.
    for (const role of ['veiw', 'admin', '', 42]) {
      const { ctx } = ctxFor('POST', '/api/documents/d_1/share', { body: { role } });
      const res = await handleDocumentShareRoutes(ctx);
      expect(res!.status, JSON.stringify(role)).toBe(400);
    }
    expect(db.createShareLink).not.toHaveBeenCalled();
  });

  it('accepts each known expiry and falls back to never for anything else', async () => {
    for (const expiry of ['week', 'month', 'sixMonths'] as const) {
      const { ctx } = ctxFor('POST', '/api/documents/d_1/share', { body: { expiry } });
      await handleDocumentShareRoutes(ctx);
      expect(db.createShareLink).toHaveBeenLastCalledWith(
        {},
        'd_1',
        'CODE1234',
        'edit',
        expiry,
        null,
      );
    }
    // An unknown token is not an error: it degrades to the pre-expiry
    // behaviour, a link that works until revoked.
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share', { body: { expiry: 'fortnight' } });
    await handleDocumentShareRoutes(ctx);
    expect(db.createShareLink).toHaveBeenLastCalledWith(
      {},
      'd_1',
      'CODE1234',
      'edit',
      'never',
      null,
    );
  });

  it('mints from a request with no readable body at all', async () => {
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share');
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(201);
  });

  it('records the event for the owner only (docs/specs/013-workspace/timeline.md §4.3)', async () => {
    const { ctx, settled } = ctxFor('POST', '/api/documents/d_1/share', {
      body: { role: 'view' },
      waitUntil: true,
    });
    await handleDocumentShareRoutes(ctx);
    await settled();
    expect(timeline.recordShareLinkCreated).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: 'd_1' }),
      'view',
      'user_1',
    );
  });

  it('only reaches for the first-share email when email is configured', async () => {
    const off = ctxFor('POST', '/api/documents/d_1/share', { body: {}, waitUntil: true });
    await handleDocumentShareRoutes(off.ctx);
    await off.settled();
    expect(email.notifyFirstShare).not.toHaveBeenCalled();

    email.emailEnabled.mockReturnValue(true);
    const on = ctxFor('POST', '/api/documents/d_1/share', { body: {}, waitUntil: true });
    await handleDocumentShareRoutes(on.ctx);
    await on.settled();
    expect(email.notifyFirstShare).toHaveBeenCalledWith({}, 'user_1');
  });
});

describe('DELETE /api/documents/:id/share — revoking every link', () => {
  it('drops each link and closes sharing', async () => {
    db.listShareLinks.mockResolvedValue([{ code: 'c1' }, { code: 'c2' }]);
    const { env, broadcasts } = roomEnv();
    const { ctx } = ctxFor('DELETE', '/api/documents/d_1/share', { env });
    const res = await handleDocumentShareRoutes(ctx);
    expect(db.deleteShareLink.mock.calls.map((c) => c[1])).toEqual(['c1', 'c2']);
    // Connected holders of each code are sent out of the room.
    expect(broadcasts).toEqual([
      { op: { kind: 'share-revoked', code: 'c1' } },
      { op: { kind: 'share-revoked', code: 'c2' } },
    ]);
    expect(db.setDocumentShare).toHaveBeenCalledWith(env, 'd_1', false);
    expect(await res!.json()).toEqual({ shareable: false, shareCode: null });
  });

  it('still closes sharing when there was nothing to drop', async () => {
    const { ctx } = ctxFor('DELETE', '/api/documents/d_1/share');
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(200);
    expect(db.setDocumentShare).toHaveBeenCalledWith({}, 'd_1', false);
  });
});

describe('PUT /api/documents/:id/share-password (docs/specs/013-workspace/share-password.md)', () => {
  it('stores a hash of the password, never the password, and says one is set', async () => {
    const { ctx } = ctxFor('PUT', '/api/documents/d_1/share-password', {
      body: { password: 'hunter2' },
    });
    const res = await handleDocumentShareRoutes(ctx);
    const stored = db.setDocumentSharePassword.mock.calls[0]![2] as string;
    expect(stored).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect(stored).not.toContain('hunter2');
    expect((await verifySharePassword(stored, 'hunter2')).ok).toBe(true);
    expect(await res!.json()).toEqual({ passwordSet: true });
  });

  it('clears the password for a whitespace-only value', async () => {
    // A stray space must not lock a document in a way the owner can't see.
    const { ctx } = ctxFor('PUT', '/api/documents/d_1/share-password', {
      body: { password: '  ' },
    });
    const res = await handleDocumentShareRoutes(ctx);
    expect(db.setDocumentSharePassword).toHaveBeenCalledWith({}, 'd_1', null);
    expect(await res!.json()).toEqual({ passwordSet: false });
  });

  it('clears the password for a null, and for a non-string', async () => {
    for (const password of [null, 42, undefined]) {
      const { ctx } = ctxFor('PUT', '/api/documents/d_1/share-password', { body: { password } });
      await handleDocumentShareRoutes(ctx);
      expect(db.setDocumentSharePassword).toHaveBeenLastCalledWith({}, 'd_1', null);
    }
  });

  it('clears the password when the request carries no readable body', async () => {
    const { ctx } = ctxFor('PUT', '/api/documents/d_1/share-password');
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(200);
    expect(db.setDocumentSharePassword).toHaveBeenCalledWith({}, 'd_1', null);
  });

  // docs/specs/013-workspace/share-password.md: visitors a code admitted before the password meet
  // the gate again; the room closes their sessions, off the response path.
  it('closes the share-code sessions when a password is set, and none when it is cleared', async () => {
    const set = roomEnv();
    const on = ctxFor('PUT', '/api/documents/d_1/share-password', {
      body: { password: 'hunter2' },
      env: set.env,
      waitUntil: true,
    });
    expect((await handleDocumentShareRoutes(on.ctx))!.status).toBe(200);
    await on.settled();
    expect(set.broadcasts).toEqual([{ match: 'share-code' }]);

    const cleared = roomEnv();
    const off = ctxFor('PUT', '/api/documents/d_1/share-password', {
      body: { password: null },
      env: cleared.env,
      waitUntil: true,
    });
    await handleDocumentShareRoutes(off.ctx);
    await off.settled();
    expect(cleared.broadcasts).toEqual([]);
  });

  it('400s a password past the limit, storing nothing', async () => {
    const { ctx } = ctxFor('PUT', '/api/documents/d_1/share-password', {
      body: { password: 'x'.repeat(MAX_PASSWORD_LEN + 1) },
    });
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(400);
    expect(db.setDocumentSharePassword).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/documents/:id/share/:code — revoking one link', () => {
  it('deletes the code and tells the room, so hydrated visitors redirect', async () => {
    const { env, broadcasts } = roomEnv();
    const { ctx } = ctxFor('DELETE', '/api/documents/d_1/share/c1', { env });
    const res = await handleDocumentShareRoutes(ctx);
    expect(res!.status).toBe(204);
    expect(db.deleteShareLink).toHaveBeenCalledWith(env, 'c1');
    expect(broadcasts).toEqual([{ op: { kind: 'share-revoked', code: 'c1' } }]);
  });

  it('still revokes when the room broadcast fails — persistence is the truth', async () => {
    const env = {
      rooms: {
        for: () => ({ fetch: async () => Promise.reject(new Error('room down')) }),
      },
    } as unknown as Runtime;
    const { ctx } = ctxFor('DELETE', '/api/documents/d_1/share/c1', { env });
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(204);
    expect(db.deleteShareLink).toHaveBeenCalled();
  });

  it('404s a code that belongs to a different document, leaving that link alive', async () => {
    // Owning d_1 must not let you revoke somebody else's link by its code.
    db.getShareLinkIncludingExpired.mockResolvedValueOnce({ code: 'c1', documentId: 'd_other' });
    const { env, broadcasts } = roomEnv();
    const { ctx } = ctxFor('DELETE', '/api/documents/d_1/share/c1', { env });
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(404);
    expect(db.deleteShareLink).not.toHaveBeenCalled();
    expect(broadcasts).toEqual([]);
  });
});

describe('POST /api/documents/:id/share/:code/extend (docs/specs/013-workspace/share-link-expiry.md)', () => {
  it('re-arms the link and returns it', async () => {
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share/c1/extend', { body: {} });
    const res = await handleDocumentShareRoutes(ctx);
    expect(await res!.json()).toEqual({ link: { code: 'c1', expiresAt: 9_999 } });
  });

  it('404s a code that belongs to a different document', async () => {
    // The code is a bearer value; without this check an owner could extend
    // somebody else's link by quoting it against their own document id.
    db.getShareLinkIncludingExpired.mockResolvedValue({ code: 'c1', documentId: 'other' });
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share/c1/extend', { body: {} });
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(404);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });

  it('404s a code that does not exist', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(null);
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share/c1/extend', { body: {} });
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(404);
  });

  it('400s a link that never expires — there is nothing to extend', async () => {
    db.extendShareLink.mockResolvedValue(null);
    const { ctx } = ctxFor('POST', '/api/documents/d_1/share/c1/extend', { body: {} });
    expect((await handleDocumentShareRoutes(ctx))!.status).toBe(400);
  });
});
