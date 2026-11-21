import { afterEach, describe, expect, it, vi } from 'vitest';
import { knowledgeKit, OWNER, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/approval.md: who may ask, withdraw, approve and reject, what each writes, and the
// email a rejection sends.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
const rejected = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../knowledge/approval-email', () => ({ sendPageRejected: rejected }));

afterEach(() => {
  vi.clearAllMocks();
});

const PARTICIPANT = 'user_p';
type Knowledge = {
  owner?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  state: string;
  approval?: {
    state: string;
    requestedBy: string;
    requestedAt: number;
    requestedByAgent?: string;
    decidedBy?: string;
    decidedAt?: number;
    note?: string;
  };
};

const act = (kit: Kit, who: Who, action: string, extra: object = {}, tab = 'deploys') =>
  kit.call(who, 'POST', `/api/documents/kb/pages/${tab}/approval`, { action, ...extra });
const knowledgeOf = async (res: Response) => (await res.json<{ knowledge: Knowledge }>()).knowledge;
const stored = (kit: Kit, tab = 'deploys') =>
  (
    JSON.parse(
      (kit.db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tab) as { data: string }).data,
    ) as { knowledge?: Knowledge }
  ).knowledge;
const row = (kit: Kit, tab = 'deploys') =>
  kit.db.sql
    .prepare('SELECT state, requested_by, decided_by FROM page_approvals WHERE tab = ?')
    .get(tab);

