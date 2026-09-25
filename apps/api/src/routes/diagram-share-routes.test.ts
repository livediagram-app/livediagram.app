// The share-link family on a diagram: list, mint, revoke (one or all), the
// share password, and extend. Every route here is owner-only and every one of
// them changes who can reach the diagram, so the cases below are mostly about
// two questions — does the owner gate hold, and does the request get exactly
// the link it asked for rather than a more permissive one.
//
// The retraction of the "expires soon" warning at each site has its own suite
// (expiry-retraction.test.ts); this one covers the routes' own behaviour.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    createShareLink: vi.fn(),
    deleteShareLink: vi.fn(),
    extendShareLink: vi.fn(),
    generateShareCode: vi.fn(() => 'CODE1234'),
    getDiagram: vi.fn(),
    getDiagramSharePassword: vi.fn(),
    getShareLinkIncludingExpired: vi.fn(),
    listShareLinks: vi.fn(),
    retractTimelineWarning: vi.fn(),
    setDiagramShare: vi.fn(),
    setDiagramSharePassword: vi.fn(),
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
import { handleDiagramShareRoutes } from './diagram-share-routes';
import { MAX_PASSWORD_LEN } from '../limits';

// Records what the single-code revoke broadcasts into the diagram's room, so
// the test can read the op rather than trust a no-op stub.
function roomEnv() {
  const broadcasts: unknown[] = [];
  const env = {
    DIAGRAM_ROOM: {
      idFromName: (name: string) => `id:${name}`,
      get: () => ({
        fetch: async (_url: string, init: { body: string }) => {
          broadcasts.push(JSON.parse(init.body));
          return new Response(null, { status: 204 });
        },
      }),
    },
  } as unknown as Env;
  return { env, broadcasts };
}

function ctxFor(
  method: string,
  path: string,
  opts: { body?: unknown; owner?: string | null; env?: Env; waitUntil?: boolean } = {},
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
  db.getDiagram.mockResolvedValue({ id: 'd_1', ownerId: 'user_1', tabs: [] });
  db.listShareLinks.mockResolvedValue([]);
  db.getDiagramSharePassword.mockResolvedValue(null);
  db.generateShareCode.mockReturnValue('CODE1234');
  db.createShareLink.mockImplementation(
    async (_env: Env, diagramId: string, code: string, role: string) => ({
      code,
      diagramId,
      role,
    }),
  );
  db.getShareLinkIncludingExpired.mockResolvedValue({ code: 'c1', diagramId: 'd_1' });
  db.extendShareLink.mockResolvedValue({ code: 'c1', expiresAt: 9_999 });
  timeline.recordShareLinkCreated.mockClear();
  email.emailEnabled.mockReturnValue(false);
  email.notifyFirstShare.mockClear();
});

describe('handleDiagramShareRoutes — the owner gate', () => {
  it('403s a caller who is not the diagram owner, on every verb', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd_1', ownerId: 'someone-else', tabs: [] });
    for (const [method, path] of [
      ['GET', '/api/diagrams/d_1/share'],
      ['POST', '/api/diagrams/d_1/share'],
      ['DELETE', '/api/diagrams/d_1/share'],
      ['PUT', '/api/diagrams/d_1/share-password'],
      ['DELETE', '/api/diagrams/d_1/share/c1'],
      ['POST', '/api/diagrams/d_1/share/c1/extend'],
    ] as const) {
      // GET carries no body; the rest send an empty one.
      const { ctx } = ctxFor(method, path, {
        body: method === 'GET' ? undefined : {},
        env: roomEnv().env,
      });
      const res = await handleDiagramShareRoutes(ctx);
      expect(res?.status, `${method} ${path}`).toBe(403);
    }
    expect(db.createShareLink).not.toHaveBeenCalled();
    expect(db.deleteShareLink).not.toHaveBeenCalled();
    expect(db.setDiagramSharePassword).not.toHaveBeenCalled();
  });

  it('404s when the diagram does not exist', async () => {
    db.getDiagram.mockResolvedValue(null);
    const { ctx } = ctxFor('GET', '/api/diagrams/d_1/share');
    expect((await handleDiagramShareRoutes(ctx))?.status).toBe(404);
  });

  it('400s when no owner resolves at all', async () => {
    const { ctx } = ctxFor('GET', '/api/diagrams/d_1/share', { owner: null });
    expect((await handleDiagramShareRoutes(ctx))?.status).toBe(400);
  });

  it('returns null for a path that is not a share route, so routing continues', async () => {
    for (const path of [
      '/api/diagrams/d_1',
      '/api/diagrams/d_1/tabs',
      '/api/diagrams/d_1/share/c1/unknown',
    ]) {
      const { ctx } = ctxFor('GET', path);
      expect(await handleDiagramShareRoutes(ctx), path).toBeNull();
    }
  });

  it('returns null for a verb a matched path does not answer', async () => {
    // The owner check still runs, but an unanswered verb must fall through
    // rather than 404 — another handler may own it.
    for (const [method, path] of [
      ['PATCH', '/api/diagrams/d_1/share'],
      ['GET', '/api/diagrams/d_1/share-password'],
      ['GET', '/api/diagrams/d_1/share/c1'],
      ['GET', '/api/diagrams/d_1/share/c1/extend'],
    ] as const) {
      const { ctx } = ctxFor(method, path, { env: roomEnv().env });
      expect(await handleDiagramShareRoutes(ctx), `${method} ${path}`).toBeNull();
    }
  });
});

