import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Route-entry guards in routes/context.ts: identity resolution + the
// owner/share authorisation ladder (400 no-owner, 404 missing,
// 403 foreign), plus the header readers. The 404-before-403 ordering is
// a deliberate access-trust property (a foreign id can't be distinguished
// from a missing one until ownership is proven), so it's worth pinning.

const { db } = vi.hoisted(() => ({ db: { getDiagram: vi.fn(), getMembership: vi.fn() } }));
vi.mock('../db', () => db);

const { access } = vi.hoisted(() => ({
  access: { canReadDiagram: vi.fn(), canEditDiagram: vi.fn() },
}));
vi.mock('../auth/diagram-access', () => access);

import type { RouteContext } from './context';
import {
  ownsDiagram,
  requireDiagramAccess,
  requireOwnedDiagram,
  requireOwner,
  sharePasswordOf,
} from './context';

function makeCtx(
  opts: { owner?: string | null; headers?: Record<string, string> } = {},
): RouteContext {
  const owner = opts.owner === undefined ? 'owner-1' : opts.owner;
  const url = new URL('https://api.test/api/diagrams/d1');
  const request = new Request(url, { headers: opts.headers ?? {} });
  return {
    request,
    env: {} as Env,
    url,
    segments: url.pathname.replace(/^\//, '').split('/'),
    clerkUserId: null,
    verifiedUserId: null,
    clerkEmail: null,
    resolveOwner: () => owner,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sharePasswordOf', () => {
  it('reads the X-Share-Password header, else null', () => {
    expect(sharePasswordOf(makeCtx({ headers: { 'X-Share-Password': 'hunter2' } }).request)).toBe(
      'hunter2',
    );
    expect(sharePasswordOf(makeCtx().request)).toBeNull();
  });
});

describe('requireOwner', () => {
  it('returns the resolved owner id', () => {
    expect(requireOwner(makeCtx({ owner: 'owner-1' }))).toBe('owner-1');
  });

  it('returns a 400 response when no caller is identified', () => {
    const out = requireOwner(makeCtx({ owner: null }));
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(400);
  });
});

describe('requireOwnedDiagram', () => {
  it('400s when there is no owner', async () => {
    const out = await requireOwnedDiagram(makeCtx({ owner: null }), 'd1');
    expect((out as Response).status).toBe(400);
    expect(db.getDiagram).not.toHaveBeenCalled();
  });

  it('404s when the diagram is missing (before any ownership check)', async () => {
    db.getDiagram.mockResolvedValue(null);
    const out = await requireOwnedDiagram(makeCtx({ owner: 'owner-1' }), 'd1');
    expect((out as Response).status).toBe(404);
  });

  it('403s when the diagram belongs to someone else', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'someone-else', teamId: null });
    const out = await requireOwnedDiagram(makeCtx({ owner: 'owner-1' }), 'd1');
    expect((out as Response).status).toBe(403);
  });

  it('returns the diagram when the caller owns it', async () => {
    const diagram = { id: 'd1', ownerId: 'owner-1', teamId: null };
    db.getDiagram.mockResolvedValue(diagram);
    const out = await requireOwnedDiagram(makeCtx({ owner: 'owner-1' }), 'd1');
    expect(out).toBe(diagram);
  });

  // A TEAM diagram's owner id is a Clerk id every teammate can read off
  // `GET /api/teams/<id>` (`members[].userId`), so the hybrid X-Owner-Id path
  // must not prove ownership of one — otherwise a removed member who kept the
  // id reaches the owner-only surfaces this guard fronts: the share password
  // in the clear, minting an edit-role link, clearing the password, wiping a
  // tab's audit trail.
  it('403s a TEAM diagram when the owner id arrives only as the guest header', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'user_owner', teamId: 'team-1' });
    // resolveOwner() returns the header value; verifiedUserId stays null.
    const out = await requireOwnedDiagram(makeCtx({ owner: 'user_owner' }), 'd1');
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(403);
  });

  it('returns a TEAM diagram to its owner on a VERIFIED account id', async () => {
    const diagram = { id: 'd1', ownerId: 'user_owner', teamId: 'team-1' };
    db.getDiagram.mockResolvedValue(diagram);
    db.getMembership.mockResolvedValue({ status: 'joined' });
    const ctx = { ...makeCtx({ owner: 'user_owner' }), verifiedUserId: 'user_owner' };
    expect(await requireOwnedDiagram(ctx, 'd1')).toBe(diagram);
  });

  it('403s a TEAM diagram to an owner who is no longer in the team (docs/specs/013-workspace/team-shared-diagrams.md)', async () => {
    // Removed (or left) before their work was handed on: owning the row must
    // not keep the share-link, password and delete routes open to them.
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'user_owner', teamId: 'team-1' });
    db.getMembership.mockResolvedValue(null);
    const ctx = { ...makeCtx({ owner: 'user_owner' }), verifiedUserId: 'user_owner' };
    expect(((await requireOwnedDiagram(ctx, 'd1')) as Response).status).toBe(403);
  });

  it('403s a TEAM diagram for a verified caller who is not its owner', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'user_owner', teamId: 'team-1' });
    const ctx = { ...makeCtx({ owner: 'user_other' }), verifiedUserId: 'user_other' };
    expect(((await requireOwnedDiagram(ctx, 'd1')) as Response).status).toBe(403);
  });

  // The personal path is unchanged and must stay that way: a guest owner id is
  // an unguessable server-minted UUID, which is what makes the header safe
  // there, and every signed-out author depends on it.
  it('still accepts the guest header for a PERSONAL diagram', async () => {
    const diagram = { id: 'd1', ownerId: 'guest-uuid', teamId: null };
    db.getDiagram.mockResolvedValue(diagram);
    expect(await requireOwnedDiagram(makeCtx({ owner: 'guest-uuid' }), 'd1')).toBe(diagram);
  });
});

