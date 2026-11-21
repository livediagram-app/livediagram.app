// Which key answers (docs/specs/030-knowledgebase/search-and-ask.md "Which key answers"): the knowledgebase's own,
// else its team's, else the asker's own, else built-in AI; a shared key only for a signed-in person's own request,
// asked of accounts over its binding with their token; the key held for the one call and never logged or kept.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyingAi, askerOf, whichAi } from '../knowledge/ai-settings';
import { fakeClaude, fakeOpenAi, knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

const KB_KEY = 'sk-ant-knowledgebase-key-0000000000-kb01';
const TEAM_KEY = 'sk-proj-planted-team-key-111111111-tm02';
const OWN_KEY = 'sk-ant-planted-personal-key-2222222-pk03';

type Asked = { token: string; teamId?: string; want: string };
// accounts' internal door as liveknowledge's binding reaches it: team_1's key for user_o and user_p (its members),
// user_v's own key, nothing for anyone else. `unreadable` makes every set key fail to open.
function accounts(options: { unreadable?: boolean; down?: boolean } = {}) {
  const asked: (Asked & { url: string; authorization: string | null })[] = [];
  const binding = {
    fetch: async (input: string | Request, init?: RequestInit) => {
      // The app's other account calls (names, profiles) are no concern here.
      const url = typeof input === 'string' ? input : input.url;
      if (!url.endsWith('/internal/ai-key')) return Response.json({}, { status: 404 });
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Asked;
      asked.push({
        ...body,
        url,
        authorization: new Headers(init?.headers).get('authorization'),
      });
      if (options.down) throw new Error('binding down');
      const person = body.token.replace(/^jwt-/, '');
      const team = body.teamId === 'team_1' && ['user_o', 'user_p'].includes(person);
      const own = person === 'user_v';
      if (!team && !own) return Response.json({ source: null });
      const source = team ? 'team' : 'account';
      if (options.unreadable)
        return Response.json({ error: 'ai_key_unreadable', source }, { status: 409 });
      const key = team
        ? { provider: 'openai', model: 'gpt-6-luna', key: TEAM_KEY }
        : { provider: 'anthropic', model: 'claude-haiku-5-5', key: OWN_KEY };
      const { key: plain, ...which } = key;
      return Response.json({ source, ...which, ...(body.want === 'key' ? { key: plain } : {}) });
    },
  };
  return { binding, asked };
}

function consoleSpy() {
  const lines: unknown[][] = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void lines.push(args));
  return () => JSON.stringify(lines);
}

// The provider's fake, with every other outbound call (the index, names) answered empty and left out of `sent`.
function onlyProvider<T extends { fetch: typeof fetch; sent: { url: string }[] }>(fake: T): T {
  const through = fake.fetch;
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!/^https:\/\/api\.(anthropic|openai)\.com\//.test(url))
      return Response.json({}, { status: 404 });
    return through(input, init);
  }) as typeof globalThis.fetch;
  return { ...fake, fetch };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function kitWith(door: ReturnType<typeof accounts>, base: Record<string, unknown> = {}) {
  const kit = await knowledgeKit(
    {
      AI_KEY_SECRET: 'test-ai-key-secret',
      ACCOUNTS_URL: 'https://www.liveworkspace.app',
      ACCOUNTS_CLIENT_ID: 'liveknowledge',
      ACCOUNTS_CLIENT_SECRET: 'client-secret',
      ACCOUNTS: door.binding,
      ...base,
    } as never,
    undefined,
    { bearers: true },
  );
  kit.db.sql.prepare(`UPDATE document SET team_id = 'team_1'`).run();
  return kit;
}

const ask = (kit: Kit, who: Who, body: object = {}) =>
  kit.call(who, 'POST', '/api/documents/kb/ask', { question: 'When do we deploy?', ...body });
const uses = async (kit: Kit, who: Who) =>
  (await kit.call(who, 'GET', '/api/documents/kb/ai')).json<{ uses: string; usesModel?: string }>();

