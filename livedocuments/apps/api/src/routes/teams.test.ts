import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '@livedocuments/api-schema';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    getDocumentMeta: vi.fn(),
    getParticipant: vi.fn(),
    hasSharedAccess: vi.fn(),
    deleteTeam: vi.fn(),
    getMembership: vi.fn(),
    getTeam: vi.fn(),
    listDocumentsByTeam: vi.fn(),
    listFoldersByTeam: vi.fn(),
    listTeamMembers: vi.fn(),
    listTeamsByUser: vi.fn(),
    handTeamWorkToHeir: vi.fn(),
  },
}));
vi.mock('../db', () => db);
// Observe the docs/specs/012-collaboration/assigned-actions.md notify dispatch without exercising the email stack.
vi.mock('../email/notifications', () => ({
  notifyActionAssigned: vi.fn().mockResolvedValue(undefined),
  notifyMentioned: vi.fn().mockResolvedValue(undefined),
  NOTIFY_EMAIL_DEDUPE_MS: 24 * 60 * 60 * 1000,
}));

import type { RouteContext } from './context';
import { notifyActionAssigned, notifyMentioned } from '../email/notifications';
import { handleTeams } from './teams';

// Signed-in session context ('user-1'); verifiedUserId may diverge for the
// token-caller shape (docs/specs/015-api/public-api-and-tokens.md). resolveOwner falls back to 'guest-1'.
const makeCtx = (
  method: string,
  path: string,
  opts: {
    accountUserId?: string | null;
    accountEmail?: string | null;
    // A token caller (docs/specs/015-api/public-api-and-tokens.md): verified account id with NO signed-in session.
    verifiedUserId?: string | null;
    body?: unknown;
  } = {},
): RouteContext => {
  const accountUserId = opts.accountUserId === undefined ? 'user-1' : opts.accountUserId;
  const verifiedUserId = opts.verifiedUserId === undefined ? accountUserId : opts.verifiedUserId;
  return makeTestRouteContext(method, path, {
    body: opts.body,
    accountUserId,
    verifiedUserId,
    accountEmail: opts.accountEmail ?? null,
    owner: verifiedUserId ?? 'guest-1',
    // Evaluate the deferred work inline so tests can observe the dispatch
    // (`ctx.waitUntil?.(...)` skips its argument entirely when absent).
    waitUntil: (p: Promise<unknown>) => void p.catch(() => {}),
  });
};

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
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleTeams signed-in only gate (docs/specs/013-workspace/teams.md)', () => {
  it('401 sign_in_required for the guest path, even with an X-Owner-Id-style owner', async () => {
    const res = await handleTeams(
      makeCtx('GET', '/api/teams', { accountUserId: null, verifiedUserId: null }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
  });
});

describe('API-token callers (docs/specs/015-api/public-api-and-tokens.md §3.4)', () => {
  // A token request verifies to the account (verifiedUserId) but
  // carries no interactive session (accountUserId null).
  const asToken = { accountUserId: null, verifiedUserId: 'user-1' };

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
    db.listDocumentsByTeam.mockResolvedValue([{ id: 'd1', name: 'Team doc' }]);
    const res = await handleTeams(makeCtx('GET', '/api/teams/t1/library', asToken));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ folders: [], documents: [{ id: 'd1', name: 'Team doc' }] });
  });
});

// Teams are run on liveworkspace.app (liveworkspace/docs/accounts.md "Teams"): every way this API
// used to manage one now says where to go, and changes nothing.
describe('team administration is on liveworkspace.app', () => {
  it('answers 410 with where to manage teams, for a session and a token alike', async () => {
    for (const who of [
      {},
      { accountUserId: null, verifiedUserId: 'user-1' },
      { accountUserId: null, verifiedUserId: null },
    ]) {
      for (const [method, path] of [
        ['POST', '/api/teams'],
        ['PUT', '/api/teams/t1'],
        ['DELETE', '/api/teams/t1'],
        ['POST', '/api/teams/t1/members'],
        ['PUT', '/api/teams/t1/members/m1'],
        ['DELETE', '/api/teams/t1/members/m1'],
        ['POST', '/api/teams/t1/members/m1/accept'],
        ['POST', '/api/teams/t1/invite-link'],
        ['GET', '/api/teams/invite-link/tok'],
        ['POST', '/api/teams/invite-link/tok/join'],
        ['GET', '/api/teams/invite-decline/tok'],
      ] as const) {
        const res = await handleTeams(makeCtx(method, path, who));
        expect(res.status, `${method} ${path}`).toBe(410);
        expect(await res.json()).toEqual({
          error: 'teams_moved',
          manageAt: 'https://liveworkspace.app/account/teams',
        });
      }
    }
    expect(db.deleteTeam).not.toHaveBeenCalled();
    expect(db.getTeam).not.toHaveBeenCalled();
  });

  it('has no invitations to show: they are answered on liveworkspace.app', async () => {
    const res = await handleTeams(makeCtx('GET', '/api/teams/invites'));
    expect(await res.json()).toEqual({ invites: [] });
  });
});