describe('GET /api/diagrams/:id/share', () => {
  it('returns the links with the password in the clear — owner-only (spec/24)', async () => {
    db.listShareLinks.mockResolvedValue([{ code: 'c1', role: 'view' }]);
    db.getDiagramSharePassword.mockResolvedValue('hunter2');
    const { ctx } = ctxFor('GET', '/api/diagrams/d_1/share');
    const res = await handleDiagramShareRoutes(ctx);
    expect(await res!.json()).toEqual({
      links: [{ code: 'c1', role: 'view' }],
      password: 'hunter2',
    });
  });
});

describe('POST /api/diagrams/:id/share — minting a link', () => {
  it('mints an edit link by default and answers 201', async () => {
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share', { body: {} });
    const res = await handleDiagramShareRoutes(ctx);
    expect(res!.status).toBe(201);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd_1', 'CODE1234', 'edit', 'never');
  });

  it('honours an explicit view role', async () => {
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share', { body: { role: 'view' } });
    await handleDiagramShareRoutes(ctx);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd_1', 'CODE1234', 'view', 'never');
  });

  it('400s a role it does not recognise instead of granting edit', async () => {
    // THE regression guard: a `=== 'view' ? 'view' : 'edit'` here once turned
    // every typo — including 'veiw' — into an edit link.
    for (const role of ['veiw', 'admin', '', 42]) {
      const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share', { body: { role } });
      const res = await handleDiagramShareRoutes(ctx);
      expect(res!.status, JSON.stringify(role)).toBe(400);
    }
    expect(db.createShareLink).not.toHaveBeenCalled();
  });

  it('accepts each known expiry and falls back to never for anything else', async () => {
    for (const expiry of ['week', 'month', 'sixMonths'] as const) {
      const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share', { body: { expiry } });
      await handleDiagramShareRoutes(ctx);
      expect(db.createShareLink).toHaveBeenLastCalledWith({}, 'd_1', 'CODE1234', 'edit', expiry);
    }
    // An unknown token is not an error: it degrades to the pre-expiry
    // behaviour, a link that works until revoked.
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share', { body: { expiry: 'fortnight' } });
    await handleDiagramShareRoutes(ctx);
    expect(db.createShareLink).toHaveBeenLastCalledWith({}, 'd_1', 'CODE1234', 'edit', 'never');
  });

  it('mints from a request with no readable body at all', async () => {
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share');
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(201);
  });

  it('records the event for the owner only (spec/138 §4.3)', async () => {
    const { ctx, settled } = ctxFor('POST', '/api/diagrams/d_1/share', {
      body: { role: 'view' },
      waitUntil: true,
    });
    await handleDiagramShareRoutes(ctx);
    await settled();
    expect(timeline.recordShareLinkCreated).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: 'd_1' }),
      'view',
      'user_1',
    );
  });

  it('only reaches for the first-share email when email is configured', async () => {
    const off = ctxFor('POST', '/api/diagrams/d_1/share', { body: {}, waitUntil: true });
    await handleDiagramShareRoutes(off.ctx);
    await off.settled();
    expect(email.notifyFirstShare).not.toHaveBeenCalled();

    email.emailEnabled.mockReturnValue(true);
    const on = ctxFor('POST', '/api/diagrams/d_1/share', { body: {}, waitUntil: true });
    await handleDiagramShareRoutes(on.ctx);
    await on.settled();
    expect(email.notifyFirstShare).toHaveBeenCalledWith({}, 'user_1');
  });
});

describe('DELETE /api/diagrams/:id/share — revoking every link', () => {
  it('drops each link and closes sharing', async () => {
    db.listShareLinks.mockResolvedValue([{ code: 'c1' }, { code: 'c2' }]);
    const { ctx } = ctxFor('DELETE', '/api/diagrams/d_1/share');
    const res = await handleDiagramShareRoutes(ctx);
    expect(db.deleteShareLink.mock.calls.map((c) => c[1])).toEqual(['c1', 'c2']);
    expect(db.setDiagramShare).toHaveBeenCalledWith({}, 'd_1', false);
    expect(await res!.json()).toEqual({ shareable: false, shareCode: null });
  });

  it('still closes sharing when there was nothing to drop', async () => {
    const { ctx } = ctxFor('DELETE', '/api/diagrams/d_1/share');
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(200);
    expect(db.setDiagramShare).toHaveBeenCalledWith({}, 'd_1', false);
  });
});