describe('which key answers', () => {
  it("is the team's key for a member, with the person's own token, and nothing kept or logged", async () => {
    const logged = consoleSpy();
    const door = accounts();
    const kit = await kitWith(door);
    const openai = onlyProvider(fakeOpenAi('Tuesdays [1].'));
    vi.stubGlobal('fetch', openai.fetch);
    const res = await ask(kit, 'participant');
    const streamed = await res.text();
    expect(res.status).toBe(200);
    expect(openai.sent).toHaveLength(1);
    expect(openai.sent[0]!.url).toBe('https://api.openai.com/v1/responses');
    expect(openai.sent[0]!.headers.authorization).toBe(`Bearer ${TEAM_KEY}`);
    expect(JSON.parse(openai.sent[0]!.body)).toMatchObject({ model: 'gpt-6-luna' });
    expect(door.asked).toEqual([
      {
        url: 'https://www.liveworkspace.app/internal/ai-key',
        authorization: `Basic ${btoa('liveknowledge:client-secret')}`,
        token: 'jwt-user_p',
        teamId: 'team_1',
        want: 'key',
      },
    ]);
    const rows = JSON.stringify(
      ['knowledge_settings', 'questions', 'usage_counters', 'knowledge_work'].map((t) =>
        kit.db.sql.prepare(`SELECT * FROM ${t}`).all(),
      ),
    );
    for (const text of [streamed, rows, logged()]) expect(text).not.toContain(TEAM_KEY);
    expect(await uses(kit, 'participant')).toEqual(
      expect.objectContaining({
        uses: 'team',
        usesModel: 'gpt-6-luna',
        usesModelLabel: 'GPT-6 Luna',
      }),
    );
    // `GET ai` asks which, never for the key.
    expect(door.asked.at(-1)!.want).toBe('which');
  });

  it("is the person's own key when the team has none for them", async () => {
    const door = accounts();
    const kit = await kitWith(door);
    const claude = onlyProvider(fakeClaude('Tuesdays [1].'));
    vi.stubGlobal('fetch', claude.fetch);
    expect((await ask(kit, 'viewer')).status).toBe(200);
    expect(claude.sent[0]!.headers['x-api-key']).toBe(OWN_KEY);
    expect(JSON.parse(claude.sent[0]!.body)).toMatchObject({ model: 'claude-haiku-5-5' });
    expect(await uses(kit, 'viewer')).toEqual(
      expect.objectContaining({
        uses: 'personal',
        usesModel: 'claude-haiku-5-5',
        usesModelLabel: 'Claude Haiku 5.5',
      }),
    );
  });

  it("is the knowledgebase's own key first, and accounts is not asked", async () => {
    const door = accounts();
    const kit = await kitWith(door);
    await kit.call('editor', 'PUT', '/api/documents/kb/ai/key', { key: KB_KEY });
    const claude = onlyProvider(fakeClaude('Tuesdays [1].'));
    vi.stubGlobal('fetch', claude.fetch);
    expect((await ask(kit, 'participant')).status).toBe(200);
    expect(claude.sent[0]!.headers['x-api-key']).toBe(KB_KEY);
    expect(await uses(kit, 'participant')).toEqual(
      expect.objectContaining({ uses: 'knowledgebase', usesModel: 'claude-fable-5-2' }),
    );
    expect(door.asked).toEqual([]);
  });

  it('is built-in AI for someone with no key, and for an API token, which never reaches accounts', async () => {
    const door = accounts();
    const kit = await kitWith(door);
    vi.stubGlobal('fetch', fakeClaude('x').fetch);
    // No AI binding here: built-in AI is refused as unavailable, which shows no key was used.
    const stranger = await kit.call('stranger', 'GET', '/api/documents/kb/ai');
    expect(stranger.status).toBe(403);
    const agent = await ask(kit, 'agent');
    expect((await agent.json<{ error: string }>()).error).toBe('built-in-unavailable');
    expect(door.asked).toEqual([]);
    // The owner, a member of team_1 too, is answered on the team's key; asking for built-in AI skips every key.
    const chosen = await ask(kit, 'editor', { ai: 'built-in' });
    expect((await chosen.json<{ error: string }>()).error).toBe('built-in-unavailable');
    expect(door.asked).toEqual([]);
  });

  it("refuses a shared key that won't open, in words, never passing to the next", async () => {
    const kit = await kitWith(accounts({ unreadable: true }));
    const fetch = vi.fn(async () => Response.json({}, { status: 404 }));
    vi.stubGlobal('fetch', onlyProvider({ fetch: fetch as never, sent: [] }).fetch);
    const team = await ask(kit, 'participant');
    expect([team.status, await team.json()]).toEqual([
      409,
      {
        error: 'ask_unavailable',
        message:
          "Your team's AI key could not be read. An admin can replace it in Settings, under AI.",
      },
    ]);
    const own = await ask(kit, 'viewer');
    expect(await own.json()).toMatchObject({
      message: 'Your AI key could not be read. Replace it in Settings, under AI.',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(await uses(kit, 'viewer')).toEqual(expect.objectContaining({ uses: 'personal' }));
  });

  it('falls back to built-in AI when accounts cannot answer', async () => {
    const kit = await kitWith(accounts({ down: true }));
    const res = await ask(kit, 'participant');
    expect((await res.json<{ error: string }>()).error).toBe('built-in-unavailable');
    expect(await uses(kit, 'participant')).toEqual(expect.objectContaining({ uses: 'built-in' }));
  });

  it('uses the shared key for Describe to Set Up too', async () => {
    const door = accounts();
    const kit = await kitWith(door);
    const openai = onlyProvider(
      fakeOpenAi(JSON.stringify({ name: 'Handbook', pages: [{ title: 'Start', summary: 'x' }] })),
    );
    vi.stubGlobal('fetch', openai.fetch);
    await kit.call('editor', 'POST', '/api/documents/kb/setup/suggest', {
      description: 'The engineering handbook for a 12 person logistics startup.',
    });
    expect(openai.sent[0]?.headers.authorization).toBe(`Bearer ${TEAM_KEY}`);
    expect(door.asked[0]).toMatchObject({ token: 'jwt-user_o', teamId: 'team_1', want: 'key' });
  });
});

describe('who may reach a shared key', () => {
  it('is a signed-in person with their bearer only', () => {
    const person = { accountUserId: 'user_a', token: null, workbench: null, bearer: 'jwt-a' };
    expect(askerOf(person, 'team_1')).toEqual({ accessToken: 'jwt-a', teamId: 'team_1' });
    expect(askerOf(person, undefined)).toEqual({ accessToken: 'jwt-a', teamId: null });
    expect(askerOf({ ...person, token: { id: 't' } }, 'team_1')).toBeNull();
    expect(askerOf({ ...person, workbench: {} as never }, 'team_1')).toBeNull();
    expect(askerOf({ ...person, accountUserId: null }, 'team_1')).toBeNull();
    expect(askerOf({ ...person, bearer: null }, 'team_1')).toBeNull();
  });

  it('asks nothing without the client credentials', async () => {
    const door = vi.fn();
    const env = { DOCUMENT_DB: undefined } as never;
    const settings = { hasKey: false, provider: 'anthropic', model: 'm' } as never;
    expect(await whichAi(env, settings, { accessToken: 'jwt', teamId: null }, door)).toEqual({
      uses: 'built-in',
    });
    expect(door).not.toHaveBeenCalled();
    expect(typeof applyingAi).toBe('function');
  });
});
