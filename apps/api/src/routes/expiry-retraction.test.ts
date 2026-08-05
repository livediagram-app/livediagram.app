// The expiry sweep writes `token_expiring` and `share_link_expiring`
// FUTURE-dated, so they land in the timeline band above Today whose whole
// purpose is telling the owner about breakage BEFORE it happens (spec/138
// §4.5). Nothing ever took those rows back, so the two actions that make the
// warning untrue — revoking the credential, or extending the link's deadline —
// left it standing: the feed counted down to a token expiry directly above its
// own "API Token Revoked" row.
//
// These cases pin the retraction at each of the four sites, and pin that it is
// NARROW: the token's own `token_created` row shares its source id, so a
// retraction keyed on source alone would erase real history to withdraw a
// warning. Every assertion below on the eventType argument is load-bearing for
// that reason, not incidental.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    // tokens.ts
    listApiTokensByOwner: vi.fn(),
    mintApiToken: vi.fn(),
    revokeApiToken: vi.fn(),
    // diagram-share-routes.ts
    createShareLink: vi.fn(),
    deleteShareLink: vi.fn(),
    extendShareLink: vi.fn(),
    generateShareCode: vi.fn(() => 'code_new'),
    getDiagram: vi.fn(),
    getDiagramSharePassword: vi.fn(),
    getShareLinkIncludingExpired: vi.fn(),
    listShareLinks: vi.fn(),
    setDiagramShare: vi.fn(),
    setDiagramSharePassword: vi.fn(),
    // the subject of this suite
    retractTimelineWarning: vi.fn(),
  },
}));
vi.mock('../db', () => db);
vi.mock('../timeline', () => ({
  recordTokenCreated: vi.fn(async () => {}),
  recordTokenRevoked: vi.fn(async () => {}),
  recordShareLinkCreated: vi.fn(async () => {}),
}));
vi.mock('../email/client', () => ({ emailEnabled: () => false }));
vi.mock('../email/notifications', () => ({ notifyFirstShare: vi.fn(async () => {}) }));

import { makeTestRouteContext } from './test-route-context';
import { handleTokens } from './tokens';
import { handleDiagramShareRoutes } from './diagram-share-routes';

// Collects the promises handed to ctx.waitUntil so the assertions can await
// the fire-and-forget work. Without a waitUntil the optional call short-
// circuits and never evaluates its argument at all, which is exactly how the
// pre-existing route suites stay synchronous.
function deferred() {
  const pending: Promise<unknown>[] = [];
  return {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    settle: () => Promise.all(pending),
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) if (typeof fn === 'function') fn.mockReset();
  db.retractTimelineWarning.mockResolvedValue(undefined);
  db.revokeApiToken.mockResolvedValue(true);
  db.listApiTokensByOwner.mockResolvedValue([{ id: 'tok_1', name: 'CI' }]);
  db.getDiagram.mockResolvedValue({ id: 'd_1', ownerId: 'user_1', tabs: [] });
  db.listShareLinks.mockResolvedValue([{ code: 'c1' }, { code: 'c2' }]);
  db.setDiagramShare.mockResolvedValue(undefined);
  db.deleteShareLink.mockResolvedValue(undefined);
  db.getShareLinkIncludingExpired.mockResolvedValue({ code: 'c1', diagramId: 'd_1' });
  db.extendShareLink.mockResolvedValue({ code: 'c1', expiresAt: 9_999 });
});

describe('token revoke retracts its expiry warning', () => {
  it('retracts token_expiring for the revoked token id', async () => {
    const { waitUntil, settle } = deferred();
    const ctx = makeTestRouteContext('DELETE', '/api/tokens/tok_1', {
      clerkUserId: 'user_1',
      owner: 'user_1',
      waitUntil,
    });
    const res = await handleTokens(ctx);
    expect(res.status).toBe(204);
    await settle();
    expect(db.retractTimelineWarning).toHaveBeenCalledWith(
      expect.anything(),
      'account',
      'tok_1',
      'token_expiring',
    );
  });

  it('leaves the timeline alone when nothing was revoked', async () => {
    db.revokeApiToken.mockResolvedValue(false);
    const { waitUntil, settle } = deferred();
    const res = await handleTokens(
      makeTestRouteContext('DELETE', '/api/tokens/tok_1', {
        clerkUserId: 'user_1',
        owner: 'user_1',
        waitUntil,
      }),
    );
    expect(res.status).toBe(404);
    await settle();
    expect(db.retractTimelineWarning).not.toHaveBeenCalled();
  });
});

describe('share-link changes retract the diagram expiry warning', () => {
  // The single-code revoke also broadcasts 'share-revoked' into the diagram's
  // Durable Object room so hydrated visitors hard-redirect; that is UX, not the
  // subject here, so the binding is a no-op stub.
  const roomEnv = {
    DIAGRAM_ROOM: {
      idFromName: () => 'id',
      get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
    },
  } as unknown as Env;

  const shareCtx = (method: string, path: string) =>
    makeTestRouteContext(method, path, {
      clerkUserId: 'user_1',
      owner: 'user_1',
      env: roomEnv,
    });

  const expectRetracted = () =>
    expect(db.retractTimelineWarning).toHaveBeenCalledWith(
      expect.anything(),
      'diagram',
      'd_1',
      'share_link_expiring',
    );

  it('bulk revoke retracts', async () => {
    const res = await handleDiagramShareRoutes(shareCtx('DELETE', '/api/diagrams/d_1/share'));
    expect(res?.status).toBe(200);
    expectRetracted();
  });

  it('single-code revoke retracts', async () => {
    const res = await handleDiagramShareRoutes(shareCtx('DELETE', '/api/diagrams/d_1/share/c1'));
    expect(res?.status).toBe(204);
    expectRetracted();
  });

  it('extend retracts, because the deadline it quoted has moved', async () => {
    const res = await handleDiagramShareRoutes(
      shareCtx('POST', '/api/diagrams/d_1/share/c1/extend'),
    );
    expect(res?.status).toBe(200);
    expectRetracted();
  });

  it('a rejected extend (link never expires) retracts nothing', async () => {
    db.extendShareLink.mockResolvedValue(null);
    const res = await handleDiagramShareRoutes(
      shareCtx('POST', '/api/diagrams/d_1/share/c1/extend'),
    );
    expect(res?.status).toBe(400);
    expect(db.retractTimelineWarning).not.toHaveBeenCalled();
  });

  it('a non-owner caller gets 403 and retracts nothing', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd_1', ownerId: 'someone_else', tabs: [] });
    const res = await handleDiagramShareRoutes(shareCtx('DELETE', '/api/diagrams/d_1/share/c1'));
    expect(res?.status).toBe(403);
    expect(db.retractTimelineWarning).not.toHaveBeenCalled();
  });
});
