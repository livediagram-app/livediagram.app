import { afterEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { ASK_PER_KNOWLEDGEBASE_PER_DAY, ASK_PER_PERSON_PER_HOUR } from '@liveknowledge/knowledge';
import { runConflictCheck, oweConflictChecks } from '../knowledge/conflict-check';
import { dueWork } from '../knowledge/knowledge-work';
import { runKnowledgeWork } from '../knowledge/knowledge-turn';
import {
  fakeClaude,
  fakeOpenAi,
  knowledgeKit,
  page,
  PAGES,
  type Kit,
  type Who,
} from './knowledge-test-kit';

// docs/specs/030-knowledgebase/search-and-ask.md "Ask" and ai-knowledge.md.
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
const withSecret = { AI_KEY_SECRET: SECRET };

// Everything a test's console calls were given, to search for the key.
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

const setKey = (kit: Kit) => kit.call('editor', 'PUT', '/api/documents/kb/ai/key', { key: KEY });
const everything = (kit: Kit) =>
  JSON.stringify(
    ['knowledge_settings', 'questions', 'usage_counters', 'knowledge_work', 'conflicts'].map((t) =>
      kit.db.sql.prepare(`SELECT * FROM ${t}`).all(),
    ),
  );

type Event = { type: string; text?: string; kind?: string; message?: string } & Record<
  string,
  unknown
>;
async function events(res: Response): Promise<Event[]> {
  return (await res.text())
    .split('\n\n')
    .filter(Boolean)
    .map((block) => JSON.parse(block.slice(block.indexOf('data: ') + 6)) as Event);
}

describe('the Claude API key', () => {
  it("is sealed, never sent back, never logged; the hint is an Editor's alone", async () => {
    const logged = consoleSpy();
    const kit = await knowledgeKit(withSecret);
    const res = await setKey(kit);
    const settings = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(settings)).toEqual({
      provider: 'anthropic',
      providers: [
        { id: 'anthropic', label: 'Anthropic (Claude)', keyPrefix: 'sk-ant-' },
        { id: 'openai', label: 'OpenAI', keyPrefix: 'sk-' },
      ],
      hasKey: true,
      keyHint: '4f2a',
      model: 'claude-fable-5-2',
      models: [
        { id: 'claude-fable-5-2', label: 'Claude Fable 5.2' },
        { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
        { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
        { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
      ],
      // This deployment has no `AI` binding.
      builtIn: false,
    });
    const read = await Promise.all(
      (['editor', 'participant', 'viewer', 'link'] as Who[]).map(async (who) =>
        (await kit.call(who, 'GET', '/api/documents/kb/ai')).text(),
      ),
    );
    expect(read.map((r) => (JSON.parse(r) as { keyHint: string }).keyHint)).toEqual([
      '4f2a',
      '',
      '',
      '',
    ]);
    expect(read.every((r) => (JSON.parse(r) as { hasKey: boolean }).hasKey)).toBe(true);
    for (const text of [settings, ...read, everything(kit), logged()]) {
      expect(text).not.toContain(KEY);
      expect(text).not.toContain(KEY.slice(0, 20));
    }
    // Stored as an envelope, bound to this knowledgebase.
    const envelope = (
      kit.db.sql.prepare("SELECT value FROM knowledge_settings WHERE name = 'ai_key'").get() as {
        value: string;
      }
    ).value;
    expect(envelope).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
  });

  it.each(['participant', 'viewer', 'link', 'page-link', 'stranger'] as const)(
    'cannot be set, removed or its model chosen by %s',
    async (who) => {
      const kit = await knowledgeKit(withSecret);
      await setKey(kit);
      for (const [method, path, body] of [
        ['PUT', 'ai/key', { key: 'sk-other-key-0000000000' }],
        ['DELETE', 'ai/key', undefined],
        ['PUT', 'ai/model', { model: 'claude-haiku-5-5' }],
      ] as const)
        expect((await kit.call(who, method, `/api/documents/kb/${path}`, body)).status).toBe(403);
      const still = await (await kit.call('editor', 'GET', '/api/documents/kb/ai')).json<object>();
      expect(still).toMatchObject({ hasKey: true, keyHint: '4f2a', model: 'claude-fable-5-2' });
    },
  );

  it('is removed and its model chosen by an Editor; a value that is no key or no model is refused', async () => {
    const kit = await knowledgeKit(withSecret);
    const error = async (method: string, path: string, body: unknown) => {
      const res = await kit.call('editor', method, `/api/documents/kb/${path}`, body);
      const text = await res.text();
      return [res.status, (JSON.parse(text) as { error: string }).error, text] as const;
    };
    const tooLong = 'k'.repeat(513);
    const refused = await error('PUT', 'ai/key', { key: tooLong });
    expect(refused.slice(0, 2)).toEqual([400, 'invalid_key']);
    expect(refused[2]).not.toContain(tooLong);
    expect((await error('PUT', 'ai/key', { key: 7 })).slice(0, 2)).toEqual([400, 'invalid_key']);
    expect((await error('PUT', 'ai/key', { key: '' })).slice(0, 2)).toEqual([400, 'invalid_key']);
    expect((await error('PUT', 'ai/model', { model: 'gpt-4' })).slice(0, 2)).toEqual([
      400,
      'invalid_model',
    ]);
    await setKey(kit);
    const model = await kit.call('editor', 'PUT', '/api/documents/kb/ai/model', {
      model: 'claude-haiku-5-5',
    });
    expect(await model.json()).toMatchObject({ model: 'claude-haiku-5-5', hasKey: true });
    const removed = await kit.call('editor', 'DELETE', '/api/documents/kb/ai/key');
    expect(await removed.json()).toMatchObject({
      hasKey: false,
      keyHint: '',
      model: 'claude-haiku-5-5',
    });
  });

  it('cannot be kept by a deployment with no AI_KEY_SECRET, where everything else still works', async () => {
    const kit = await knowledgeKit();
    const res = await setKey(kit);
    expect([res.status, await res.json()]).toEqual([
      503,
      {
        error: 'ask_unavailable',
        message: "Built-in AI isn't set up on this server, and it keeps no key.",
      },
    ]);
    expect((await kit.call('viewer', 'GET', '/api/documents/kb/search?q=deploy')).status).toBe(200);
    expect(await (await kit.call('viewer', 'GET', '/api/documents/kb/ai')).json()).toMatchObject({
      hasKey: false,
    });
    const ask = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy?',
    });
    // No key and no built-in AI either: nothing can answer.
    expect([ask.status, (await ask.json<{ error: string }>()).error]).toEqual([
      503,
      'built-in-unavailable',
    ]);
  });
});

describe('the provider (search-and-ask.md "Providers")', () => {
  const OPENAI_KEY = 'sk-proj-test-0123456789abcdefghij-9c1d';
  const put = (kit: Kit, body: unknown, who: Who = 'editor') =>
    kit.call(who, 'PUT', '/api/documents/kb/ai/key', body);
  const read = async (kit: Kit, who: Who = 'editor') =>
    (await kit.call(who, 'GET', '/api/documents/kb/ai')).json<Record<string, unknown>>();

  it('reads a key stored before there was a choice as Anthropic', async () => {
    const kit = await knowledgeKit(withSecret);
    expect(await read(kit)).toMatchObject({ provider: 'anthropic', hasKey: false });
    await setKey(kit);
    kit.db.sql.prepare("DELETE FROM knowledge_settings WHERE name = 'ai_provider'").run();
    expect(await read(kit)).toMatchObject({
      provider: 'anthropic',
      hasKey: true,
      model: 'claude-fable-5-2',
    });
  });

  it('takes an OpenAI key, lists its models, and keeps the model to the provider', async () => {
    const logged = consoleSpy();
    const kit = await knowledgeKit(withSecret);
    const res = await put(kit, { provider: 'openai', key: OPENAI_KEY });
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({
      provider: 'openai',
      hasKey: true,
      keyHint: '9c1d',
      model: 'gpt-6.2-astra',
      models: [
        { id: 'gpt-6.2-astra', label: 'GPT-6.2 Astra' },
        { id: 'gpt-6.2-sol', label: 'GPT-6.2 Sol' },
        { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra' },
        { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
      ],
    });
    const model = (id: string) =>
      kit.call('editor', 'PUT', '/api/documents/kb/ai/model', { model: id });
    expect((await model('claude-haiku-5-5')).status).toBe(400);
    expect(await (await model('gpt-6.2-sol')).json()).toMatchObject({ model: 'gpt-6.2-sol' });
    expect(await read(kit, 'viewer')).toMatchObject({ provider: 'openai', keyHint: '' });
    for (const held of [text, everything(kit), logged()]) expect(held).not.toContain(OPENAI_KEY);
  });

  it('replaces the key and forgets the model when the provider changes; one key at a time', async () => {
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    await kit.call('editor', 'PUT', '/api/documents/kb/ai/model', { model: 'claude-haiku-5-5' });
    expect(await (await put(kit, { provider: 'openai', key: OPENAI_KEY })).json()).toMatchObject({
      provider: 'openai',
      keyHint: '9c1d',
      model: 'gpt-6.2-astra',
    });
    expect(
      kit.db.sql
        .prepare("SELECT COUNT(*) AS n FROM knowledge_settings WHERE name = 'ai_key'")
        .get(),
    ).toEqual({ n: 1 });
    // A key sent with no provider is for the provider already chosen, and the model stays.
    await kit.call('editor', 'PUT', '/api/documents/kb/ai/model', { model: 'gpt-6-luna' });
    expect(await (await put(kit, { key: `${OPENAI_KEY}-2` })).json()).toMatchObject({
      provider: 'openai',
      model: 'gpt-6-luna',
    });
    // Removing the key keeps the choice of provider.
    await kit.call('editor', 'DELETE', '/api/documents/kb/ai/key');
    expect(await read(kit)).toMatchObject({ provider: 'openai', hasKey: false });
  });

  it('refuses a provider that is neither, and stores nothing', async () => {
    const kit = await knowledgeKit(withSecret);
    for (const provider of ['gemini', '', 7, null]) {
      const res = await put(kit, { provider, key: OPENAI_KEY });
      expect([res.status, (await res.json<{ error: string }>()).error]).toEqual([
        400,
        'invalid_provider',
      ]);
    }
    expect(await read(kit)).toMatchObject({ hasKey: false, provider: 'anthropic' });
    for (const who of ['participant', 'viewer', 'link'] as const)
      expect((await put(kit, { provider: 'openai', key: OPENAI_KEY }, who)).status).toBe(403);
  });

  it("answers on OpenAI's host with the key as a bearer token, and never on Anthropic's", async () => {
    const logged = consoleSpy();
    const openai = fakeOpenAi(
      '<answer>Deploys go out on Tuesdays [1].</answer><gap>Who approves a deploy?</gap>',
    );
    vi.stubGlobal('fetch', openai.fetch);
    const kit = await knowledgeKit(withSecret);
    await put(kit, { provider: 'openai', key: OPENAI_KEY });
    const res = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy?',
    });
    const text = await res.clone().text();
    const all = await events(res);
    expect(all.at(-1)).toMatchObject({
      type: 'done',
      text: 'Deploys go out on Tuesdays [1].',
      gaps: ['Who approves a deploy?'],
      model: 'gpt-6.2-astra',
    });
    expect(openai.sent).toHaveLength(1);
    expect(openai.sent[0]!.url).toBe('https://api.openai.com/v1/responses');
    expect(openai.sent[0]!.headers.authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(openai.sent[0]!.headers).not.toHaveProperty('x-api-key');
    const body = JSON.parse(openai.sent[0]!.body) as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'gpt-6.2-astra', stream: true, store: false });
    expect(String(body.instructions)).toContain('only from the passages');
    expect(openai.sent[0]!.body).toContain('Deploys go out on Tuesdays');
    expect(openai.sent[0]!.body).not.toContain(OPENAI_KEY);
    for (const held of [text, logged(), everything(kit)]) expect(held).not.toContain(OPENAI_KEY);
  });

  it('names OpenAI in a failure, in words, with nothing of what it said', async () => {
    const logged = consoleSpy();
    const upstream = `Incorrect API key provided: ${OPENAI_KEY}`;
    vi.stubGlobal(
      'fetch',
      fakeOpenAi(
        () =>
          new Response(
            JSON.stringify({ error: { message: upstream, type: 'x', code: 'invalid_api_key' } }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          ),
      ).fetch,
    );
    const kit = await knowledgeKit(withSecret);
    await put(kit, { provider: 'openai', key: OPENAI_KEY });
    const res = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy?',
    });
    const text = await res.clone().text();
    expect(await events(res)).toEqual([
      {
        type: 'error',
        kind: 'bad-key',
        provider: 'openai',
        message: 'OpenAI did not accept the API key. Replace it in Settings.',
      },
    ]);
    for (const held of [text, logged()]) {
      expect(held).not.toContain(OPENAI_KEY);
      expect(held).not.toContain('Incorrect API key');
    }
  });
});

