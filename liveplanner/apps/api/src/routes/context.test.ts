import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Route-entry guards in routes/context.ts: identity resolution + the
// owner/share authorisation ladder (400 no-owner, 404 missing,
// 403 foreign), plus the header readers. The 404-before-403 ordering is
// a deliberate access-trust property (a foreign id can't be distinguished
// from a missing one until ownership is proven), so it's worth pinning.

const { db } = vi.hoisted(() => ({
  db: {
    getProject: vi.fn(),
    getMembership: vi.fn(),
    getTrashedProjectMeta: vi.fn(async () => null),
  },
}));
vi.mock('../db', () => db);

const { access } = vi.hoisted(() => ({
  access: { canReadProject: vi.fn(), canEditProject: vi.fn(), resolveProjectGrant: vi.fn() },
}));
vi.mock('../auth/project-access', () => access);

import type { RouteContext } from './context';
import { ownsProject, requireOwnedProject, requireOwner, sharePasswordOf } from './context';

function makeCtx(
  opts: { owner?: string | null; headers?: Record<string, string> } = {},
): RouteContext {
  const owner = opts.owner === undefined ? 'owner-1' : opts.owner;
  const url = new URL('https://api.test/api/projects/d1');
  const request = new Request(url, { headers: opts.headers ?? {} });
  return {
    request,
    env: {} as Env,
    url,
    segments: url.pathname.replace(/^\//, '').split('/'),
    accountUserId: null,
    verifiedUserId: null,
    accountEmail: null,
    resolveOwner: () => owner,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sharePasswordOf', () => {
  // The attempt carries the caller's network, whose guessing budget a check
  // spends (docs/specs/013-workspace/share-password.md).
  it('reads the X-Share-Password header with the caller network, else null', () => {
    const request = makeCtx({
      headers: { 'X-Share-Password': 'hunter2', 'CF-Connecting-IP': '2001:db8:0:1::5' },
    }).request;
    expect(sharePasswordOf(request)).toEqual({
      value: 'hunter2',
      rateKey: '2001:0db8:0000:0001::/64',
    });
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

describe('requireOwnedProject', () => {
  it('400s when there is no owner', async () => {
    const out = await requireOwnedProject(makeCtx({ owner: null }), 'd1');
    expect((out as Response).status).toBe(400);
    expect(db.getProject).not.toHaveBeenCalled();
  });

  it('404s when the project is missing (before any ownership check)', async () => {
    db.getProject.mockResolvedValue(null);
    const out = await requireOwnedProject(makeCtx({ owner: 'owner-1' }), 'd1');
    expect((out as Response).status).toBe(404);
  });

  it('403s when the project belongs to someone else', async () => {
    db.getProject.mockResolvedValue({ id: 'd1', ownerId: 'someone-else', teamId: null });
    const out = await requireOwnedProject(makeCtx({ owner: 'owner-1' }), 'd1');
    expect((out as Response).status).toBe(403);
  });

  it('returns the project when the caller owns it', async () => {
    const liveDoc = { id: 'd1', ownerId: 'owner-1', teamId: null };
    db.getProject.mockResolvedValue(liveDoc);
    const out = await requireOwnedProject(makeCtx({ owner: 'owner-1' }), 'd1');
    expect(out).toBe(liveDoc);
  });

  // A TEAM project's owner id is an account id every teammate can read off
  // `GET /api/teams/<id>` (`members[].userId`), so the hybrid X-Owner-Id path
  // must not prove ownership of one — otherwise a removed member who kept the
  // id reaches the owner-only surfaces this guard fronts: the share password
  // in the clear, minting an edit-role link, clearing the password.
  it('403s a TEAM project when the owner id arrives only as the guest header', async () => {
    db.getProject.mockResolvedValue({ id: 'd1', ownerId: 'user_owner', teamId: 'team-1' });
    // resolveOwner() returns the header value; verifiedUserId stays null.
    const out = await requireOwnedProject(makeCtx({ owner: 'user_owner' }), 'd1');
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(403);
  });

  it('returns a TEAM project to its owner on a VERIFIED account id', async () => {
    const liveDoc = { id: 'd1', ownerId: 'user_owner', teamId: 'team-1' };
    db.getProject.mockResolvedValue(liveDoc);
    db.getMembership.mockResolvedValue({ status: 'joined' });
    const ctx = { ...makeCtx({ owner: 'user_owner' }), verifiedUserId: 'user_owner' };
    expect(await requireOwnedProject(ctx, 'd1')).toBe(liveDoc);
  });

  it('403s a TEAM project to an owner who is no longer in the team (docs/specs/013-workspace/team-shared-projects.md)', async () => {
    // Removed (or left) before their work was handed on: owning the row must
    // not keep the share-link, password and delete routes open to them.
    db.getProject.mockResolvedValue({ id: 'd1', ownerId: 'user_owner', teamId: 'team-1' });
    db.getMembership.mockResolvedValue(null);
    const ctx = { ...makeCtx({ owner: 'user_owner' }), verifiedUserId: 'user_owner' };
    expect(((await requireOwnedProject(ctx, 'd1')) as Response).status).toBe(403);
  });

  it('403s a TEAM project for a verified caller who is not its owner', async () => {
    db.getProject.mockResolvedValue({ id: 'd1', ownerId: 'user_owner', teamId: 'team-1' });
    const ctx = { ...makeCtx({ owner: 'user_other' }), verifiedUserId: 'user_other' };
    expect(((await requireOwnedProject(ctx, 'd1')) as Response).status).toBe(403);
  });

  // The personal path is unchanged and must stay that way: a guest owner id is
  // an unguessable server-minted UUID, which is what makes the header safe
  // there, and every signed-out author depends on it.
  it('still accepts the guest header for a PERSONAL project', async () => {
    const liveDoc = { id: 'd1', ownerId: 'guest-uuid', teamId: null };
    db.getProject.mockResolvedValue(liveDoc);
    expect(await requireOwnedProject(makeCtx({ owner: 'guest-uuid' }), 'd1')).toBe(liveDoc);
  });
});

describe('ownsProject', () => {
  it('requires a verified account id for a team project, not the header', async () => {
    db.getMembership.mockResolvedValue({ status: 'joined' });
    const team = { ownerId: 'user_owner', teamId: 'team-1' };
    expect(await ownsProject(makeCtx({ owner: 'user_owner' }), team)).toBe(false);
    expect(
      await ownsProject({ ...makeCtx({ owner: null }), verifiedUserId: 'user_owner' }, team),
    ).toBe(true);
  });

  it('requires the owner of a team project to still be a joined member', async () => {
    db.getMembership.mockResolvedValue(null);
    const team = { ownerId: 'user_owner', teamId: 'team-1' };
    expect(
      await ownsProject({ ...makeCtx({ owner: null }), verifiedUserId: 'user_owner' }, team),
    ).toBe(false);
  });

  it('accepts the hybrid identity for a personal project', async () => {
    const personal = { ownerId: 'guest-uuid', teamId: null };
    expect(await ownsProject(makeCtx({ owner: 'guest-uuid' }), personal)).toBe(true);
    expect(await ownsProject(makeCtx({ owner: 'someone-else' }), personal)).toBe(false);
  });

  it('is false when neither identity resolves', async () => {
    expect(await ownsProject(makeCtx({ owner: null }), { ownerId: 'x', teamId: null })).toBe(false);
    expect(await ownsProject(makeCtx({ owner: null }), { ownerId: 'x', teamId: 't' })).toBe(false);
  });
});
