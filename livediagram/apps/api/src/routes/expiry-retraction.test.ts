// The expiry sweep writes `share_link_expiring` FUTURE-dated, so it lands in the timeline band above Today whose
// whole purpose is telling the owner about breakage BEFORE it happens (docs/specs/013-workspace/timeline.md §4.5).
// The actions that make the warning untrue (revoking the link, or extending its deadline) take it back. These cases
// pin the retraction at each site, and pin that it is NARROW: every assertion on the eventType argument is
// load-bearing, since a retraction keyed on source alone would erase real history to withdraw a warning.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    // tokens.ts
    mintApiToken: vi.fn(),
    revokePresentedToken: vi.fn(),
    // document-share-routes.ts
    createShareLink: vi.fn(),
    deleteShareLink: vi.fn(),
    extendShareLink: vi.fn(),
    generateShareCode: vi.fn(() => 'code_new'),
    getDocument: vi.fn(),
    getDocumentSharePassword: vi.fn(),
    getShareLinkIncludingExpired: vi.fn(),
    listShareLinks: vi.fn(),
    setDocumentShare: vi.fn(),
    setDocumentSharePassword: vi.fn(),
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
// Revoking also ends the token's workbench access (routes/tokens.ts), in its owner's workbench store.
vi.mock('../workbench-store', () => ({
  workbenchStore: () => ({ endAccess: vi.fn(async () => {}) }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleTokens } from './tokens';
import { handleDocumentShareRoutes } from './document-share-routes';

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
  db.revokePresentedToken.mockResolvedValue(undefined);
  db.getDocument.mockResolvedValue({ id: 'd_1', ownerId: 'user_1', tabs: [] });
  db.listShareLinks.mockResolvedValue([{ code: 'c1' }, { code: 'c2' }]);
  db.setDocumentShare.mockResolvedValue(undefined);
  db.deleteShareLink.mockResolvedValue(undefined);
  db.getShareLinkIncludingExpired.mockResolvedValue({ code: 'c1', documentId: 'd_1' });
  db.extendShareLink.mockResolvedValue({ code: 'c1', expiresAt: 9_999 });
});

describe('a token revoking itself', () => {
  // An API token's expiry warning is liveworkspace's (it keeps the tokens), so this feed holds no token_expiring
  // row to retract: the revoke records only its own event.
  it('records the revoke and retracts nothing', async () => {
    const { waitUntil, settle } = deferred();
    const res = await handleTokens(
      makeTestRouteContext('DELETE', '/api/tokens/current', {
        accountUserId: null,
        owner: 'user_1',
        token: { id: 'tok_1', name: 'CI', readOnly: false, expiresAt: 99 },
        headers: { Authorization: 'Bearer lwt_secret' },
        waitUntil,
      }),
    );
    expect(res.status).toBe(204);
    await settle();
    expect(db.retractTimelineWarning).not.toHaveBeenCalled();
  });
});

describe('share-link changes retract the document expiry warning', () => {
  // The single-code revoke also broadcasts 'share-revoked' into the document's
  // Durable Object room so hydrated visitors hard-redirect; that is UX, not the
  // subject here, so the binding is a no-op stub.
  const roomEnv = {
    DOCUMENT_ROOM: {
      idFromName: () => 'id',
      get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
    },
  } as unknown as Env;

  const shareCtx = (method: string, path: string) =>
    makeTestRouteContext(method, path, {
      accountUserId: 'user_1',
      owner: 'user_1',
      env: roomEnv,
    });

  const expectRetracted = () =>
    expect(db.retractTimelineWarning).toHaveBeenCalledWith(
      expect.anything(),
      'document',
      'd_1',
      'share_link_expiring',
    );

  it('bulk revoke retracts', async () => {
    const res = await handleDocumentShareRoutes(shareCtx('DELETE', '/api/documents/d_1/share'));
    expect(res?.status).toBe(200);
    expectRetracted();
  });

  it('single-code revoke retracts', async () => {
    const res = await handleDocumentShareRoutes(shareCtx('DELETE', '/api/documents/d_1/share/c1'));
    expect(res?.status).toBe(204);
    expectRetracted();
  });

  it('extend retracts, because the deadline it quoted has moved', async () => {
    const res = await handleDocumentShareRoutes(
      shareCtx('POST', '/api/documents/d_1/share/c1/extend'),
    );
    expect(res?.status).toBe(200);
    expectRetracted();
  });

  it('a rejected extend (link never expires) retracts nothing', async () => {
    db.extendShareLink.mockResolvedValue(null);
    const res = await handleDocumentShareRoutes(
      shareCtx('POST', '/api/documents/d_1/share/c1/extend'),
    );
    expect(res?.status).toBe(400);
    expect(db.retractTimelineWarning).not.toHaveBeenCalled();
  });

  it('a non-owner caller gets 403 and retracts nothing', async () => {
    db.getDocument.mockResolvedValue({ id: 'd_1', ownerId: 'someone_else', tabs: [] });
    const res = await handleDocumentShareRoutes(shareCtx('DELETE', '/api/documents/d_1/share/c1'));
    expect(res?.status).toBe(403);
    expect(db.retractTimelineWarning).not.toHaveBeenCalled();
  });
});