const ANSWER =
  '<answer>Deploys go out on Tuesdays [1]. Nobody wrote down who approves them.</answer>' +
  '<gap>Who approves a deploy?</gap>';

describe('POST ask', () => {
  it.each(['editor', 'participant', 'viewer'] as const)(
    "streams %s an answer from the pages, with its sources and gaps, on the team's key",
    async (who) => {
      const logged = consoleSpy();
      const claude = fakeClaude(ANSWER);
      vi.stubGlobal('fetch', claude.fetch);
      const kit = await knowledgeKit(withSecret);
      await setKey(kit);
      await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
      const res = await kit.call(who, 'POST', '/api/documents/kb/ask', {
        question: 'When do we deploy?',
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
      const text = await res.clone().text();
      const all = await events(res);
      expect(all.slice(0, -1).every((e) => e.type === 'delta')).toBe(true);
      expect(
        all
          .slice(0, -1)
          .map((e) => e.text)
          .join(''),
      ).toBe('Deploys go out on Tuesdays [1]. Nobody wrote down who approves them.');
      const done = all.at(-1)!;
      expect(done).toMatchObject({
        type: 'done',
        gaps: ['Who approves a deploy?'],
        notUsed: [],
        model: 'claude-fable-5-2',
        provider: 'anthropic',
      });
      expect(done.sources).toEqual([
        expect.objectContaining({ number: 1, tab: 'deploys', title: 'Deploys', trust: 'verified' }),
      ]);
      // One call, to the Anthropic API alone, the key in its header and nowhere else.
      expect(claude.sent).toHaveLength(1);
      expect(claude.sent[0]!.url).toBe('https://api.anthropic.com/v1/messages');
      expect(claude.sent[0]!.headers['x-api-key']).toBe(KEY);
      expect(claude.sent[0]!.body).not.toContain(KEY);
      expect(JSON.parse(claude.sent[0]!.body)).not.toHaveProperty('fallbacks');
      expect(claude.sent[0]!.body).toContain('Deploys go out on Tuesdays');
      for (const held of [text, logged(), everything(kit)]) expect(held).not.toContain(KEY);
      // The gap is a question nobody could answer.
      expect(kit.db.sql.prepare('SELECT question, asked, people FROM questions').all()).toEqual([
        { question: 'Who approves a deploy?', asked: 1, people: 1 },
      ]);
    },
  );

  // ai-knowledge.md "Questions nobody could answer": a question answered in full later leaves the list.
  it('takes a question off the unanswered list once Ask answers it in full from pages', async () => {
    vi.stubGlobal('fetch', fakeClaude(ANSWER).fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    await events(
      await kit.call('editor', 'POST', '/api/documents/kb/ask', { question: 'When do we deploy?' }),
    );
    const logged = () => kit.db.sql.prepare('SELECT question FROM questions').all();
    expect(logged()).toEqual([{ question: 'Who approves a deploy?' }]);
    // Answered with a gap: it stays. Answered with no source: it stays too.
    vi.stubGlobal('fetch', fakeClaude('<answer>No page says.</answer>').fetch);
    await events(
      await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
        question: 'Who approves a deploy?',
      }),
    );
    expect(logged()).toEqual([{ question: 'Who approves a deploy?' }]);
    vi.stubGlobal('fetch', fakeClaude('<answer>The release lead approves it [1].</answer>').fetch);
    await events(
      await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
        question: 'Who approves a deploy?',
      }),
    );
    expect(logged()).toEqual([]);
  });

  it.each(['link', 'page-link', 'stranger'] as const)(
    'is refused for %s, with no call made',
    async (who) => {
      const claude = fakeClaude(ANSWER);
      vi.stubGlobal('fetch', claude.fetch);
      const kit = await knowledgeKit(withSecret);
      await setKey(kit);
      const res = await kit.call(who, 'POST', '/api/documents/kb/ask', {
        question: 'When do we deploy?',
      });
      expect(res.status).toBe(403);
      expect(claude.sent).toEqual([]);
      expect(kit.db.sql.prepare('SELECT * FROM usage_counters').all()).toEqual([]);
    },
  );

  it('says a knowledgebase with no key and no built-in AI cannot answer, and refuses a question with no words or too many', async () => {
    const claude = fakeClaude(ANSWER);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    const ask = async (question: unknown) => {
      const res = await kit.call('viewer', 'POST', '/api/documents/kb/ask', { question });
      return [res.status, (await res.json<{ error: string }>()).error];
    };
    expect(await ask('When do we deploy?')).toEqual([503, 'built-in-unavailable']);
    await setKey(kit);
    expect(await ask('   ')).toEqual([400, 'no-question']);
    expect(await ask(7)).toEqual([400, 'no-question']);
    expect(await ask('x'.repeat(1001))).toEqual([400, 'question-too-long']);
    expect(claude.sent).toEqual([]);
  });

  it('answers 20 a person an hour and 200 a knowledgebase a day, counted in the room', async () => {
    const claude = fakeClaude('<answer>Tuesdays [1].</answer>');
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    const ask = async (who: Who) => {
      const res = await kit.call(who, 'POST', '/api/documents/kb/ask', {
        question: 'When do we deploy?',
      });
      const text = await res.text();
      return res.status === 200 ? 200 : [res.status, (JSON.parse(text) as { error: string }).error];
    };
    for (let i = 0; i < ASK_PER_PERSON_PER_HOUR; i++) expect(await ask('viewer')).toBe(200);
    expect(await ask('viewer')).toEqual([429, 'person-limit']);
    // Another person still may; the knowledgebase's day is one count for everyone.
    expect(await ask('participant')).toBe(200);
    expect(claude.sent).toHaveLength(ASK_PER_PERSON_PER_HOUR + 1);
    kit.db.sql
      .prepare("UPDATE usage_counters SET used = ? WHERE scope = 'ask:knowledgebase'")
      .run(ASK_PER_KNOWLEDGEBASE_PER_DAY);
    expect(await ask('editor')).toEqual([429, 'knowledgebase-limit']);
    expect(claude.sent).toHaveLength(ASK_PER_PERSON_PER_HOUR + 1);
  });

  it('says which failure in words, never the upstream error, the request or the key', async () => {
    const logged = consoleSpy();
    const upstream = `invalid x-api-key ${KEY} for request req_011CSecretDetail`;
    const claude = fakeClaude(
      () =>
        new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'authentication_error', message: upstream },
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    const res = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy?',
    });
    const text = await res.clone().text();
    expect(await events(res)).toEqual([
      {
        type: 'error',
        kind: 'bad-key',
        provider: 'anthropic',
        message: 'Claude did not accept the API key. Replace it in Settings.',
      },
    ]);
    for (const held of [text, logged()]) {
      expect(held).not.toContain(KEY);
      expect(held).not.toContain('req_011CSecretDetail');
    }
    // A thrown fetch is `other`, and its own message goes nowhere.
    vi.stubGlobal('fetch', async () => {
      throw new Error(`socket hang up while sending ${KEY}`);
    });
    const thrown = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy?',
    });
    const thrownText = await thrown.clone().text();
    expect((await events(thrown))[0]).toMatchObject({ type: 'error', kind: 'other' });
    expect(thrownText + logged()).not.toContain(KEY);
  });

  it('lets an agent ask for its account, and logs its gap under its name', async () => {
    vi.stubGlobal('fetch', fakeClaude(ANSWER).fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    const res = await kit.call('agent', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy?',
    });
    expect((await events(res)).at(-1)).toMatchObject({ type: 'done' });
    expect(kit.db.sql.prepare('SELECT agent, asked FROM question_agents').all()).toEqual([
      { agent: 'Coding Agent', asked: 1 },
    ]);
  });
});

