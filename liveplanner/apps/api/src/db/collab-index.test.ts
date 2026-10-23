import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { readActivity, recordOwnerAlias } from './collab-index';

// The collaboration index's read (docs/specs/013-workspace/inbox.md §3, §4): its row -> DTO mapping and
// the dedupe/drop rules. A fake D1 binding records SQL + binds. The rows are written by each plan's push
// (plan-room/plan-outbox.test.ts).

type Bound = { sql: string; args: unknown[] };

function fakeEnv(results: unknown[][] = []) {
  const batches: Bound[][] = [];
  let call = 0;
  const env = {
    DB: {
      prepare: (sql: string) => ({
        // `all` answers the cards read's alias lookup (no aliases), the one read outside the batch.
        bind: (...args: unknown[]) =>
          ({ sql, args, all: async () => ({ results: [] }) }) as unknown as D1PreparedStatement,
      }),
      batch: vi.fn(async (stmts: Bound[]) => {
        batches.push(stmts);
        const out = stmts.map(() => ({ results: results[call++] ?? [] }));
        return out;
      }),
    },
  } as unknown as Env;
  return { env, batches };
}


describe('readActivity', () => {
  const place = {
    tab_id: 't1',
    element_id: 'e1',
    element_label: 'Checkout',
    project_id: 'd1',
    project_name: 'Payments',
    project_team_id: null,
    tab_name: 'Flow',
  };
  const actionRow = (over: Record<string, unknown>) => ({
    ...place,
    action_id: 'a1',
    name: 'Confirm',
    description: '',
    assignee_user_id: 'me',
    assignee_name: 'You',
    assigner_id: 'u9',
    assigner_name: 'Sam',
    created_at: 1,
    updated_at: 2,
    assigned_to_me: 1,
    created_by_me: 0,
    via: 'own',
    share_code: null,
    ...over,
  });

  it('binds the owner, the clock and the cap to every read in one batch', async () => {
    const { env, batches } = fakeEnv();
    await readActivity(env, 'me', { limit: 7 });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(5);
    for (const s of batches[0]!) {
      expect(s.args[0]).toBe('me');
      expect(typeof s.args[1]).toBe('number');
      expect(s.args[2]).toBe(7);
    }
    expect(batches[0]![0]!.sql).toMatch(/FROM collab_actions/);
    expect(batches[0]![1]!.sql).toMatch(/JOIN collab_threads ct/);
    // Cards also bind the reader's hashed person ids (docs/specs/013-workspace/inbox.md §2.4).
    expect(batches[0]![2]!.sql).toMatch(/FROM plan_cards i/);
    expect(JSON.parse(batches[0]![2]!.args[3] as string)).toEqual([
      expect.stringMatching(/^[0-9a-f]{24}$/),
    ]);
    // A card's comment threads read the item store too (§2.5), with no ids of their own to bind.
    expect(batches[0]![3]!.sql).toMatch(/\$\.comments\.resolved/);
    expect(batches[0]![3]!.args).toHaveLength(3);
    // Forms with unseen responses (docs/specs/030-forms/forms.md "Hearing about responses").
    expect(batches[0]![4]!.sql).toMatch(/CROSS JOIN form_links l/);
    expect(batches[0]![4]!.args).toHaveLength(3);
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md: a visitor shown one tab gets a code of exactly that
  // scope, and sees actions and threads on that tab only.
  it('confines a tab-scoped visitor to their tab, with a code of that scope', async () => {
    const { env, batches } = fakeEnv();
    await readActivity(env, 'me', { limit: 7 });
    for (const s of batches[0]!.slice(0, 2)) {
      expect(s.sql).toContain('sl.tab_id IS s.tab_id');
      expect(s.sql).toMatch(/v\.scope_tab_id IS NULL OR v\.scope_tab_id = c[at]\.tab_id/);
    }
  });

  it('maps rows to the wire shape with the flags as booleans', async () => {
    const { env } = fakeEnv([[actionRow({})], []]);
    const { actions } = await readActivity(env, 'me', { limit: 10 });
    expect(actions).toEqual([
      {
        projectId: 'd1',
        projectName: 'Payments',
        teamId: null,
        via: 'own',
        shareCode: null,
        tabId: 't1',
        tabName: 'Flow',
        elementId: 'e1',
        elementLabel: 'Checkout',
        id: 'a1',
        name: 'Confirm',
        description: '',
        assignee: { userId: 'me', name: 'You' },
        assigner: { id: 'u9', name: 'Sam' },
        createdAt: 1,
        updatedAt: 2,
        assignedToMe: true,
        createdByMe: false,
      },
    ]);
  });

  it('keeps one row per element, preferring own > team > shared', async () => {
    const { env } = fakeEnv([
      [
        actionRow({ via: 'shared', share_code: 'abc', project_id: 'd-shared' }),
        actionRow({ via: 'own', project_id: 'd-own' }),
        actionRow({ via: 'team', project_id: 'd-team', project_team_id: 'tm' }),
      ],
      [],
    ]);
    const { actions } = await readActivity(env, 'me', { limit: 10 });
    expect(actions.map((a) => a.projectId)).toEqual(['d-own']);
  });

  it('drops a shared row whose link has lapsed (nowhere to open it)', async () => {
    const { env } = fakeEnv([[actionRow({ via: 'shared', share_code: null })], []]);
    const { actions } = await readActivity(env, 'me', { limit: 10 });
    expect(actions).toEqual([]);
  });

  it('carries the share code only for a shared row', async () => {
    const { env } = fakeEnv([[actionRow({ via: 'shared', share_code: 'abc' })], []]);
    const { actions } = await readActivity(env, 'me', { limit: 10 });
    expect(actions[0]!.shareCode).toBe('abc');
  });

  it('maps threads', async () => {
    const { env } = fakeEnv([
      [],
      [
        {
          ...place,
          via: 'team',
          share_code: null,
          project_team_id: 'tm',
          comment_count: 3,
          latest_text: 'ok',
          latest_author_name: 'Priya',
          latest_author_color: '#p',
          first_at: 1,
          latest_at: 9,
          you_commented: 1,
          on_your_project: 0,
          mentions_you: 0,
        },
      ],
    ]);
    const { threads } = await readActivity(env, 'me', { limit: 10 });
    expect(threads).toEqual([
      {
        projectId: 'd1',
        projectName: 'Payments',
        teamId: 'tm',
        via: 'team',
        shareCode: null,
        tabId: 't1',
        tabName: 'Flow',
        elementId: 'e1',
        elementLabel: 'Checkout',
        commentCount: 3,
        latest: { text: 'ok', authorName: 'Priya', authorColor: '#p', at: 9 },
        firstAt: 1,
        youCommented: true,
        onYourProject: false,
        mentionsYou: false,
      },
    ]);
  });
});

describe('recordOwnerAlias', () => {
  it('carries the old id’s aliases onto the new id, then records the old id', async () => {
    const { env, batches } = fakeEnv();
    await recordOwnerAlias(env, 'user_1', 'guest-1');
    const sqls = batches[0]!.map((s) => s.sql.replace(/\s+/g, ' '));
    expect(sqls[0]).toMatch(/INSERT OR IGNORE INTO owner_aliases .*SELECT \?1, alias_id/);
    expect(sqls[1]).toBe('DELETE FROM owner_aliases WHERE owner_id = ?');
    expect(sqls[2]).toMatch(/INSERT OR IGNORE INTO owner_aliases .*VALUES/);
    expect(batches[0]![2]!.args.slice(0, 2)).toEqual(['user_1', 'guest-1']);
    expect(sqls).toHaveLength(3);
  });
});
