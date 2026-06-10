import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '@livediagram/api-schema';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    addTeamMember: vi.fn(),
    connectInvitesByEmail: vi.fn(),
    countTeamAdmins: vi.fn(),
    createTeam: vi.fn(),
    deleteTeam: vi.fn(),
    getMembership: vi.fn(),
    getTeam: vi.fn(),
    getTeamMember: vi.fn(),
    listTeamMembers: vi.fn(),
    listTeamsByUser: vi.fn(),
    removeTeamMember: vi.fn(),
    teamHasEmail: vi.fn(),
    updateTeam: vi.fn(),
    updateTeamMemberRole: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleTeams } from './teams';

function makeCtx(
  method: string,
  path: string,
  opts: { clerkUserId?: string | null; clerkEmail?: string | null; body?: unknown } = {},
): RouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const clerkUserId = opts.clerkUserId === undefined ? 'user-1' : opts.clerkUserId;
  const clerkEmail = opts.clerkEmail === undefined ? null : opts.clerkEmail;
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return {
    request,
    env: {} as Env,
    url,
    segments,
    clerkUserId,
    clerkEmail,
    resolveOwner: () => clerkUserId ?? 'guest-1',
  };
}

const team = { id: 't1', name: 'Crew', organisation: null, createdAt: 1, updatedAt: 1 };

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'm1',
    teamId: 't1',
    userId: 'user-1',
    email: 'me@example.com',
    role: 'admin',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleTeams Clerk-only gate (spec/32)', () => {
  it('401 sign_in_required for the guest path, even with an X-Owner-Id-style owner', async () => {
    const res = await handleTeams(makeCtx('GET', '/api/teams', { clerkUserId: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
  });
});

describe('GET /api/teams (list + lazy invite claim)', () => {
  it('lists the teams the caller belongs to', async () => {
    db.listTeamsByUser.mockResolvedValue([{ ...team, myRole: 'admin', memberCount: 2 }]);
    const res = await handleTeams(makeCtx('GET', '/api/teams'));
    expect(res.status).toBe(200);
    expect(db.listTeamsByUser).toHaveBeenCalledWith({}, 'user-1');
    expect(db.connectInvitesByEmail).not.toHaveBeenCalled();
  });

  it('claims pending invites first when the JWT carries an email claim', async () => {
    db.listTeamsByUser.mockResolvedValue([]);
    await handleTeams(makeCtx('GET', '/api/teams', { clerkEmail: 'me@example.com' }));
    expect(db.connectInvitesByEmail).toHaveBeenCalledWith({}, 'user-1', 'me@example.com');
  });
});

describe('POST /api/teams (create)', () => {
  it('creates the team with the caller as Admin', async () => {
    db.createTeam.mockResolvedValue(team);
    const res = await handleTeams(
      makeCtx('POST', '/api/teams', {
        clerkEmail: 'me@example.com',
        body: { id: 't1', name: 'Crew', organisation: ' ACME ' },
      }),
    );
    expect(res.status).toBe(201);
    expect(db.createTeam).toHaveBeenCalledWith(
      {},
      { id: 't1', name: 'Crew', organisation: 'ACME' },
      { userId: 'user-1', email: 'me@example.com' },
    );
  });

  it('400 when name is missing', async () => {
    const res = await handleTeams(makeCtx('POST', '/api/teams', { body: { id: 't1' } }));
    expect(res.status).toBe(400);
  });
});

describe('team-scoped access', () => {
  it('404 for a non-member (no existence probing)', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(null);
    const res = await handleTeams(makeCtx('GET', '/api/teams/t1'));
    expect(res.status).toBe(404);
  });

  it('GET returns team + members + myRole for a member', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    db.listTeamMembers.mockResolvedValue([member()]);
    const res = await handleTeams(makeCtx('GET', '/api/teams/t1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { myRole: string };
    expect(body.myRole).toBe('member');
  });

  it('PUT (edit) is admin-only: member gets 403', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    const res = await handleTeams(makeCtx('PUT', '/api/teams/t1', { body: { name: 'New name' } }));
    expect(res.status).toBe(403);
    expect(db.updateTeam).not.toHaveBeenCalled();
  });

  it('DELETE removes the team for an admin', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member());
    const res = await handleTeams(makeCtx('DELETE', '/api/teams/t1'));
    expect(res.status).toBe(204);
    expect(db.deleteTeam).toHaveBeenCalledWith({}, 't1');
  });
});

