import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DIAGRAM_BUILT_IN_PER_PERSON_PER_DAY,
  DIAGRAM_DRAFT_PER_KNOWLEDGEBASE_PER_DAY,
  DIAGRAM_DRAFT_PER_PERSON_PER_HOUR,
} from '@liveknowledge/knowledge';
import { fakeClaude, knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/013-workspace/send-to-diagram.md "The draft".
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

const withSecret = { AI_KEY_SECRET: 'test-ai-key-secret' };
const KEY = 'sk-ant-test-0123456789abcdefghij-4f2a';
const WORDS =
  'A new starter signs the offer, IT readies the laptop, then the buddy meets them on day one.';
const REPLY = JSON.stringify({
  title: 'Onboarding',
  style: 'flow',
  direction: 'down',
  nodes: [
    { id: 'a', label: 'Offer signed', shape: 'circle', note: null, role: null, group: null },
    { id: 'b', label: 'Laptop ready', shape: null, note: null, role: null, group: 'it' },
    { id: 'c', label: 'Day one', shape: null, note: 'Buddy meets them', role: null, group: null },
  ],
  edges: [
    { from: 'a', to: 'b', label: null, line: 'solid' },
    { from: 'b', to: 'c', label: null, line: 'solid' },
  ],
  groups: [{ id: 'it', label: 'IT' }],
});
const GRAPH = {
  title: 'Onboarding',
  style: 'flow',
  direction: 'down',
  nodes: [
    { id: 'a', label: 'Offer signed', shape: 'circle' },
    { id: 'b', label: 'Laptop ready', group: 'it' },
    { id: 'c', label: 'Day one', note: 'Buddy meets them' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ],
  groups: [{ id: 'it', label: 'IT' }],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const quiet = () => {
  for (const level of ['info', 'warn'] as const)
    vi.spyOn(console, level).mockImplementation(() => {});
};
const setKey = (kit: Kit) => kit.call('editor', 'PUT', '/api/documents/kb/ai/key', { key: KEY });
const draft = (kit: Kit, who: Who, body: unknown = { words: WORDS }, tab = 'holidays') =>
  kit.call(who, 'POST', `/api/documents/kb/pages/${tab}/describe-diagram`, body);
const failure = async (res: Response) => {
  const body = await res.json<{ error: string }>();
  return [res.status, body.error] as const;
};
const counters = (kit: Kit) =>
  kit.db.sql
    .prepare("SELECT scope, used FROM usage_counters WHERE scope LIKE 'diagram:%' ORDER BY scope")
    .all();

function fakeAi(...replies: unknown[]) {
  const sent: { model: string; input: { messages: { role: string; content: string }[] } }[] = [];
  return {
    sent,
    run: async (model: string, input: object) => {
      sent.push({ model, input: input as (typeof sent)[number]['input'] });
      const reply = replies[Math.min(sent.length - 1, replies.length - 1)];
      return typeof reply === 'function' ? (reply as () => Promise<unknown>)() : reply;
    },
  };
}
const today = () => new Date().toISOString().slice(0, 10);
const accountCount = (kit: Kit) => {
  const ns = kit.db.env.DOCUMENT_ROOM;
  return ns.get(ns.idFromName('~send-to-diagram:user_o')) as unknown as {
    spendSetupDraft(day: string, cap: number): Promise<boolean>;
  };
};

describe('POST pages/<tab>/describe-diagram on the key', () => {
  it('answers a graph read strictly, the words fenced, and writes nothing', async () => {
    quiet();
    const claude = fakeClaude(REPLY);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    const res = await draft(kit, 'editor', { words: WORDS, kind: 'auto' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ graph: GRAPH, provider: 'anthropic' });
    expect(claude.sent).toHaveLength(1);
    expect(claude.sent[0]!.body).toContain('IT readies the laptop');
    expect(counters(kit)).toEqual([
      { scope: 'diagram:knowledgebase', used: 1 },
      { scope: 'diagram:person:user_o', used: 1 },
    ]);
  });

  it("sets a chosen kind's layout over the model's", async () => {
    quiet();
    vi.stubGlobal('fetch', fakeClaude(REPLY).fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    const res = await draft(kit, 'editor', { words: WORDS, kind: 'mindmap' });
    expect((await res.json<{ graph: { style: string } }>()).graph.style).toBe('mindmap');
  });

  it('lets any signed-in reader draw, never an agent or someone without an account', async () => {
    quiet();
    const claude = fakeClaude(REPLY);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    for (const who of ['participant', 'viewer'] as const)
      expect((await draft(kit, who)).status).toBe(200);
    for (const who of ['agent', 'agent-stored'] as const)
      expect(await failure(await draft(kit, who))).toEqual([403, 'needs_a_person']);
    expect((await draft(kit, 'stranger')).status).toBe(403);
    expect(await failure(await draft(kit, 'edit-link'))).toEqual([403, 'sign_in_required']);
  });

  it('refuses no words, too many words and the limits before any call', async () => {
    const claude = fakeClaude(REPLY);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    expect(await failure(await draft(kit, 'editor', { words: '  ' }))).toEqual([400, 'no-words']);
    expect(await failure(await draft(kit, 'editor', {}))).toEqual([400, 'no-words']);
    expect(await failure(await draft(kit, 'editor', { words: 'x'.repeat(8001) }))).toEqual([
      400,
      'words-too-long',
    ]);
    const set = (scope: string, used: number) =>
      kit.db.sql
        .prepare(
          'INSERT INTO usage_counters (scope, period, used) VALUES (?, ?, ?) ON CONFLICT (scope, period) DO UPDATE SET used = excluded.used',
        )
        .run(
          scope,
          scope.includes('person')
            ? new Date().toISOString().slice(0, 13)
            : new Date().toISOString().slice(0, 10),
          used,
        );
    set('diagram:person:user_o', DIAGRAM_DRAFT_PER_PERSON_PER_HOUR);
    expect(await failure(await draft(kit, 'editor'))).toEqual([429, 'person-limit']);
    set('diagram:person:user_o', 0);
    set('diagram:knowledgebase', DIAGRAM_DRAFT_PER_KNOWLEDGEBASE_PER_DAY);
    expect(await failure(await draft(kit, 'editor'))).toEqual([429, 'knowledgebase-limit']);
    expect(claude.sent).toEqual([]);
  });

  it('answers no diagram for a reply with no box, and a failed call by its kind', async () => {
    quiet();
    vi.stubGlobal('fetch', fakeClaude('{"nodes":[]}').fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    expect(await failure(await draft(kit, 'editor'))).toEqual([502, 'no-diagram']);
    vi.stubGlobal(
      'fetch',
      fakeClaude(
        () => new Response('{"type":"error","error":{"type":"overloaded_error"}}', { status: 529 }),
      ).fetch,
    );
    expect(await failure(await draft(kit, 'editor'))).toEqual([502, 'overloaded']);
  });

  it('refuses a key that is kept but does not open, never swapping in built-in AI', async () => {
    const ai = fakeAi({ response: JSON.parse(REPLY) });
    const kit = await knowledgeKit({ ...withSecret, AI: ai });
    await setKey(kit);
    kit.db.sql
      .prepare("UPDATE knowledge_settings SET value = 'broken' WHERE name = ?")
      .run('ai_key');
    expect(await failure(await draft(kit, 'editor'))).toEqual([409, 'ask_unavailable']);
    expect(ai.sent).toEqual([]);
  });
});

describe('POST pages/<tab>/describe-diagram on built-in AI', () => {
  it('answers with no key, in JSON mode, counted for the account', async () => {
    quiet();
    const ai = fakeAi({ response: JSON.parse(REPLY) });
    const kit = await knowledgeKit({ AI: ai });
    const res = await draft(kit, 'editor', { words: WORDS, kind: 'flowchart' });
    expect(await res.json()).toEqual({ graph: GRAPH, provider: 'built-in' });
    expect(
      (ai.sent[0]!.input as unknown as { response_format: { json_schema: { name: string } } })
        .response_format.json_schema.name,
    ).toBe('diagram');
    expect(
      await accountCount(kit).spendSetupDraft(today(), DIAGRAM_BUILT_IN_PER_PERSON_PER_DAY),
    ).toBe(true);
  });

  it("uses built-in AI when asked, over the team's key", async () => {
    quiet();
    const claude = fakeClaude(REPLY);
    vi.stubGlobal('fetch', claude.fetch);
    const ai = fakeAi({ response: JSON.parse(REPLY) });
    const kit = await knowledgeKit({ ...withSecret, AI: ai });
    await setKey(kit);
    const res = await draft(kit, 'editor', { words: WORDS, ai: 'built-in' });
    expect((await res.json<{ provider: string }>()).provider).toBe('built-in');
    expect(claude.sent).toEqual([]);
  });

  it('asks once more with why, gives up after two, and says when the binding fails or is missing', async () => {
    quiet();
    const ai = fakeAi({ response: 'Sure!' }, { response: JSON.parse(REPLY) });
    const kit = await knowledgeKit({ AI: ai });
    expect((await draft(kit, 'editor')).status).toBe(200);
    expect(ai.sent[1]!.input.messages[1]!.content).toContain('not one JSON object');
    const none = fakeAi({ response: '{"nodes":[]}' });
    expect(await failure(await draft(await knowledgeKit({ AI: none }), 'editor'))).toEqual([
      502,
      'no-diagram',
    ]);
    expect(none.sent[1]!.input.messages[1]!.content).toContain('no box');
    const broken = fakeAi(() => Promise.reject(new Error('boom')));
    expect(await failure(await draft(await knowledgeKit({ AI: broken }), 'editor'))).toEqual([
      502,
      'built-in-failed',
    ]);
    expect(await failure(await draft(await knowledgeKit({}), 'editor'))).toEqual([
      503,
      'built-in-unavailable',
    ]);
  });

  it("refuses at the person's daily cap, and when the count cannot be reached", async () => {
    quiet();
    const ai = fakeAi({ response: JSON.parse(REPLY) });
    const kit = await knowledgeKit({ AI: ai });
    const count = accountCount(kit);
    for (let i = 0; i < DIAGRAM_BUILT_IN_PER_PERSON_PER_DAY; i += 1)
      await count.spendSetupDraft(today(), DIAGRAM_BUILT_IN_PER_PERSON_PER_DAY);
    expect(await failure(await draft(kit, 'editor'))).toEqual([429, 'built-in-limit']);
    const kit2 = await knowledgeKit({ AI: ai });
    const ns = kit2.db.env.DOCUMENT_ROOM;
    const real = ns.get.bind(ns);
    vi.spyOn(ns, 'get').mockImplementation((id) =>
      String(id).startsWith('~')
        ? ({
            spendSetupDraft: async () => {
              throw new Error('gone');
            },
          } as never)
        : real(id),
    );
    expect(await failure(await draft(kit2, 'editor'))).toEqual([502, 'built-in-failed']);
    expect(ai.sent).toEqual([]);
  });
});
