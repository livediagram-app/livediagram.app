import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '@livediagram/api-schema';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    acceptTeamMember: vi.fn(),
    addTeamMember: vi.fn(),
    getDiagramMeta: vi.fn(),
    getParticipant: vi.fn(),
    hasSharedAccess: vi.fn(),
    listInvitesByUser: vi.fn(),
    connectInvitesByEmail: vi.fn(),
    countJoinedMembers: vi.fn(),
    countTeamAdmins: vi.fn(),
    createTeam: vi.fn(),
    deleteTeam: vi.fn(),
    getMembership: vi.fn(),
    getTeam: vi.fn(),
    getTeamByInviteToken: vi.fn(),
    getTeamInviteLink: vi.fn(),
    getTeamMember: vi.fn(),
    joinTeamByInviteToken: vi.fn(),
    listDiagramsByTeam: vi.fn(),
    listFoldersByTeam: vi.fn(),
    listTeamMembers: vi.fn(),
    listTeamsByUser: vi.fn(),
    removeTeamMember: vi.fn(),
    setTeamInviteLink: vi.fn(),
    teamHasEmail: vi.fn(),
    updateTeam: vi.fn(),
    updateTeamMemberRole: vi.fn(),
    // The route imports this constant from '../db'; the mock replaces
    // the whole module, so provide it as a value (one week in ms).
    TEAM_INVITE_LINK_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  },
}));
vi.mock('../db', () => db);
// Observe the spec/68 notify dispatch without exercising the email stack.
vi.mock('../email/notifications', () => ({
  notifyActionAssigned: vi.fn().mockResolvedValue(undefined),
  notifyInviteResponse: vi.fn().mockResolvedValue(undefined),
}));

import type { RouteContext } from './context';
import { notifyActionAssigned } from '../email/notifications';
import { handleTeams } from './teams';

function makeCtx(
  method: string,
  path: string,
  opts: {
    clerkUserId?: string | null;
    clerkEmail?: string | null;
    // A token caller (spec/61): verified account id with NO Clerk session.
    verifiedUserId?: string | null;
    body?: unknown;
  } = {},
): RouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const clerkUserId = opts.clerkUserId === undefined ? 'user-1' : opts.clerkUserId;
  const verifiedUserId = opts.verifiedUserId === undefined ? clerkUserId : opts.verifiedUserId;
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
    verifiedUserId,
    clerkEmail,
    resolveOwner: () => verifiedUserId ?? 'guest-1',
    // Evaluate the deferred work inline so tests can observe the dispatch
    // (`ctx.waitUntil?.(...)` skips its argument entirely when absent).
    waitUntil: (p: Promise<unknown>) => void p.catch(() => {}),
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
    status: 'joined',
    name: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  // `db` also holds a non-fn constant (TEAM_INVITE_LINK_TTL_MS) now.
  for (const fn of Object.values(db)) if (typeof fn === 'function') fn.mockReset();
});

