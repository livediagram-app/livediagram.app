import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY,
  STRUCTURE_PER_KNOWLEDGEBASE_PER_DAY,
  STRUCTURE_PER_PERSON_PER_HOUR,
} from '@liveknowledge/knowledge';
import { fakeClaude, fakeOpenAi, knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/describe-to-set-up.md "Describe Structure on a page".
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
const OPENAI_KEY = 'sk-proj-test-0123456789abcdefghij-9c1d';
const PURPOSE = 'How the logistics team ships a release.';
const STRUCTURE = JSON.stringify({
  blocks: [
    { kind: 'heading', level: 2, text: 'When We Ship', items: [] },
    { kind: 'text', level: null, text: 'The days releases go out.', items: [] },
    { kind: 'numbered', level: null, text: '', items: ['Check', 'Ship'] },
  ],
});
const BLOCKS = [
  { kind: 'heading', level: 2, text: 'When We Ship' },
  { kind: 'text', text: 'The days releases go out.' },
  { kind: 'numbered', items: ['Check', 'Ship'] },
];

function consoleSpy() {
  const lines: unknown[][] = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void lines.push(args));
  return () => JSON.stringify(lines);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const setKey = (kit: Kit, body: object = { key: KEY }) =>
  kit.call('editor', 'PUT', '/api/documents/kb/ai/key', body);
const draft = (kit: Kit, who: Who, body: unknown = { purpose: PURPOSE }, tab = 'holidays') =>
  kit.call(who, 'POST', `/api/documents/kb/pages/${tab}/describe-structure`, body);
const counters = (kit: Kit) =>
  kit.db.sql
    .prepare(
      "SELECT scope, used FROM usage_counters WHERE scope LIKE 'structure:%' ORDER BY scope",
    )
    .all();
const sentContent = (body: string) =>
  (JSON.parse(body) as { messages: { content: string }[] }).messages[0]!.content;
const failure = async (res: Response) => {
  const body = await res.json<{ error: string; message: string }>();
  return [res.status, body.error] as const;
};

// A fake `AI` binding: answers each ask in turn (the last one again after), and records what it was handed.
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
const builtInKit = (ai: ReturnType<typeof fakeAi>, more: object = withSecret) =>
  knowledgeKit({ ...more, AI: ai });

describe('POST pages/<tab>/describe-structure on the team key', () => {
  it("answers an Editor a structure read strictly, told only titles, and writes nothing", async () => {
    const logged = consoleSpy();
    const claude = fakeClaude(STRUCTURE);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    const before = kit.db.sql.prepare('SELECT id, rev FROM tabs ORDER BY id').all();
    const res = await draft(kit, 'editor', { purpose: PURPOSE, title: 'Time Off' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blocks: BLOCKS, provider: 'anthropic' });
    expect(claude.sent).toHaveLength(1);
    const sent = JSON.parse(claude.sent[0]!.body) as {
      max_tokens: number;
      messages: { content: string }[];
    };
    const content = sent.messages[0]!.content;
    expect(content).toContain('<knowledgebase>Handbook</knowledgebase>');
    expect(content).toContain('<page depth="1">Deploys</page>\n<page depth="2">Rollbacks</page>');
    // The draft's Title, sent with the request, over the saved name.
    expect(content).toContain('<page_title>Time Off</page_title>');
    expect(content).toContain(PURPOSE);
    // Never a page's writing.
    expect(content).not.toContain('Tuesdays');
    expect(content).not.toContain('last week of December');
    expect(kit.db.sql.prepare('SELECT id, rev FROM tabs ORDER BY id').all()).toEqual(before);
    expect(counters(kit)).toEqual([
      { scope: 'structure:knowledgebase', used: 1 },
      { scope: 'structure:person:user_o', used: 1 },
    ]);
    expect(logged()).not.toContain(KEY);
    expect(logged()).not.toContain('logistics');
    expect(logged()).not.toContain('When We Ship');
  });

  it("drafts from the saved name with no words, for a Participant as for an Editor", async () => {
    const claude = fakeClaude(STRUCTURE);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    expect((await draft(kit, 'participant', { purpose: '' })).status).toBe(200);
    expect(sentContent(claude.sent[0]!.body)).toContain(
      '<page_title>Holidays</page_title>',
    );
  });

  it('runs on OpenAI when that is the provider', async () => {
    const openai = fakeOpenAi(STRUCTURE);
    vi.stubGlobal('fetch', openai.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit, { provider: 'openai', key: OPENAI_KEY });
    const res = await draft(kit, 'editor');
    expect((await res.json<{ provider: string }>()).provider).toBe('openai');
    expect(openai.sent.map((s) => s.url)).toEqual(['https://api.openai.com/v1/responses']);
  });

  it('tells an agent it needs a person, and refuses everyone else who may not edit, with no call made', async () => {
    const claude = fakeClaude(STRUCTURE);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    for (const who of ['agent', 'agent-stored', 'participant-agent', 'viewer-agent'] as const)
      expect(await failure(await draft(kit, who))).toEqual([403, 'needs_a_person']);
    for (const who of ['viewer', 'link', 'page-link', 'stranger'] as const)
      expect((await draft(kit, who)).status).toBe(403);
    // An edit link to one page, with no account: it may edit, but is not signed in.
    expect(await failure(await draft(kit, 'edit-link'))).toEqual([403, 'sign_in_required']);
    expect(await failure(await draft(kit, 'page-edit-link', undefined, 'rollbacks'))).toEqual([
      403,
      'sign_in_required',
    ]);
    expect(claude.sent).toEqual([]);
    expect(counters(kit)).toEqual([]);
  });

  it('is a POST alone, on a page that is there', async () => {
    const kit = await knowledgeKit(withSecret);
    const path = '/api/documents/kb/pages/holidays/describe-structure';
    expect((await kit.call('editor', 'GET', path)).status).toBe(405);
    expect((await draft(kit, 'editor', undefined, 'nowhere')).status).toBe(404);
  });

  it('refuses words too long, or no title and no words, before any call', async () => {
    const claude = fakeClaude(STRUCTURE);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    expect(await failure(await draft(kit, 'editor', { purpose: 'x'.repeat(501) }))).toEqual([
      400,
      'purpose-too-long',
    ]);
    expect(await failure(await draft(kit, 'editor', { purpose: ' ', title: ' ' }))).toEqual([
      400,
      'no-purpose',
    ]);
    // Not JSON at all: no words, and the saved name drafts.
    expect((await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/describe-structure')).status).toBe(200);
    expect(claude.sent).toHaveLength(1);
  });

  it("keeps to a person's hour and the knowledgebase's day", async () => {
    vi.stubGlobal('fetch', fakeClaude(STRUCTURE).fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
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
    set('structure:person:user_o', STRUCTURE_PER_PERSON_PER_HOUR);
    expect(await failure(await draft(kit, 'editor'))).toEqual([429, 'person-limit']);
    set('structure:person:user_o', 0);
    set('structure:knowledgebase', STRUCTURE_PER_KNOWLEDGEBASE_PER_DAY);
    expect(await failure(await draft(kit, 'editor'))).toEqual([429, 'knowledgebase-limit']);
  });

  it('answers no structure in words for a reply with no heading, and a failed call by its kind', async () => {
    vi.stubGlobal('fetch', fakeClaude('{"blocks":[{"kind":"text","text":"Only words."}]}').fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    expect(await failure(await draft(kit, 'editor'))).toEqual([502, 'no-structure']);
    vi.stubGlobal(
      'fetch',
      fakeClaude(() => new Response('{"type":"error","error":{"type":"overloaded_error"}}', { status: 529 }))
        .fetch,
    );
    const res = await draft(kit, 'editor');
    const body = await res.json<{ error: string; provider: string }>();
    expect([res.status, body.error, body.provider]).toEqual([502, 'overloaded', 'anthropic']);
  });

  it('refuses a key that is kept but does not open, never swapping in built-in AI', async () => {
    const ai = fakeAi({ response: JSON.parse(STRUCTURE) });
    const kit = await builtInKit(ai);
    await setKey(kit);
    kit.db.sql.prepare("UPDATE knowledge_settings SET value = 'broken' WHERE name = ?").run('ai_key');
    expect(await failure(await draft(kit, 'editor'))).toEqual([409, 'ask_unavailable']);
    expect(ai.sent).toEqual([]);
  });

  it('reads a page by its title too', async () => {
    const claude = fakeClaude(STRUCTURE);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    expect((await draft(kit, 'editor', { purpose: '' }, 'Rollbacks')).status).toBe(200);
    expect(sentContent(claude.sent[0]!.body)).toContain(
      '<page_title>Rollbacks</page_title>',
    );
  });
});

describe('POST pages/<tab>/describe-structure on built-in AI', () => {
  const accountCount = (kit: Kit) => {
    const ns = kit.db.env.DOCUMENT_ROOM;
    return ns.get(ns.idFromName('~page-structure:user_o')) as unknown as {
      spendSetupDraft(day: string, cap: number): Promise<boolean>;
    };
  };
  const today = () => new Date().toISOString().slice(0, 10);

  it('answers with no key, in JSON mode, counted for the account apart from Describe to Set Up', async () => {
    const claude = fakeClaude(STRUCTURE);
    vi.stubGlobal('fetch', claude.fetch);
    const ai = fakeAi({ response: JSON.parse(STRUCTURE) });
    const kit = await builtInKit(ai, {});
    const res = await draft(kit, 'editor');
    expect(await res.json()).toEqual({ blocks: BLOCKS, provider: 'built-in' });
    expect(ai.sent).toHaveLength(1);
    expect(ai.sent[0]!.model).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(
      (ai.sent[0]!.input as unknown as { response_format: { json_schema: { name: string } } })
        .response_format.json_schema.name,
    ).toBe('page_structure');
    expect(claude.sent).toEqual([]);
    expect(
      await accountCount(kit).spendSetupDraft(today(), STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY),
    ).toBe(true);
    const setup = kit.db.env.DOCUMENT_ROOM;
    expect(
      await (
        setup.get(setup.idFromName('~setup-drafts:user_o')) as unknown as {
          spendSetupDraft(day: string, cap: number): Promise<boolean>;
        }
      ).spendSetupDraft(today(), 1),
    ).toBe(true);
    expect(counters(kit)).toEqual([
      { scope: 'structure:knowledgebase', used: 1 },
      { scope: 'structure:person:user_o', used: 1 },
    ]);
  });

  it("uses built-in AI when the person chose it over the team's key", async () => {
    const claude = fakeClaude(STRUCTURE);
    vi.stubGlobal('fetch', claude.fetch);
    const ai = fakeAi({ response: JSON.parse(STRUCTURE) });
    const kit = await builtInKit(ai);
    await setKey(kit);
    const res = await draft(kit, 'editor', { purpose: PURPOSE, ai: 'built-in' });
    expect((await res.json<{ provider: string }>()).provider).toBe('built-in');
    expect(claude.sent).toEqual([]);
    expect(ai.sent).toHaveLength(1);
    // The team's key otherwise.
    const keyed = await draft(kit, 'editor', { purpose: PURPOSE, ai: 'key' });
    expect((await keyed.json<{ provider: string }>()).provider).toBe('anthropic');
  });

  it('asks once more with why for a reply that does not read, and gives up after two', async () => {
    const ai = fakeAi({ response: 'Sure! Here you go.' }, { response: JSON.parse(STRUCTURE) });
    const kit = await builtInKit(ai);
    expect((await draft(kit, 'editor')).status).toBe(200);
    expect(ai.sent).toHaveLength(2);
    const second = ai.sent[1]!.input.messages[1]!.content;
    expect(second).toContain('not one JSON object');
    expect(second).not.toContain('Sure!');
    const none = fakeAi({ response: '{"blocks":[]}' });
    const kit2 = await builtInKit(none);
    expect(await failure(await draft(kit2, 'editor'))).toEqual([502, 'no-structure']);
    expect(none.sent).toHaveLength(2);
    expect(none.sent[1]!.input.messages[1]!.content).toContain('no heading');
  });

  it('says built-in AI failed when the binding errs, and is not set up when there is none', async () => {
    const ai = fakeAi(() => Promise.reject(new Error('boom')));
    const kit = await builtInKit(ai);
    expect(await failure(await draft(kit, 'editor'))).toEqual([502, 'built-in-failed']);
    const bare = await knowledgeKit(withSecret);
    expect(await failure(await draft(bare, 'editor'))).toEqual([503, 'built-in-unavailable']);
  });

  it("refuses at the person's daily cap, and refuses when the count cannot be reached", async () => {
    const ai = fakeAi({ response: JSON.parse(STRUCTURE) });
    const kit = await builtInKit(ai);
    const count = accountCount(kit);
    for (let i = 0; i < STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY; i += 1)
      await count.spendSetupDraft(today(), STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY);
    expect(await failure(await draft(kit, 'editor'))).toEqual([429, 'built-in-limit']);
    expect(ai.sent).toEqual([]);
  });

  it('refuses rather than lifting the cap when the count cannot be reached', async () => {
    const ai = fakeAi({ response: JSON.parse(STRUCTURE) });
    const kit = await builtInKit(ai);
    const ns = kit.db.env.DOCUMENT_ROOM;
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await failure(await draft(kit, 'editor'))).toEqual([502, 'built-in-failed']);
    expect(ai.sent).toEqual([]);
    expect(counters(kit)).toEqual([]);
  });
});