describe('POST /api/teams/:id/members (invite)', () => {
  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member());
  });

  it('creates a pending member row with the lowercased email', async () => {
    db.teamHasEmail.mockResolvedValue(false);
    db.addTeamMember.mockResolvedValue(member({ id: 'm2', userId: null, role: 'member' }));
    const res = await handleTeams(
      makeCtx('POST', '/api/teams/t1/members', { body: { email: ' New@Example.COM ' } }),
    );
    expect(res.status).toBe(201);
    expect(db.addTeamMember).toHaveBeenCalledWith({}, { teamId: 't1', email: 'new@example.com' });
  });

  it('409 already_member on a duplicate address', async () => {
    db.teamHasEmail.mockResolvedValue(true);
    const res = await handleTeams(
      makeCtx('POST', '/api/teams/t1/members', { body: { email: 'me@example.com' } }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_member' });
  });

  it('400 on a malformed address', async () => {
    const res = await handleTeams(
      makeCtx('POST', '/api/teams/t1/members', { body: { email: 'not-an-email' } }),
    );
    expect(res.status).toBe(400);
  });

  it('403 for a plain member', async () => {
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    const res = await handleTeams(
      makeCtx('POST', '/api/teams/t1/members', { body: { email: 'x@example.com' } }),
    );
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/teams/:id/members/:memberId (role change)', () => {
  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member());
  });

  it('promotes a member to admin', async () => {
    const target = member({ id: 'm2', userId: 'user-2', role: 'member' });
    db.getTeamMember.mockResolvedValue(target);
    const res = await handleTeams(
      makeCtx('PUT', '/api/teams/t1/members/m2', { body: { role: 'admin' } }),
    );
    expect(res.status).toBe(200);
    expect(db.updateTeamMemberRole).toHaveBeenCalledWith({}, 'm2', 'admin');
  });

  it('409 last_admin when demoting the only admin', async () => {
    db.getTeamMember.mockResolvedValue(member());
    db.countTeamAdmins.mockResolvedValue(1);
    const res = await handleTeams(
      makeCtx('PUT', '/api/teams/t1/members/m1', { body: { role: 'member' } }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'last_admin' });
    expect(db.updateTeamMemberRole).not.toHaveBeenCalled();
  });

  it('404 when the member row belongs to a different team', async () => {
    db.getTeamMember.mockResolvedValue(member({ teamId: 'other-team' }));
    const res = await handleTeams(
      makeCtx('PUT', '/api/teams/t1/members/m1', { body: { role: 'member' } }),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/teams/:id/members/:memberId (remove / leave)', () => {
  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
  });

  it('admin removes another member', async () => {
    db.getMembership.mockResolvedValue(member());
    db.getTeamMember.mockResolvedValue(member({ id: 'm2', userId: 'user-2', role: 'member' }));
    const res = await handleTeams(makeCtx('DELETE', '/api/teams/t1/members/m2'));
    expect(res.status).toBe(204);
    expect(db.removeTeamMember).toHaveBeenCalledWith({}, 'm2');
  });

  it('a member may remove their own row (leave)', async () => {
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    db.getTeamMember.mockResolvedValue(member({ role: 'member' }));
    const res = await handleTeams(makeCtx('DELETE', '/api/teams/t1/members/m1'));
    expect(res.status).toBe(204);
  });

  it("403 when a member tries to remove someone else's row", async () => {
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    db.getTeamMember.mockResolvedValue(member({ id: 'm2', userId: 'user-2', role: 'member' }));
    const res = await handleTeams(makeCtx('DELETE', '/api/teams/t1/members/m2'));
    expect(res.status).toBe(403);
    expect(db.removeTeamMember).not.toHaveBeenCalled();
  });

  it('409 last_admin when the only admin tries to leave', async () => {
    db.getMembership.mockResolvedValue(member());
    db.getTeamMember.mockResolvedValue(member());
    db.countTeamAdmins.mockResolvedValue(1);
    const res = await handleTeams(makeCtx('DELETE', '/api/teams/t1/members/m1'));
    expect(res.status).toBe(409);
  });
});