describe('ownsDiagram', () => {
  it('requires a verified account id for a team diagram, not the header', async () => {
    db.getMembership.mockResolvedValue({ status: 'joined' });
    const team = { ownerId: 'user_owner', teamId: 'team-1' };
    expect(await ownsDiagram(makeCtx({ owner: 'user_owner' }), team)).toBe(false);
    expect(
      await ownsDiagram({ ...makeCtx({ owner: null }), verifiedUserId: 'user_owner' }, team),
    ).toBe(true);
  });

  it('requires the owner of a team diagram to still be a joined member', async () => {
    db.getMembership.mockResolvedValue(null);
    const team = { ownerId: 'user_owner', teamId: 'team-1' };
    expect(
      await ownsDiagram({ ...makeCtx({ owner: null }), verifiedUserId: 'user_owner' }, team),
    ).toBe(false);
  });

  it('accepts the hybrid identity for a personal diagram', async () => {
    const personal = { ownerId: 'guest-uuid', teamId: null };
    expect(await ownsDiagram(makeCtx({ owner: 'guest-uuid' }), personal)).toBe(true);
    expect(await ownsDiagram(makeCtx({ owner: 'someone-else' }), personal)).toBe(false);
  });

  it('is false when neither identity resolves', async () => {
    expect(await ownsDiagram(makeCtx({ owner: null }), { ownerId: 'x', teamId: null })).toBe(false);
    expect(await ownsDiagram(makeCtx({ owner: null }), { ownerId: 'x', teamId: 't' })).toBe(false);
  });
});

describe('requireDiagramAccess', () => {
  it('404s a missing diagram before gating', async () => {
    db.getDiagram.mockResolvedValue(null);
    const out = await requireDiagramAccess(makeCtx({ owner: 'g' }), 'd1', 'read');
    expect((out as Response).status).toBe(404);
    expect(access.canReadDiagram).not.toHaveBeenCalled();
  });

  it('403s when the read gate denies access', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'other', teamId: null });
    access.canReadDiagram.mockResolvedValue(false);
    const out = await requireDiagramAccess(makeCtx({ owner: 'g' }), 'd1', 'read');
    expect((out as Response).status).toBe(403);
  });

  it('returns the diagram when the gate allows it', async () => {
    const diagram = { id: 'd1', ownerId: 'other', teamId: null };
    db.getDiagram.mockResolvedValue(diagram);
    access.canReadDiagram.mockResolvedValue(true);
    const out = await requireDiagramAccess(makeCtx({ owner: 'g' }), 'd1', 'read');
    expect(out).toBe(diagram);
  });

  it('uses the edit gate (not read) in edit mode', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'other', teamId: null });
    access.canEditDiagram.mockResolvedValue(true);
    await requireDiagramAccess(makeCtx({ owner: 'g' }), 'd1', 'edit');
    expect(access.canEditDiagram).toHaveBeenCalledOnce();
    expect(access.canReadDiagram).not.toHaveBeenCalled();
  });

  it('forwards verifiedUserId (session OR api token) to the team-membership check', async () => {
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'other', teamId: 'team-1' });
    access.canReadDiagram.mockResolvedValue(true);
    // A token caller: no Clerk session, but a server-verified account id.
    const ctx = { ...makeCtx({ owner: 'user-9' }), verifiedUserId: 'user-9' };
    await requireDiagramAccess(ctx, 'd1', 'read');
    expect(access.canReadDiagram).toHaveBeenCalledWith(
      ctx.env,
      'd1',
      'user-9',
      null,
      'other',
      null,
      'team-1',
      'user-9',
    );
  });
});