describe('AI Knowledge', () => {
  it.each(['editor', 'participant', 'viewer', 'link'] as const)(
    'shows %s the agents, questions, context pages and health',
    async (who) => {
      const kit = await knowledgeKit(withSecret);
      await kit.call('agent', 'GET', '/api/documents/kb/tabs/deploys');
      await kit.call('agent', 'GET', '/api/documents/kb/tabs/deploys');
      await kit.call('agent', 'GET', '/api/documents/kb/search?q=parental+leave');
      await kit.call('viewer', 'POST', '/api/documents/kb/questions', {
        question: 'Parental leave?',
      });
      await kit.call('editor', 'PUT', '/api/documents/kb/pages/holidays/knowledge', {
        context: true,
      });
      await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
      const res = await kit.call(who, 'GET', '/api/documents/kb/knowledge');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        agents: [
          {
            id: expect.any(String),
            name: 'Coding Agent',
            door: 'mcp',
            // What the room holds for the token: the default, whatever this test's caller was handed.
            scopes: ['read', 'suggest'],
            canHoldWrite: true,
            lastSeenAt: expect.any(Number),
            // The token's id is an Editor's alone, in person.
            ...(who === 'editor' ? { tokenId: 'tok_1' } : {}),
            readsThisWeek: 2,
            topPages: [{ tab: 'deploys', title: 'Deploys' }],
          },
        ],
        questions: [
          {
            key: expect.any(String),
            question: 'parental leave',
            asked: 2,
            byPeople: 1,
            agents: [{ name: 'Coding Agent', asked: 1 }],
            lastAt: expect.any(Number),
          },
        ],
        conflicts: [],
        suggestions: [],
        context: {
          budget: 8000,
          used: 20,
          pages: [{ tab: 'holidays', title: 'Holidays', tokens: 20 }],
        },
        health: { verified: 1, reviewDue: 0, neverVerified: 2, total: 3 },
        reviewEvery: 90,
        hasKey: false,
        // No key, and this deployment has no built-in AI.
        hasAi: false,
        // This deployment sends no email, and nobody was reminded.
        reviewEmails: { available: false },
        // The agent's two reads of Deploys, today (knowledge-overview-reads.test.ts has the rest).
        reads: {
          days: expect.any(Array),
          mostRead: [{ tab: 'deploys', title: 'Deploys', people: 0, agents: 2 }],
        },
      });
    },
  );

  it('takes a reported gap from anyone with an account, and its dismissal from an Editor alone', async () => {
    const kit = await knowledgeKit();
    const report = (who: Who, question: unknown) =>
      kit.call(who, 'POST', '/api/documents/kb/questions', { question });
    expect((await report('agent', 'How do we rotate the signing keys?')).status).toBe(201);
    expect((await report('viewer', 'How do we rotate signing keys')).status).toBe(201);
    expect((await report('link', 'Anything?')).status).toBe(403);
    expect((await report('stranger', 'Anything?')).status).toBe(403);
    expect((await report('viewer', '?!')).status).toBe(400);
    expect((await report('viewer', 'x'.repeat(1001))).status).toBe(400);
    const [group] = kit.db.sql.prepare('SELECT key, asked, people FROM questions').all() as {
      key: string;
      asked: number;
    }[];
    expect(group).toMatchObject({ asked: 2, people: 1 });
    const path = `/api/documents/kb/questions/${encodeURIComponent(group!.key)}`;
    for (const who of ['viewer', 'link', 'stranger'] as const)
      expect((await kit.call(who, 'DELETE', path)).status).toBe(403);
    // A Participant dismisses as an Editor does (ai-knowledge.md "Share roles").
    expect((await kit.call('participant', 'DELETE', path)).status).toBe(204);
    expect(kit.db.sql.prepare('SELECT * FROM questions').all()).toEqual([]);
    expect(kit.db.sql.prepare('SELECT * FROM question_agents').all()).toEqual([]);
  });
});