describe('POST pages/:tab/approval', () => {
  it('asks, then someone else approves, which verifies the page; the row follows the field', async () => {
    const kit = await knowledgeKit();
    const asked = await act(kit, 'participant', 'request');
    expect(asked.status).toBe(200);
    expect((await knowledgeOf(asked)).approval).toMatchObject({
      state: 'pending',
      requestedBy: PARTICIPANT,
    });
    expect(row(kit)).toEqual({ state: 'pending', requested_by: PARTICIPANT, decided_by: null });
    // Every role reads the state, from the page's health.
    for (const who of ['viewer', 'link'] as const) {
      const health = await kit.call(who, 'GET', '/api/documents/kb/pages/deploys/health');
      expect((await knowledgeOf(health)).approval?.state).toBe('pending');
    }
    const approved = await act(kit, 'editor', 'approve');
    expect(approved.status).toBe(200);
    const knowledge = await knowledgeOf(approved);
    expect(knowledge).toMatchObject({
      state: 'verified',
      verifiedBy: OWNER,
      approval: { state: 'approved', requestedBy: PARTICIPANT, decidedBy: OWNER },
    });
    // The page had no owner (made by an import), so the approver owns it, as Verify does.
    expect(stored(kit)?.owner).toBe(OWNER);
    expect(row(kit)).toEqual({ state: 'approved', requested_by: PARTICIPANT, decided_by: OWNER });
  });

  it('rejects with a note, leaves verification alone, and emails the owner', async () => {
    const kit = await knowledgeKit();
    await act(kit, 'editor', 'request');
    const res = await act(kit, 'participant', 'reject', { note: '  The dates are wrong. ' });
    expect(res.status).toBe(200);
    const knowledge = await knowledgeOf(res);
    expect(knowledge.approval).toMatchObject({
      state: 'rejected',
      decidedBy: PARTICIPANT,
      note: 'The dates are wrong.',
    });
    expect(knowledge.state).toBe('never-verified');
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected.mock.calls[0]).toEqual([
      expect.anything(),
      expect.objectContaining({ id: 'kb' }),
      { tab: 'deploys', title: 'Deploys', owner: undefined },
      PARTICIPANT,
      'The dates are wrong.',
    ]);
    // Rejected may be asked about again.
    expect((await act(kit, 'editor', 'request')).status).toBe(200);
    expect(stored(kit)?.approval?.state).toBe('pending');
  });

  it('never lets someone decide their own request, nor decide a page not pending', async () => {
    const kit = await knowledgeKit();
    expect((await act(kit, 'editor', 'approve')).status).toBe(409);
    await act(kit, 'editor', 'request');
    const own = await act(kit, 'editor', 'approve');
    expect(own.status).toBe(403);
    expect((await own.json<{ error: string }>()).error).toBe('own_request');
    expect((await act(kit, 'participant', 'request')).status).toBe(409);
    expect(stored(kit)?.approval?.state).toBe('pending');
  });

  it('lets the asker or an Editor withdraw, and nobody else', async () => {
    const kit = await knowledgeKit();
    await act(kit, 'editor', 'request');
    expect((await act(kit, 'participant', 'withdraw')).status).toBe(403);
    expect((await act(kit, 'editor', 'withdraw')).status).toBe(200);
    expect(stored(kit)?.approval).toBeUndefined();
    expect(row(kit)).toBeUndefined();
    await act(kit, 'participant', 'request');
    expect((await act(kit, 'editor', 'withdraw')).status).toBe(200);
  });

  it.each(['viewer', 'link', 'page-link', 'edit-link', 'stranger', 'viewer-agent'] as const)(
    'refuses %s every action, and changes nothing',
    async (who) => {
      const kit = await knowledgeKit();
      for (const action of ['request', 'withdraw', 'approve', 'reject']) {
        const res = await act(kit, who, action, {}, 'holidays');
        expect([403, 404]).toContain(res.status);
      }
      expect(stored(kit, 'holidays')).toBeUndefined();
    },
  );

  it('lets an agent ask for its person, never decide', async () => {
    const kit = await knowledgeKit();
    const asked = await act(kit, 'agent-stored', 'request');
    expect(asked.status).toBe(200);
    expect((await knowledgeOf(asked)).approval).toMatchObject({
      state: 'pending',
      requestedBy: OWNER,
      requestedByAgent: 'Coding Agent',
    });
    // Its person may not decide their own agent's request either; someone else does.
    expect((await act(kit, 'editor', 'approve')).status).toBe(403);
    await act(kit, 'participant', 'reject');
    await act(kit, 'participant', 'request');
    const decided = await act(kit, 'agent', 'approve');
    expect(decided.status).toBe(403);
    expect((await decided.json<{ error: string }>()).error).toBe('approval_needs_a_person');
    expect((await act(kit, 'agent-read-only', 'request', {}, 'holidays')).status).toBe(403);
  });

  it('takes only the actions it knows, and a note only on a rejection, 500 characters at most', async () => {
    const kit = await knowledgeKit();
    expect((await act(kit, 'editor', 'maybe')).status).toBe(400);
    expect((await act(kit, 'editor', 'request', { note: 'x' })).status).toBe(400);
    await act(kit, 'editor', 'request');
    const long = await act(kit, 'participant', 'reject', { note: 'n'.repeat(501) });
    expect(long.status).toBe(400);
    expect(
      (await kit.call('editor', 'GET', '/api/documents/kb/pages/deploys/approval')).status,
    ).toBe(405);
  });

  it("lists the pages others asked about in Home's summary, for those who may decide", async () => {
    const kit = await knowledgeKit();
    await act(kit, 'participant', 'request');
    await act(kit, 'participant', 'request', {}, 'holidays');
    await act(kit, 'editor', 'request', {}, 'rollbacks');
    type Summary = { awaitingApproval: { tab: string; title: string; requestedBy: string }[] };
    const summary = async (who: Who) =>
      (await (await kit.call(who, 'GET', '/api/documents/kb/summary')).json<Summary>())
        .awaitingApproval;
    expect((await summary('editor')).map((p) => p.tab)).toEqual(['deploys', 'holidays']);
    expect((await summary('participant')).map((p) => p.title)).toEqual(['Rollbacks']);
    expect(await summary('viewer')).toEqual([]);
  });
});
