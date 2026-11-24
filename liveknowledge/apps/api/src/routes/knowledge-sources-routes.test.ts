// Sources (docs/specs/030-knowledgebase/search-and-ask.md "Sources", "Sources in AI Settings"; insights.md "Likely
// answered elsewhere"): an Editor's settings, the room's look at its set and reads of each source, and Ask, search and
// Insights answering from sources only for a reader who can open them, never for a link reader or a guest.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import type {
  KnowledgeSourceListing,
  KnowledgeSourcesClient,
  KnowledgeText,
} from '@liveworkspace/index-client';
import { SOURCE_CHUNKS_MAX, SOURCE_MAX_TRIES, SOURCES_MAX } from '@liveknowledge/knowledge';
import { mayReadSources } from '../knowledge/ask-source-read';
import { dueWork } from '../knowledge/knowledge-work';
import {
  SOURCE_SYNC_KEY,
  oweSourceWork,
  runSourceWork,
  setKnowledgeSourcesClientForTests,
  takeSourceChange,
} from '../knowledge/source-work';
import { fakeClaude, knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

const SECRET = 'test-ai-key-secret';
const KEY = 'sk-ant-test-0123456789abcdefghij-4f2a';

const LISTED: KnowledgeSourceListing[] = [
  { itemId: 'd1', app: 'livediagram', title: 'Checkout Flow', updatedAt: 10, origin: 'connected' },
  { itemId: 'p1', app: 'liveplanner', title: 'Launch Plan', updatedAt: 10, origin: 'connected' },
];
const TEXTS: Record<string, KnowledgeText> = {
  d1: {
    name: 'Checkout Flow',
    version: 3,
    chunks: [
      {
        ref: 't1:0',
        title: 'Payments',
        text: 'Checkout pays through Stripe and retries failed payments three times.',
        place: { tabId: 't1', elementIds: ['e1', 'e2'] },
      },
    ],
  },
  p1: {
    name: 'Launch Plan',
    version: 2,
    chunks: [
      {
        ref: 'card:c1',
        title: '#4 Pick a launch date',
        text: 'Pick a launch date\nStatus: Done\nThe launch is on 3 March.',
        place: { cardId: 'c1' },
      },
    ],
  },
};

type Fake = {
  client: KnowledgeSourcesClient;
  reached: string[] | null;
  calls: { reach: unknown[][]; likely: unknown[][]; text: string[] };
};

function fakeIndex(options: { open?: string[]; failText?: boolean; likely?: string } = {}): Fake {
  const fake: Fake = {
    reached: options.open ?? ['d1', 'p1'],
    calls: { reach: [], likely: [], text: [] },
    client: undefined as unknown as KnowledgeSourcesClient,
  };
  const client: Record<keyof KnowledgeSourcesClient, unknown> = {
    sources: async () => LISTED,
    agentSend: async () => null,
    text: async (_kb: string, itemId: string) => {
      fake.calls.text.push(itemId);
      if (options.failText) throw new Error('index away');
      return TEXTS[itemId] ?? null;
    },
    reach: async (...args: unknown[]) => {
      fake.calls.reach.push(args);
      const ids = args[2] as string[];
      return ids.filter((id) => fake.reached!.includes(id));
    },
    likely: async (...args: unknown[]) => {
      fake.calls.likely.push(args);
      return options.likely
        ? [{ itemId: options.likely, app: 'livediagram' as const, title: 'Approvals Flow' }]
        : [];
    },
  };
  fake.client = client as KnowledgeSourcesClient;
  setKnowledgeSourcesClientForTests(fake.client);
  return fake;
}

afterEach(() => {
  setKnowledgeSourcesClientForTests(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const quiet = () => {
  for (const level of ['info', 'warn'] as const)
    vi.spyOn(console, level).mockImplementation(() => {});
};

// Runs the room's source work due by `now`, as the alarm does, until none is left.
async function drain(kit: Kit, now = Date.now() + 60_000) {
  const sql = nodeItemSql(kit.db.sql);
  for (let turn = 0; turn < 10; turn++) {
    const due = dueWork(sql, now, 50).filter((w) => w.kind === 'source');
    if (due.length === 0) return;
    for (const work of due) {
      sql.exec("DELETE FROM knowledge_work WHERE kind = 'source' AND key = ?", work.key);
      await runSourceWork(kit.db.env, sql, 'kb', work, now);
    }
  }
}

const owe = (kit: Kit, key = SOURCE_SYNC_KEY) => oweSourceWork(nodeItemSql(kit.db.sql), key, 0);

async function readyKit(fake = fakeIndex()) {
  quiet();
  const kit = await knowledgeKit({ AI_KEY_SECRET: SECRET });
  await kit.call('editor', 'PUT', '/api/documents/kb/ai/key', { key: KEY });
  owe(kit);
  await drain(kit);
  return { kit, fake };
}

const itemsOf = (kit: Kit) =>
  kit.db.sql.prepare('SELECT item_id, state, chunks FROM source_items ORDER BY item_id').all();

describe('the Sources settings', () => {
  it('reads for every role, with connected items on and no folder by default', async () => {
    const { kit } = await readyKit();
    for (const who of ['editor', 'participant', 'viewer'] as Who[]) {
      const res = await kit.call(who, 'GET', '/api/documents/kb/ai/sources');
      expect(res.status).toBe(200);
      const body = await res.json<Record<string, unknown>>();
      expect(body).toMatchObject({
        connected: true,
        folderId: null,
        folderName: null,
        teamId: null,
      });
      expect(body.items).toEqual([
        {
          itemId: 'd1',
          app: 'livediagram',
          title: 'Checkout Flow',
          origin: 'connected',
          state: 'read',
          chunks: 1,
          readAt: expect.any(Number),
        },
        {
          itemId: 'p1',
          app: 'liveplanner',
          title: 'Launch Plan',
          origin: 'connected',
          state: 'read',
          chunks: 1,
          readAt: expect.any(Number),
        },
      ]);
    }
  });

  it.each(['participant', 'viewer', 'link', 'page-link', 'agent-read-only'] as const)(
    'cannot be changed by %s',
    async (who) => {
      const { kit } = await readyKit();
      const res = await kit.call(who, 'PUT', '/api/documents/kb/ai/sources', { connected: false });
      expect([403, 404]).toContain(res.status);
      expect(
        await (await kit.call('editor', 'GET', '/api/documents/kb/ai/sources')).json<object>(),
      ).toMatchObject({
        connected: true,
      });
    },
  );

  it("is an Editor's to change, owing the room a look that drops what is no longer read", async () => {
    const { kit } = await readyKit();
    const owed: string[] = [];
    (kit.db.env as unknown as { SOURCES_OWED: (key: string) => void }).SOURCES_OWED = (key) =>
      owed.push(key);
    const res = await kit.call('editor', 'PUT', '/api/documents/kb/ai/sources', {
      connected: false,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ connected: false });
    expect(owed).toEqual([SOURCE_SYNC_KEY]);
    owe(kit);
    await drain(kit);
    expect(itemsOf(kit)).toEqual([]);
  });

  it("reads a team folder on a team's knowledgebase, owing the index a summary, and only the folder's with Connected Items off", async () => {
    const fake = fakeIndex();
    fake.client.sources = async () => [
      ...LISTED,
      { itemId: 'h1', app: 'livehuddle', title: 'Standup', updatedAt: 10, origin: 'folder' },
    ];
    const { kit } = await readyKit(fake);
    kit.db.sql.exec("UPDATE document SET team_id = 'T' WHERE id = 'kb'");
    let summaries = 0;
    (kit.db.env as unknown as { OUTBOX_OWED: () => void }).OUTBOX_OWED = () => void summaries++;
    const res = await kit.call('editor', 'PUT', '/api/documents/kb/ai/sources', {
      connected: false,
      folderId: 'f1',
      folderName: '  Specs  ',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ teamId: 'T', folderId: 'f1', folderName: 'Specs' });
    expect(summaries).toBe(1);
    expect(kit.db.sql.prepare("SELECT kind FROM outbox WHERE kind = 'summary'").all()).toHaveLength(
      1,
    );
    await runSourceWork(
      kit.db.env,
      nodeItemSql(kit.db.sql),
      'kb',
      {
        kind: 'source',
        key: SOURCE_SYNC_KEY,
        dueAt: 0,
        payload: '',
      },
      1,
    );
    expect(itemsOf(kit)).toEqual([{ item_id: 'h1', state: 'waiting', chunks: 0 }]);
    // No folder again: its name goes with it.
    const none = await kit.call('editor', 'PUT', '/api/documents/kb/ai/sources', {
      folderId: null,
    });
    expect(await none.json()).toMatchObject({ folderId: null, folderName: null });
    expect(
      (await kit.call('editor', 'PUT', '/api/documents/kb/ai/sources', { folderId: 'a/b' })).status,
    ).toBe(400);
  });

  it('refuses a folder on a personal knowledgebase and a body that changes nothing', async () => {
    const { kit } = await readyKit();
    const folder = await kit.call('editor', 'PUT', '/api/documents/kb/ai/sources', {
      folderId: 'f1',
    });
    expect(folder.status).toBe(400);
    expect(await folder.json()).toMatchObject({ error: 'not_a_team' });
    expect(
      (await kit.call('editor', 'PUT', '/api/documents/kb/ai/sources', { connected: 'yes' }))
        .status,
    ).toBe(400);
    expect((await kit.call('editor', 'PUT', '/api/documents/kb/ai/sources', {})).status).toBe(400);
  });
});

describe("the room's source work", () => {
  it('reads each source once, again on a change signal, and drops one gone', async () => {
    const { kit, fake } = await readyKit();
    expect(fake.calls.text.sort()).toEqual(['d1', 'p1']);
    const sql = nodeItemSql(kit.db.sql);
    expect(takeSourceChange(sql, { app: 'livediagram', itemId: 'd1' }, 0)).toBeGreaterThan(0);
    await drain(kit);
    expect(fake.calls.text.filter((id) => id === 'd1')).toHaveLength(2);
    // An item the knowledgebase does not read yet: a look at the set.
    takeSourceChange(sql, { app: 'livediagram', itemId: 'new' }, 0);
    expect(dueWork(sql, Date.now() + 60_000, 50).map((w) => w.key)).toEqual([SOURCE_SYNC_KEY]);
    takeSourceChange(sql, { app: 'livediagram', itemId: 'd1', gone: true }, 0);
    expect(itemsOf(kit)).toEqual([{ item_id: 'p1', state: 'read', chunks: 1 }]);
    expect(takeSourceChange(sql, { app: 'livediagram', itemId: 'zz', gone: true }, 0)).toBeNull();
  });

  it('reads a kept source again once it changed, and lists one past the source cap as over the limit', async () => {
    const { kit, fake } = await readyKit();
    const sync = () =>
      runSourceWork(
        kit.db.env,
        nodeItemSql(kit.db.sql),
        'kb',
        { kind: 'source', key: SOURCE_SYNC_KEY, dueAt: 0, payload: '' },
        1,
      );
    const many: KnowledgeSourceListing[] = Array.from({ length: SOURCES_MAX }, (_, i) => ({
      itemId: `x${i}`,
      app: 'livedesign',
      title: `Design ${i}`,
      updatedAt: 1,
      origin: 'connected',
    }));
    fake.client.sources = async () => [
      { ...LISTED[0]!, updatedAt: 99 },
      ...many.slice(1),
      LISTED[1]!,
    ];
    expect(await sync()).toBeGreaterThan(1);
    const owed = dueWork(nodeItemSql(kit.db.sql), 2, 500).map((w) => w.key);
    expect(owed).toContain('d1');
    expect(owed).not.toContain('p1');
    expect(itemsOf(kit)).toContainEqual({ item_id: 'p1', state: 'capped', chunks: 0 });
    // Nothing listed: nothing owed again.
    fake.client.sources = async () => [];
    expect(await sync()).toBeNull();
  });

  it('marks a source failed after its tries, and caps one past the chunk cap', async () => {
    quiet();
    const kit = await knowledgeKit({ AI_KEY_SECRET: SECRET });
    fakeIndex({ failText: true });
    owe(kit);
    const sql = nodeItemSql(kit.db.sql);
    await drain(kit);
    for (let i = 0; i < SOURCE_MAX_TRIES; i++) {
      owe(kit, 'd1');
      await drain(kit);
    }
    expect(itemsOf(kit)).toContainEqual({ item_id: 'd1', state: 'failed', chunks: 0 });
    // A source whose chunks would pass the knowledgebase's cap is listed, not read.
    kit.db.sql
      .prepare(
        "INSERT INTO source_items (item_id, app, title, origin, state, chunks, updated_at) VALUES ('big', 'livedesign', 'Big', 'connected', 'read', ?, 1)",
      )
      .run(SOURCE_CHUNKS_MAX);
    fakeIndex();
    await runSourceWork(
      kit.db.env,
      sql,
      'kb',
      { kind: 'source', key: 'p1', dueAt: 0, payload: '' } as never,
      1,
    );
    expect(itemsOf(kit)).toContainEqual({ item_id: 'p1', state: 'capped', chunks: 0 });
  });
});

const ANSWER = '<answer>Checkout pays through Stripe [1]. The launch is on 3 March [2].</answer>';

type Event = { type: string; sources?: { source?: Record<string, unknown>; tab: string }[] };
async function events(res: Response): Promise<Event[]> {
  return (await res.text())
    .split('\n\n')
    .filter(Boolean)
    .map((block) => JSON.parse(block.slice(block.indexOf('data: ') + 6)) as Event);
}

describe('answering from sources', () => {
  it("answers an Editor from the sources they can open, citing each item's place", async () => {
    const { kit, fake } = await readyKit();
    const claude = fakeClaude(ANSWER);
    vi.stubGlobal('fetch', claude.fetch);
    const res = await kit.call('editor', 'POST', '/api/documents/kb/ask', {
      question: 'How does checkout pay, and when is the launch date?',
    });
    const done = (await events(res)).at(-1)!;
    expect(done.type).toBe('done');
    expect(done.sources).toHaveLength(2);
    expect(done.sources?.map((s) => s.source)).toEqual(
      expect.arrayContaining([
        {
          app: 'livediagram',
          itemId: 'd1',
          itemName: 'Checkout Flow',
          place: { tabId: 't1', elementIds: ['e1', 'e2'] },
          readAt: expect.any(Number),
        },
        {
          app: 'liveplanner',
          itemId: 'p1',
          itemName: 'Launch Plan',
          place: { cardId: 'c1' },
          readAt: expect.any(Number),
        },
      ]),
    );
    expect(claude.sent[0]!.body).toContain('source_app=\\"livediagram\\"');
    // One reach call for the question, as the Editor themselves.
    expect(fake.calls.reach).toHaveLength(1);
    expect(fake.calls.reach[0]![1]).toEqual({ personId: 'user_o', teams: [] });
  });

  it('leaves out an item the reader cannot open themselves', async () => {
    const { kit } = await readyKit(fakeIndex({ open: ['p1'] }));
    const claude = fakeClaude('<answer>The launch is on 3 March [1].</answer>');
    vi.stubGlobal('fetch', claude.fetch);
    await events(
      await kit.call('editor', 'POST', '/api/documents/kb/ask', {
        question: 'How does checkout pay, and when is the launch?',
      }),
    );
    expect(claude.sent[0]!.body).not.toContain('Stripe');
    expect(claude.sent[0]!.body).toContain('3 March');
  });

  it.each(['viewer', 'participant'] as const)(
    'gives a reader through a share link (%s) pages only',
    async (who) => {
      const { kit, fake } = await readyKit();
      const claude = fakeClaude('<answer>No page says.</answer>');
      vi.stubGlobal('fetch', claude.fetch);
      await events(
        await kit.call(who, 'POST', '/api/documents/kb/ask', {
          question: 'How does checkout pay?',
        }),
      );
      expect(claude.sent[0]!.body).not.toContain('Stripe');
      expect(fake.calls.reach).toHaveLength(0);
    },
  );

  it('answers from pages alone when the index is away', async () => {
    const { kit, fake } = await readyKit();
    fake.client.reach = async () => Promise.reject(new Error('down'));
    const claude = fakeClaude('<answer>No page says.</answer>');
    vi.stubGlobal('fetch', claude.fetch);
    const res = await kit.call('editor', 'POST', '/api/documents/kb/ask', {
      question: 'How does checkout pay?',
    });
    expect(res.status).toBe(200);
    expect(claude.sent[0]!.body).not.toContain('Stripe');
  });

  it('lists source hits in search for an account, none for a link reader', async () => {
    const { kit } = await readyKit();
    const found = await (
      await kit.call('editor', 'GET', '/api/documents/kb/search?q=stripe')
    ).json<{ sources?: { itemId: string; place: object }[] }>();
    expect(found.sources?.map((s) => [s.itemId, s.place])).toEqual([
      ['d1', { tabId: 't1', elementIds: ['e1', 'e2'] }],
    ]);
    const link = await (
      await kit.call('link', 'GET', '/api/documents/kb/search?q=stripe')
    ).json<{ sources?: unknown }>();
    expect(link.sources).toBeUndefined();
  });

  it('notes a likely item for an unanswered question, only to a reader who can open it', async () => {
    const { kit, fake } = await readyKit(fakeIndex({ likely: 'd9' }));
    fake.reached = ['d1', 'p1', 'd9'];
    vi.stubGlobal(
      'fetch',
      fakeClaude('<answer>No page says.</answer><gap>Who approves a refund?</gap>').fetch,
    );
    await events(
      await kit.call('editor', 'POST', '/api/documents/kb/ask', {
        question: 'Who approves a refund?',
      }),
    );
    expect(kit.db.sql.prepare('SELECT item_id, title FROM question_likely').all()).toEqual([
      { item_id: 'd9', title: 'Approvals Flow' },
    ]);
    type Overview = { questions: { question: string; likely?: { itemId: string } }[] };
    const overview = await (
      await kit.call('editor', 'GET', '/api/documents/kb/knowledge')
    ).json<Overview>();
    expect(overview.questions.find((q) => q.likely)?.likely).toMatchObject({
      itemId: 'd9',
      app: 'livediagram',
    });
    fake.reached = ['d1'];
    const blind = await (
      await kit.call('editor', 'GET', '/api/documents/kb/knowledge')
    ).json<Overview>();
    expect(blind.questions.some((q) => q.likely)).toBe(false);
  });
});

describe('who may read sources', () => {
  type Caller = Parameters<typeof mayReadSources>[0];
  type Grant = Parameters<typeof mayReadSources>[1];
  const account: Caller = { accountUserId: 'user_a', verifiedUserId: 'user_a', token: null };
  const own: Grant = { shareCode: null, tabScope: null, community: false };
  it('is an account on a grant of its own', () => {
    expect(mayReadSources(account, own)).toBe(true);
    expect(mayReadSources({ accountUserId: null, verifiedUserId: null, token: null }, own)).toBe(
      false,
    );
    expect(mayReadSources(account, { ...own, shareCode: 'X' })).toBe(false);
    expect(mayReadSources(account, { ...own, tabScope: 't' })).toBe(false);
    expect(mayReadSources(account, { ...own, community: true })).toBe(false);
  });
});