describe('pages that disagree', () => {
  const CONTRARY = page('releases', 'Releases', [
    {
      id: 'b1',
      type: 'paragraph',
      runs: [{ text: 'Deploys go out on Fridays after the morning standup, never on a Tuesday.' }],
    },
  ]);
  const VERDICT = '<pair number="1" verdict="conflict">When do deploys go out?</pair>';

  async function arrange(reply = VERDICT) {
    const claude = fakeClaude(reply);
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await knowledgeKit(withSecret);
    await setKey(kit);
    const sql = nodeItemSql(kit.db.sql);
    await kit.call('editor', 'PUT', '/api/documents/kb/tabs/releases', CONTRARY);
    // What the room does when a write indexes a page anew.
    oweConflictChecks(sql, [{ tab: 'releases', before: [] }], 1_000);
    return { kit, claude, sql };
  }

  it('checks a saved page against the others on the alarm, never in the save, and stores what it finds', async () => {
    const { kit, claude, sql } = await arrange();
    expect(claude.sent).toEqual([]);
    expect(dueWork(sql, 1_000, 5)).toEqual([]);
    const now = Date.now();
    expect(await runKnowledgeWork(kit.db.env, sql, 'kb', now)).toBeNull();
    expect(claude.sent).toHaveLength(1);
    expect(claude.sent[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    const overview = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/knowledge')
    ).json<{
      conflicts: {
        id: string;
        question: string;
        a: { tab: string; firstBlock: string };
        b: { tab: string; firstBlock: string };
      }[];
    }>();
    expect(overview.conflicts).toHaveLength(1);
    // Each side says where its passage begins on its page, so Fix the Other opens the page at it.
    for (const side of [overview.conflicts[0]!.a, overview.conflicts[0]!.b]) {
      const first = kit.db.sql
        .prepare('SELECT first_block FROM passages WHERE tab = ? AND first_block = ?')
        .all(side.tab, side.firstBlock);
      expect(first.length).toBeGreaterThan(0);
      expect(side.firstBlock).not.toBe('');
    }
    expect(overview.conflicts[0]).toMatchObject({ question: 'When do deploys go out?' });
    expect([overview.conflicts[0]!.a.tab, overview.conflicts[0]!.b.tab].sort()).toEqual([
      'deploys',
      'releases',
    ]);
    // Not a Conflict: an Editor's or a Participant's, and for good.
    const path = `/api/documents/kb/conflicts/${overview.conflicts[0]!.id}/dismiss`;
    for (const who of ['viewer', 'link', 'stranger'] as const)
      expect((await kit.call(who, 'POST', path)).status).toBe(403);
    expect((await kit.call('participant', 'POST', path)).status).toBe(204);
    const after = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/knowledge')
    ).json<{
      conflicts: unknown[];
    }>();
    expect(after.conflicts).toEqual([]);
  });

  it('closes a conflict when either passage changes', async () => {
    const { kit, sql } = await arrange();
    await runKnowledgeWork(kit.db.env, sql, 'kb', Date.now());
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM conflicts').get()).toEqual({ n: 1 });
    await kit.call(
      'editor',
      'PUT',
      '/api/documents/kb/tabs/releases',
      page('releases', 'Releases', [
        {
          id: 'b1',
          type: 'paragraph',
          runs: [{ text: 'Deploys go out on Tuesdays, as the Deploys page says.' }],
        },
      ]),
    );
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM conflicts').get()).toEqual({ n: 0 });
  });

  it('checks a page at most once in 10 minutes and 50 times a day, and never without a key', async () => {
    const { kit, claude } = await arrange('<pair number="1" verdict="consistent"></pair>');
    const now = Date.now();
    const work = { kind: 'conflict' as const, key: 'releases', dueAt: now, payload: '[]' };
    expect(await runConflictCheck(kit.db.env, 'kb', work, now)).toBeNull();
    expect(claude.sent).toHaveLength(1);
    // Under 10 minutes on: put off until the 10 minutes are up, with no call.
    expect(await runConflictCheck(kit.db.env, 'kb', work, now + 60_000)).toBe(now + 600_000);
    expect(claude.sent).toHaveLength(1);
    kit.db.sql.prepare("UPDATE usage_counters SET used = 50 WHERE scope = 'conflicts:check'").run();
    expect(await runConflictCheck(kit.db.env, 'kb', work, now + 700_000)).toBeNull();
    expect(claude.sent).toHaveLength(1);
    await kit.call('editor', 'DELETE', '/api/documents/kb/ai/key');
    kit.db.sql.exec('DELETE FROM usage_counters; DELETE FROM conflict_checks');
    expect(await runConflictCheck(kit.db.env, 'kb', work, now + 800_000)).toBeNull();
    expect(claude.sent).toHaveLength(1);
  });

  it('owes no check for a page indexed with nothing before it to compare', async () => {
    const kit = await knowledgeKit(withSecret, PAGES);
    const sql = nodeItemSql(kit.db.sql);
    expect(oweConflictChecks(sql, [{ tab: 'deploys', before: null }], 1_000)).toBe(0);
    expect(kit.db.sql.prepare('SELECT * FROM knowledge_work').all()).toEqual([]);
  });
});