describe('GET /api/teams', () => {
  it('lists the teams the caller belongs to', async () => {
    db.listTeamsByUser.mockResolvedValue([{ ...team, myRole: 'admin', memberCount: 2 }]);
    const res = await handleTeams(makeCtx('GET', '/api/teams'));
    expect(res.status).toBe(200);
    expect(db.listTeamsByUser).toHaveBeenCalledWith({}, 'user-1');
  });
});

describe('team-scoped access', () => {
  it('404 for a non-member (no existence probing)', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(null);
    const res = await handleTeams(makeCtx('GET', '/api/teams/t1'));
    expect(res.status).toBe(404);
  });

  it('GET returns team + members + myRole for a member, with no invite link', async () => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockResolvedValue(member({ role: 'member' }));
    db.listTeamMembers.mockResolvedValue([member()]);
    const res = await handleTeams(makeCtx('GET', '/api/teams/t1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ myRole: 'member', inviteLink: null });
  });
});

describe('GET /api/teams/:id/access-check (docs/specs/012-collaboration/assigned-actions.md)', () => {
  const get = (qs: string, opts: Parameters<typeof makeCtx>[2] = {}) =>
    handleTeams(makeCtx('GET', `/api/teams/t1/access-check?${qs}`, opts));
  const QS = 'assigneeUserId=user-2&documentId=d1';

  const membershipByUser = (overrides: Record<string, TeamMember | null> = {}) => {
    db.getMembership.mockImplementation(async (_env: Env, teamId: string, userId: string) => {
      const key = `${teamId}:${userId}`;
      if (key in overrides) return overrides[key];
      if (userId === 'user-1') return member();
      if (userId === 'user-2' && teamId === 't1')
        return member({ id: 'm2', userId: 'user-2', role: 'member' });
      return null;
    });
  };

  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
    membershipByUser();
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'user-1', teamId: null, name: 'Q3' });
    db.hasSharedAccess.mockResolvedValue(false);
  });

  it('false for a personal document the assignee has never opened', async () => {
    const res = await get(QS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ canAccess: false });
  });

  it('true when the assignee has opened it through a share link', async () => {
    db.hasSharedAccess.mockImplementation(
      async (_env: Env, ownerId: string) => ownerId === 'user-2',
    );
    expect(await (await get(QS)).json()).toEqual({ canAccess: true });
  });

  it('true when the assignee is a joined member of the document-library team', async () => {
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'x', teamId: 't9', name: 'Q3' });
    membershipByUser({
      't9:user-1': member({ role: 'member' }),
      't9:user-2': member({ id: 'm2', userId: 'user-2', role: 'member' }),
    });
    expect(await (await get(QS)).json()).toEqual({ canAccess: true });
  });

  it('true when the assignee owns the document', async () => {
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'user-2', teamId: null, name: 'Q3' });
    db.hasSharedAccess.mockImplementation(
      async (_env: Env, ownerId: string) => ownerId === 'user-1',
    );
    expect(await (await get(QS)).json()).toEqual({ canAccess: true });
  });

  it('400 on missing params, 404 on a non-member assignee or unreachable document', async () => {
    expect((await get('assigneeUserId=user-2')).status).toBe(400);
    membershipByUser({ 't1:user-2': null });
    expect((await get(QS)).status).toBe(404);
    membershipByUser();
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'x', teamId: null, name: 'Q3' });
    expect((await get(QS)).status).toBe(404);
  });

  it('allows an API-token caller (read surface)', async () => {
    const res = await get(QS, { accountUserId: null, verifiedUserId: 'user-1' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/teams/:id/notify-action (docs/specs/012-collaboration/assigned-actions.md)', () => {
  const body = { assigneeUserId: 'user-2', documentId: 'd1', actionName: 'Review the copy' };
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
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'user-1', teamId: null, name: 'Q3' });
    db.getParticipant.mockResolvedValue({ id: 'user-1', name: 'Sam', color: '#f00' });
  });

  it('202 + dispatches the email with server-derived names for the document owner', async () => {
    const res = await post();
    expect(res.status).toBe(202);
    expect(notifyActionAssigned).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        assigneeUserId: 'user-2',
        assigneeFallbackEmail: 'me@example.com',
        assignerName: 'Sam',
        document: { id: 'd1', name: 'Q3' },
        actionName: 'Review the copy',
      }),
    );
  });

  it('ignores a body-supplied document name (name comes from D1)', async () => {
    await post({ ...body, documentName: 'Spoofed' });
    const input = vi.mocked(notifyActionAssigned).mock.calls[0]![1];
    expect(input.document.name).toBe('Q3');
  });

  it('401 for a token caller (mutations need the interactive session)', async () => {
    const res = await post(body, { accountUserId: null, verifiedUserId: 'user-1' });
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
    const res = await post({ assigneeUserId: 'user-2', documentId: 'd1' });
    expect(res.status).toBe(400);
  });

  it('404 when the assignee is not a member of this team (no user probing)', async () => {
    membershipByUser({ 'user-2': null });
    expect((await post()).status).toBe(404);
    expect(notifyActionAssigned).not.toHaveBeenCalled();
  });

  it('202 for an INVITED assignee — by userId when claimed, by memberId otherwise (docs/specs/012-collaboration/assigned-actions.md)', async () => {
    // Claimed invitee: has a userId despite the pending status.
    membershipByUser({
      'user-2': member({ id: 'm2', userId: 'user-2', status: 'invited', email: 'b@x.com' }),
    });
    expect((await post()).status).toBe(202);
    expect(notifyActionAssigned).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ assigneeUserId: 'user-2', assigneeFallbackEmail: 'b@x.com' }),
    );
    vi.mocked(notifyActionAssigned).mockClear();
    // Unclaimed invitee: no account yet, keyed by the membership row id.
    db.listTeamMembers.mockResolvedValue([
      member({ id: 'm3', userId: null, status: 'invited', email: 'c@x.com' }),
    ]);
    const res = await post({
      assigneeMemberId: 'm3',
      documentId: 'd1',
      actionName: 'Review the copy',
    });
    expect(res.status).toBe(202);
    expect(notifyActionAssigned).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ assigneeUserId: null, assigneeFallbackEmail: 'c@x.com' }),
    );
  });

  it('404 when the document does not exist', async () => {
    db.getDocumentMeta.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(404);
  });

  it('404 when the caller cannot access the document', async () => {
    db.getDocumentMeta.mockResolvedValue({
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

  it('allows a joined member of the document’s team-library team', async () => {
    db.getDocumentMeta.mockResolvedValue({
      id: 'd1',
      ownerId: 'someone-else',
      teamId: 't1',
      name: 'Q3',
    });
    const res = await post();
    expect(res.status).toBe(202);
    expect(notifyActionAssigned).toHaveBeenCalled();
  });

  it('allows a caller who reached the document through a share link (shared_with)', async () => {
    db.getDocumentMeta.mockResolvedValue({
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
    await post(body, { accountEmail: 'sam@x.com' });
    const input = vi.mocked(notifyActionAssigned).mock.calls[0]![1];
    expect(input.assignerName).toBe('sam@x.com');
  });

  it('passes the verified caller as the assigner the email is claimed against', async () => {
    await post();
    expect(vi.mocked(notifyActionAssigned).mock.calls[0]![1].assignerUserId).toBe('user-1');
  });

  // docs/specs/012-collaboration/assigned-actions.md §4: the email names the document only to an
  // assignee who can open it.
  it('marks a document the assignee cannot open, so the email leaves its name out', async () => {
    // The caller's own personal document; the assignee never opened it.
    db.hasSharedAccess.mockResolvedValue(false);
    await post();
    const input = vi.mocked(notifyActionAssigned).mock.calls[0]![1];
    expect(input.assigneeCanOpen).toBe(false);
    expect(db.hasSharedAccess).toHaveBeenCalledWith({}, 'user-2', 'd1');
  });

  it('lets the email name the document for an assignee who reached it through a share link', async () => {
    db.hasSharedAccess.mockImplementation(async (_env: Env, who: string) => who === 'user-2');
    await post();
    expect(vi.mocked(notifyActionAssigned).mock.calls[0]![1].assigneeCanOpen).toBe(true);
  });

  it('counts the document in this team’s library as open to an invited assignee too', async () => {
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'user-1', teamId: 't1', name: 'Q3' });
    db.listTeamMembers.mockResolvedValue([
      member({ id: 'm3', userId: null, status: 'invited', email: 'c@x.com' }),
    ]);
    await post({ assigneeMemberId: 'm3', documentId: 'd1', actionName: 'Review the copy' });
    expect(vi.mocked(notifyActionAssigned).mock.calls[0]![1].assigneeCanOpen).toBe(true);
  });

  it('names no document to an invited assignee outside its library', async () => {
    db.listTeamMembers.mockResolvedValue([
      member({ id: 'm3', userId: null, status: 'invited', email: 'c@x.com' }),
    ]);
    await post({ assigneeMemberId: 'm3', documentId: 'd1', actionName: 'Review the copy' });
    expect(vi.mocked(notifyActionAssigned).mock.calls[0]![1].assigneeCanOpen).toBe(false);
  });
});

describe('POST /api/teams/:id/notify-mention (docs/specs/012-collaboration/comment-mentions.md)', () => {
  const body = {
    documentId: 'd1',
    commentText: 'Can you look, @priya?',
    mentions: [{ userId: 'user-2', memberId: 'm2' }],
  };
  const post = (b: unknown = body, opts: Parameters<typeof makeCtx>[2] = {}) =>
    handleTeams(makeCtx('POST', '/api/teams/t1/notify-mention', { body: b, ...opts }));
  const members = [
    member(),
    member({ id: 'm2', userId: 'user-2', role: 'member', email: 'priya@x.com' }),
    member({ id: 'm3', userId: null, role: 'member', status: 'invited', email: 'inv@x.com' }),
  ];

  beforeEach(() => {
    db.getTeam.mockResolvedValue(team);
    db.getMembership.mockImplementation(async (_env: Env, _t: string, userId: string) =>
      userId === 'user-1' ? member() : null,
    );
    db.listTeamMembers.mockResolvedValue(members);
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'user-1', teamId: 't1', name: 'Q3' });
    db.getParticipant.mockResolvedValue({ id: 'user-1', name: 'Sam', color: '#f00' });
  });

  it('passes the verified author as the sender the email is claimed against', async () => {
    await post();
    expect(vi.mocked(notifyMentioned).mock.calls[0]![1].authorUserId).toBe('user-1');
  });

  it('202 + emails each mentioned member with server-derived names', async () => {
    const res = await post();
    expect(res.status).toBe(202);
    expect(notifyMentioned).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        recipientUserId: 'user-2',
        recipientFallbackEmail: 'priya@x.com',
        authorName: 'Sam',
        document: { id: 'd1', name: 'Q3' },
        commentText: 'Can you look, @priya?',
      }),
    );
  });

  it('reaches an invited member by their membership row', async () => {
    await post({ ...body, mentions: [{ memberId: 'm3' }] });
    expect(vi.mocked(notifyMentioned).mock.calls[0]![1].recipientFallbackEmail).toBe('inv@x.com');
  });

  it('skips the caller, strangers and duplicates silently', async () => {
    const res = await post({
      ...body,
      mentions: [
        { userId: 'user-1' },
        { userId: 'nobody' },
        { memberId: 'm2' },
        { userId: 'user-2' },
      ],
    });
    expect(res.status).toBe(202);
    expect(notifyMentioned).toHaveBeenCalledOnce();
  });

  it('404 when the document is not in this team’s library', async () => {
    db.getDocumentMeta.mockResolvedValue({ id: 'd1', ownerId: 'user-1', teamId: null, name: 'Q3' });
    const res = await post();
    expect(res.status).toBe(404);
    expect(notifyMentioned).not.toHaveBeenCalled();
  });

  it('403 when the caller is still only invited', async () => {
    db.getMembership.mockResolvedValue(member({ status: 'invited' }));
    expect((await post()).status).toBe(403);
  });

  it('401 for a token caller (mutations need the interactive session)', async () => {
    const res = await post(body, { accountUserId: null, verifiedUserId: 'user-1' });
    expect(res.status).toBe(401);
  });

  it('400 on a missing or oversized body', async () => {
    expect((await post({ documentId: 'd1', mentions: [] })).status).toBe(400);
    expect((await post({ ...body, commentText: 'x'.repeat(5001) })).status).toBe(400);
    expect(
      (await post({ ...body, mentions: Array.from({ length: 21 }, () => ({ userId: 'user-2' })) }))
        .status,
    ).toBe(400);
  });
});