describe('PUT /api/diagrams/:id/share-password (spec/24)', () => {
  it('stores the password and echoes back what actually gates access', async () => {
    // The echo is the normalised stored value, not the request's — a
    // whitespace-only password clears the gate, and the dialog must show that.
    db.getDiagramSharePassword.mockResolvedValue(null);
    const { ctx } = ctxFor('PUT', '/api/diagrams/d_1/share-password', { body: { password: '  ' } });
    const res = await handleDiagramShareRoutes(ctx);
    expect(db.setDiagramSharePassword).toHaveBeenCalledWith({}, 'd_1', '  ');
    expect(await res!.json()).toEqual({ password: null });
  });

  it('clears the password for a null, and for a non-string', async () => {
    for (const password of [null, 42, undefined]) {
      const { ctx } = ctxFor('PUT', '/api/diagrams/d_1/share-password', { body: { password } });
      await handleDiagramShareRoutes(ctx);
      expect(db.setDiagramSharePassword).toHaveBeenLastCalledWith({}, 'd_1', null);
    }
  });

  it('clears the password when the request carries no readable body', async () => {
    const { ctx } = ctxFor('PUT', '/api/diagrams/d_1/share-password');
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(200);
    expect(db.setDiagramSharePassword).toHaveBeenCalledWith({}, 'd_1', null);
  });

  it('400s a password past the limit, storing nothing', async () => {
    const { ctx } = ctxFor('PUT', '/api/diagrams/d_1/share-password', {
      body: { password: 'x'.repeat(MAX_PASSWORD_LEN + 1) },
    });
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(400);
    expect(db.setDiagramSharePassword).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/diagrams/:id/share/:code — revoking one link', () => {
  it('deletes the code and tells the room, so hydrated visitors redirect', async () => {
    const { env, broadcasts } = roomEnv();
    const { ctx } = ctxFor('DELETE', '/api/diagrams/d_1/share/c1', { env });
    const res = await handleDiagramShareRoutes(ctx);
    expect(res!.status).toBe(204);
    expect(db.deleteShareLink).toHaveBeenCalledWith(env, 'c1');
    expect(broadcasts).toEqual([{ op: { kind: 'share-revoked', code: 'c1' } }]);
  });

  it('still revokes when the room broadcast fails — persistence is the truth', async () => {
    const env = {
      DIAGRAM_ROOM: {
        idFromName: () => 'id',
        get: () => ({ fetch: async () => Promise.reject(new Error('room down')) }),
      },
    } as unknown as Env;
    const { ctx } = ctxFor('DELETE', '/api/diagrams/d_1/share/c1', { env });
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(204);
    expect(db.deleteShareLink).toHaveBeenCalled();
  });

  it('404s a code that belongs to a different diagram, leaving that link alive', async () => {
    // Owning d_1 must not let you revoke somebody else's link by its code.
    db.getShareLinkIncludingExpired.mockResolvedValueOnce({ code: 'c1', diagramId: 'd_other' });
    const { env, broadcasts } = roomEnv();
    const { ctx } = ctxFor('DELETE', '/api/diagrams/d_1/share/c1', { env });
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(404);
    expect(db.deleteShareLink).not.toHaveBeenCalled();
    expect(broadcasts).toEqual([]);
  });
});

describe('POST /api/diagrams/:id/share/:code/extend (spec/34)', () => {
  it('re-arms the link and returns it', async () => {
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share/c1/extend', { body: {} });
    const res = await handleDiagramShareRoutes(ctx);
    expect(await res!.json()).toEqual({ link: { code: 'c1', expiresAt: 9_999 } });
  });

  it('404s a code that belongs to a different diagram', async () => {
    // The code is a bearer value; without this check an owner could extend
    // somebody else's link by quoting it against their own diagram id.
    db.getShareLinkIncludingExpired.mockResolvedValue({ code: 'c1', diagramId: 'other' });
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share/c1/extend', { body: {} });
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(404);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });

  it('404s a code that does not exist', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(null);
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share/c1/extend', { body: {} });
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(404);
  });

  it('400s a link that never expires — there is nothing to extend', async () => {
    db.extendShareLink.mockResolvedValue(null);
    const { ctx } = ctxFor('POST', '/api/diagrams/d_1/share/c1/extend', { body: {} });
    expect((await handleDiagramShareRoutes(ctx))!.status).toBe(400);
  });
});