describe('handleTeams Clerk-only gate (spec/32)', () => {
  it('401 sign_in_required for the guest path, even with an X-Owner-Id-style owner', async () => {
    const res = await handleTeams(makeCtx('GET', '/api/teams', { clerkUserId: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
  });
});

describe('API-token callers (spec/61 §3.4: read yes, manage no)', () => {
  // A token request verifies to the Clerk account (verifiedUserId) but
  // carries no interactive session (clerkUserId null).
  const asToken = { clerkUserId: null, verifiedUserId: 'user-1' };

  it('lists the caller’s teams', async () => {
    db.listTeamsByUser.mockResolvedValue([{ ...team, myRole: 'member', memberCount: 2 }]);
    const res = await handleTeams(makeCtx('GET', '/api/teams', asToken));
    expect(res.status).toBe(200);
    expect(db.listTeamsByUser).toHaveBeenCalledWith({}, 'user-1');
  });

  it('reads a joined team’s shared library', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    db.listFoldersByTeam.mockResolvedValue([]);
    db.listDiagramsByTeam.mockResolvedValue([{ id: 'd1', name: 'Team doc' }]);
    const res = await handleTeams(makeCtx('GET', '/api/teams/t1/library', asToken));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ folders: [], diagrams: [{ id: 'd1', name: 'Team doc' }] });
  });

  it('401s every mutation — token holders cannot manage teams', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member());
    for (const [method, path, body] of [
      ['POST', '/api/teams', { id: 't9', name: 'New' }],
      ['PUT', '/api/teams/t1', { name: 'Renamed' }],
      ['DELETE', '/api/teams/t1', undefined],
      ['POST', '/api/teams/t1/members', { email: 'x@example.com' }],
      ['POST', '/api/teams/t1/invite-link', undefined],
    ] as const) {
      const res = await handleTeams(makeCtx(method, path, { ...asToken, body }));
      expect(res.status, `${method} ${path}`).toBe(401);
    }
    expect(db.createTeam).not.toHaveBeenCalled();
    expect(db.updateTeam).not.toHaveBeenCalled();
    expect(db.deleteTeam).not.toHaveBeenCalled();
    expect(db.addTeamMember).not.toHaveBeenCalled();
    expect(db.setTeamInviteLink).not.toHaveBeenCalled();
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

describe('GET /api/teams/invites (spec/32 accept/decline)', () => {
  it('lazy-claims then lists the pending invites', async () => {
    db.listInvitesByUser.mockResolvedValue([
      { memberId: 'm2', team, memberCount: 3, invitedAt: 5 },
    ]);
    const res = await handleTeams(
      makeCtx('GET', '/api/teams/invites', { clerkEmail: 'me@example.com' }),
    );
    expect(res.status).toBe(200);
    expect(db.connectInvitesByEmail).toHaveBeenCalledWith({}, 'user-1', 'me@example.com');
    expect(db.listInvitesByUser).toHaveBeenCalledWith({}, 'user-1');
  });

  it('401 for the guest path', async () => {
    const res = await handleTeams(makeCtx('GET', '/api/teams/invites', { clerkUserId: null }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/teams/:id/members/:memberId/accept', () => {
  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
  });

  it("flips the caller's own invited row to joined", async () => {
    db.getMembership.mockResolvedValue(member({ role: 'member', status: 'invited' }));
    db.getTeamMember.mockResolvedValue(member({ role: 'member', status: 'invited' }));
    const res = await handleTeams(makeCtx('POST', '/api/teams/t1/members/m1/accept'));
    expect(res.status).toBe(200);
    expect(db.acceptTeamMember).toHaveBeenCalledWith({}, 'm1');
  });

  it("403 not_your_invite on someone else's row", async () => {
    db.getMembership.mockResolvedValue(member());
    db.getTeamMember.mockResolvedValue(
      member({ id: 'm2', userId: 'user-2', role: 'member', status: 'invited' }),
    );
    const res = await handleTeams(makeCtx('POST', '/api/teams/t1/members/m2/accept'));
    expect(res.status).toBe(403);
    expect(db.acceptTeamMember).not.toHaveBeenCalled();
  });

  it('is idempotent on an already-joined row (no rewrite)', async () => {
    db.getMembership.mockResolvedValue(member());
    db.getTeamMember.mockResolvedValue(member());
    const res = await handleTeams(makeCtx('POST', '/api/teams/t1/members/m1/accept'));
    expect(res.status).toBe(200);
    expect(db.acceptTeamMember).not.toHaveBeenCalled();
  });
});

describe('shareable invite link (spec/32)', () => {
  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
  });

  it('admin turns the link on: mints a token + 1-week expiry, 201', async () => {
    db.getMembership.mockResolvedValue(member()); // admin, joined
    const res = await handleTeams(makeCtx('POST', '/api/teams/t1/invite-link'));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { inviteLink: { token: string; expiresAt: number } };
    expect(body.inviteLink.token).toBeTruthy();
    expect(body.inviteLink.expiresAt).toBeGreaterThan(Date.now());
    expect(db.setTeamInviteLink).toHaveBeenCalledWith(
      {},
      't1',
      body.inviteLink.token,
      body.inviteLink.expiresAt,
    );
  });

  it('a member cannot turn the link on (403)', async () => {
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    const res = await handleTeams(makeCtx('POST', '/api/teams/t1/invite-link'));
    expect(res.status).toBe(403);
    expect(db.setTeamInviteLink).not.toHaveBeenCalled();
  });

  it('admin turns the link off (DELETE clears the token, 204)', async () => {
    db.getMembership.mockResolvedValue(member());
    const res = await handleTeams(makeCtx('DELETE', '/api/teams/t1/invite-link'));
    expect(res.status).toBe(204);
    expect(db.setTeamInviteLink).toHaveBeenCalledWith({}, 't1', null, null);
  });

  it('resolves a valid token to its team — guest-accessible (above the sign-in gate)', async () => {
    db.getTeamByInviteToken.mockResolvedValue(team);
    db.countJoinedMembers.mockResolvedValue(3);
    const res = await handleTeams(
      makeCtx('GET', '/api/teams/invite-link/tok-123', { clerkUserId: null }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ team, memberCount: 3, alreadyMember: false });
    expect(db.getTeamByInviteToken).toHaveBeenCalledWith({}, 'tok-123');
  });

  it('resolve reports alreadyMember for a signed-in member', async () => {
    db.getTeamByInviteToken.mockResolvedValue(team);
    db.countJoinedMembers.mockResolvedValue(2);
    db.getMembership.mockResolvedValue(member());
    const res = await handleTeams(makeCtx('GET', '/api/teams/invite-link/tok-123'));
    expect(await res.json()).toMatchObject({ alreadyMember: true });
  });

  it('404 on an unknown / expired token', async () => {
    db.getTeamByInviteToken.mockResolvedValue(null);
    const res = await handleTeams(
      makeCtx('GET', '/api/teams/invite-link/nope', { clerkUserId: null }),
    );
    expect(res.status).toBe(404);
  });

  it('join: a signed-in caller joins via the token', async () => {
    db.joinTeamByInviteToken.mockResolvedValue({ teamId: 't1', alreadyMember: false });
    const res = await handleTeams(
      makeCtx('POST', '/api/teams/invite-link/tok-123/join', { clerkEmail: 'me@example.com' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teamId: 't1', alreadyMember: false });
    expect(db.joinTeamByInviteToken).toHaveBeenCalledWith(
      {},
      'tok-123',
      'user-1',
      'me@example.com',
    );
  });

  it('join requires sign-in (guest 401, no db write)', async () => {
    const res = await handleTeams(
      makeCtx('POST', '/api/teams/invite-link/tok-123/join', { clerkUserId: null }),
    );
    expect(res.status).toBe(401);
    expect(db.joinTeamByInviteToken).not.toHaveBeenCalled();
  });

  it('join 404s an invalid / expired token', async () => {
    db.joinTeamByInviteToken.mockResolvedValue(null);
    const res = await handleTeams(makeCtx('POST', '/api/teams/invite-link/bad/join'));
    expect(res.status).toBe(404);
  });

  it('team detail carries inviteLink for an admin, null for a member', async () => {
    db.listTeamMembers.mockResolvedValue([member()]);
    db.getTeamInviteLink.mockResolvedValue({ token: 'tok-1', expiresAt: 999 });

    db.getMembership.mockResolvedValue(member()); // admin
    const adminRes = await handleTeams(makeCtx('GET', '/api/teams/t1'));
    expect(await adminRes.json()).toMatchObject({ inviteLink: { token: 'tok-1' } });

    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    const memberRes = await handleTeams(makeCtx('GET', '/api/teams/t1'));
    expect(await memberRes.json()).toMatchObject({ inviteLink: null });
  });
});

describe('invited rows grant no admin powers', () => {
  it('an invited admin row cannot use admin verbs', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member({ status: 'invited' }));
    const res = await handleTeams(makeCtx('PUT', '/api/teams/t1', { body: { name: 'X' } }));
    expect(res.status).toBe(403);
  });

  it('declining an invited admin row bypasses the last-admin guard', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member({ status: 'invited' }));
    db.getTeamMember.mockResolvedValue(member({ status: 'invited' }));
    const res = await handleTeams(makeCtx('DELETE', '/api/teams/t1/members/m1'));
    expect(res.status).toBe(204);
    expect(db.countTeamAdmins).not.toHaveBeenCalled();
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

describe('POST /api/teams/:id/notify-action (spec/68)', () => {
  const body = { assigneeUserId: 'user-2', diagramId: 'd1', actionName: 'Review the copy' };
  const post = (b: unknown = body, opts: Parameters<typeof makeCtx>[2] = {}) =>
    handleTeams(makeCtx('POST', '/api/teams/t1/notify-action', { body: b, ...opts }));

  // Caller (user-1) and assignee (user-2) both joined members by default.
  const membershipByUser = (overrides: Record<string, TeamMember | null> = {}) => {
    db.getMembership.mockImplementation(async (_env: Env, _teamId: string, userId: string) => {
      if (userId in overrides) return overrides[userId];
      if (userId === 'user-1') return member();
      if (userId === 'user-2') return member({ id: 'm2', userId: 'user-2', role: 'member' });
      return null;
    });
  };

  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
    membershipByUser();
    db.getDiagramMeta.mockResolvedValue({ id: 'd1', ownerId: 'user-1', teamId: null, name: 'Q3' });
    db.getParticipant.mockResolvedValue({ id: 'user-1', name: 'Sam', color: '#f00' });
  });

  it('202 + dispatches the email with server-derived names for the diagram owner', async () => {
    const res = await post();
    expect(res.status).toBe(202);
    expect(notifyActionAssigned).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        assigneeUserId: 'user-2',
        assigneeFallbackEmail: 'me@example.com',
        assignerName: 'Sam',
        diagram: { id: 'd1', name: 'Q3' },
        actionName: 'Review the copy',
      }),
    );
  });

  it('ignores a body-supplied diagram name (name comes from D1)', async () => {
    await post({ ...body, diagramName: 'Spoofed' });
    const input = vi.mocked(notifyActionAssigned).mock.calls[0]![1];
    expect(input.diagram.name).toBe('Q3');
  });

  it('401 for a token caller (mutations need the interactive session)', async () => {
    const res = await post(body, { clerkUserId: null, verifiedUserId: 'user-1' });
    expect(res.status).toBe(401);
    expect(notifyActionAssigned).not.toHaveBeenCalled();
  });

  it('404 when the caller is not a member of the team', async () => {
    membershipByUser({ 'user-1': null });
    const res = await post();
    expect(res.status).toBe(404);
  });

  it('403 when the caller is still only invited', async () => {
    membershipByUser({ 'user-1': member({ status: 'invited' }) });
    const res = await post();
    expect(res.status).toBe(403);
  });

  it('400 on a missing action name', async () => {
    const res = await post({ assigneeUserId: 'user-2', diagramId: 'd1' });
    expect(res.status).toBe(400);
  });

  it('404 when the assignee is not a joined member of this team (no user probing)', async () => {
    membershipByUser({ 'user-2': null });
    expect((await post()).status).toBe(404);
    membershipByUser({ 'user-2': member({ id: 'm2', userId: 'user-2', status: 'invited' }) });
    expect((await post()).status).toBe(404);
    expect(notifyActionAssigned).not.toHaveBeenCalled();
  });

  it('404 when the diagram does not exist', async () => {
    db.getDiagramMeta.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(404);
  });

  it('404 when the caller cannot access the diagram', async () => {
    db.getDiagramMeta.mockResolvedValue({
      id: 'd1',
      ownerId: 'someone-else',
      teamId: null,
      name: 'Q3',
    });
    db.hasSharedAccess.mockResolvedValue(false);
    const res = await post();
    expect(res.status).toBe(404);
    expect(notifyActionAssigned).not.toHaveBeenCalled();
  });

  it('allows a joined member of the diagram’s team-library team', async () => {
    db.getDiagramMeta.mockResolvedValue({
      id: 'd1',
      ownerId: 'someone-else',
      teamId: 't1',
      name: 'Q3',
    });
    const res = await post();
    expect(res.status).toBe(202);
    expect(notifyActionAssigned).toHaveBeenCalled();
  });

  it('allows a caller who reached the diagram through a share link (shared_with)', async () => {
    db.getDiagramMeta.mockResolvedValue({
      id: 'd1',
      ownerId: 'someone-else',
      teamId: null,
      name: 'Q3',
    });
    db.hasSharedAccess.mockResolvedValue(true);
    const res = await post();
    expect(res.status).toBe(202);
    expect(db.hasSharedAccess).toHaveBeenCalledWith({}, 'user-1', 'd1');
  });

  it('falls back to the caller’s email claim when they have no participant profile', async () => {
    db.getParticipant.mockResolvedValue(null);
    await post(body, { clerkEmail: 'sam@x.com' });
    const input = vi.mocked(notifyActionAssigned).mock.calls[0]![1];
    expect(input.assignerName).toBe('sam@x.com');
  });
});
