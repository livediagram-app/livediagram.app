import { afterEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import {
  ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY,
  ASK_BUILT_IN_PER_PERSON_PER_DAY,
  CONFLICT_BUILT_IN_CHECKS_PER_DAY,
} from '@liveknowledge/knowledge';
import { BUILT_IN_MODEL } from '@liveworkspace/ai';
import { oweConflictChecks, runConflictCheck } from '../knowledge/conflict-check';
import { fakeClaude, knowledgeKit, page, type Kit, type Who } from './knowledge-test-kit';

// Built-in AI for Ask and the conflict check (docs/specs/030-knowledgebase/search-and-ask.md "Built-in AI"):
// Workers AI through the `AI` binding, faked here as it streams.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SECRET = 'test-ai-key-secret';
const KEY = 'sk-ant-test-0123456789abcdefghij-4f2a';

/** An event stream of `{ response }` pieces, then `[DONE]`, as the binding answers `stream: true`. */
function stream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of text.match(/[\s\S]{1,7}/g) ?? [])
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: piece })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

/** A fake `AI` binding answering every ask with `reply` (or what it returns), recording what it was handed. */
function fakeAi(reply: string | (() => Promise<unknown>)) {
  const sent: { model: string; input: { stream?: boolean; messages: { content: string }[] } }[] =
    [];
  return {
    sent,
    run: async (model: string, input: object) => {
      sent.push({ model, input: input as (typeof sent)[number]['input'] });
      return typeof reply === 'string' ? stream(reply) : reply();
    },
  };
}

type Event = { type: string; text?: string } & Record<string, unknown>;
async function events(res: Response): Promise<Event[]> {
  return (await res.text())
    .split('\n\n')
    .filter(Boolean)
    .map((block) => JSON.parse(block.slice(block.indexOf('data: ') + 6)) as Event);
}

const ask = (kit: Kit, who: Who = 'viewer', question = 'When do we deploy?') =>
  kit.call(who, 'POST', '/api/documents/kb/ask', { question });
const failure = async (res: Response) => [res.status, (await res.json<{ error: string }>()).error];
const counters = (kit: Kit) =>
  kit.db.sql.prepare('SELECT scope, used FROM usage_counters ORDER BY scope').all();
const today = () => new Date().toISOString().slice(0, 10);
const accountCount = (kit: Kit, account: string) => {
  const ns = kit.db.env.DOCUMENT_ROOM;
  return ns.get(ns.idFromName(`~ask-built-in:${account}`)) as unknown as {
    spendSetupDraft(day: string, cap: number): Promise<boolean>;
  };
};

// The last passage a request was sent with: what the fake model cites, so the one source is not passage 1 as sent.
const lastPassage = (input: { messages: { content: string }[] }) =>
  Math.max(
    ...[...input.messages.at(-1)!.content.matchAll(/<passage number="(\d+)"/g)].map((m) =>
      Number(m[1]),
    ),
  );

describe('POST ask on built-in AI', () => {
  it('streams an answer with no key at all, its one source numbered 1, counted for the person and the room', async () => {
    const claude = fakeClaude('unused');
    vi.stubGlobal('fetch', claude.fetch);
    const ai = fakeAi('');
    ai.run = async (model, input) => {
      const asked = input as (typeof ai.sent)[number]['input'];
      ai.sent.push({ model, input: asked });
      // The owner's case: one source, sent as passage 2 or later, cited with a number never sent beside it.
      const last = lastPassage(asked);
      expect(last).toBeGreaterThan(1);
      return stream(`<answer>Deploys go out on Tuesdays [${last}] [${last + 40}].</answer>`);
    };
    const kit = await knowledgeKit({ AI: ai });
    const res = await ask(kit);
    expect(res.status).toBe(200);
    const all = await events(res);
    const done = all.at(-1)!;
    expect(
      all
        .slice(0, -1)
        .map((e) => e.text)
        .join(''),
    ).toBe('Deploys go out on Tuesdays [1].');
    expect(done).toMatchObject({
      type: 'done',
      text: 'Deploys go out on Tuesdays [1].',
      provider: 'built-in',
      model: BUILT_IN_MODEL,
    });
    expect(done.sources).toEqual([expect.objectContaining({ number: 1, tab: 'rollbacks' })]);
    expect(ai.sent).toHaveLength(1);
    expect(ai.sent[0]!.model).toBe(BUILT_IN_MODEL);
    expect(ai.sent[0]!.input.stream).toBe(true);
    expect(claude.sent).toEqual([]);
    expect(counters(kit)).toEqual([
      { scope: 'ask:built-in', used: 1 },
      { scope: 'ask:knowledgebase', used: 1 },
      { scope: 'ask:person:user_v', used: 1 },
    ]);
    // Counted for the account, wherever it asks: 29 more today.
    for (let i = 1; i < ASK_BUILT_IN_PER_PERSON_PER_DAY; i++)
      expect(await accountCount(kit, 'user_v').spendSetupDraft(today(), 30)).toBe(true);
    expect(await accountCount(kit, 'user_v').spendSetupDraft(today(), 30)).toBe(false);
  });

  it('says so in its own words when the binding fails, never the binding’s', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ai = fakeAi(() => Promise.reject(new Error('upstream said private things')));
    const kit = await knowledgeKit({ AI: ai });
    const text = await (await ask(kit)).text();
    expect(text).toContain('"provider":"built-in"');
    expect(text).toContain("The built-in AI couldn't answer just now. Try again in a moment.");
    expect(text).not.toContain('private');
  });

  it('runs on the team key instead once one is set, and never asks built-in AI', async () => {
    const claude = fakeClaude('<answer>Tuesdays [1].</answer>');
    vi.stubGlobal('fetch', claude.fetch);
    const ai = fakeAi('<answer>Built in [1].</answer>');
    const kit = await knowledgeKit({ AI: ai, AI_KEY_SECRET: SECRET });
    await kit.call('editor', 'PUT', '/api/documents/kb/ai/key', { key: KEY });
    expect((await events(await ask(kit))).at(-1)).toMatchObject({ provider: 'anthropic' });
    expect(ai.sent).toEqual([]);
    expect(claude.sent).toHaveLength(1);
    // A stored key that no longer opens is refused, never swapped for built-in AI.
    (kit.db.env as { AI_KEY_SECRET?: string }).AI_KEY_SECRET = 'another-secret';
    expect(await failure(await ask(kit))).toEqual([409, 'ask_unavailable']);
    expect(ai.sent).toEqual([]);
  });

  it('answers on built-in AI when the person chooses it with a key set, under built-in caps; the key when chosen', async () => {
    const claude = fakeClaude('<answer>Tuesdays [1].</answer>');
    vi.stubGlobal('fetch', claude.fetch);
    const ai = fakeAi('<answer>Built in [1].</answer>');
    const kit = await knowledgeKit({ AI: ai, AI_KEY_SECRET: SECRET });
    await kit.call('editor', 'PUT', '/api/documents/kb/ai/key', { key: KEY });
    const asked = (choice: 'built-in' | 'key') =>
      kit.call('viewer', 'POST', '/api/documents/kb/ask', {
        question: 'When do we deploy?',
        ai: choice,
      });
    expect((await events(await asked('built-in'))).at(-1)).toMatchObject({
      provider: 'built-in',
      model: BUILT_IN_MODEL,
    });
    expect(ai.sent).toHaveLength(1);
    expect(claude.sent).toEqual([]);
    expect(counters(kit)).toEqual([
      { scope: 'ask:built-in', used: 1 },
      { scope: 'ask:knowledgebase', used: 1 },
      { scope: 'ask:person:user_v', used: 1 },
    ]);
    expect((await events(await asked('key'))).at(-1)).toMatchObject({ provider: 'anthropic' });
    expect(claude.sent).toHaveLength(1);
    expect(ai.sent).toHaveLength(1);
    // The built-in day is not spent by a question on the key.
    expect(counters(kit)).toContainEqual({ scope: 'ask:built-in', used: 1 });
    // At built-in AI's cap, choosing it is refused in its own words; the key still answers.
    kit.db.sql
      .prepare("UPDATE usage_counters SET used = ? WHERE scope = 'ask:built-in'")
      .run(ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY);
    expect(await failure(await asked('built-in'))).toEqual([429, 'built-in-knowledgebase-limit']);
    expect((await events(await asked('key'))).at(-1)).toMatchObject({ provider: 'anthropic' });
    // A key that no longer opens: built-in AI, chosen, still answers; the key is refused.
    kit.db.sql.prepare("UPDATE usage_counters SET used = 0 WHERE scope = 'ask:built-in'").run();
    (kit.db.env as { AI_KEY_SECRET?: string }).AI_KEY_SECRET = 'another-secret';
    expect(await failure(await asked('key'))).toEqual([409, 'ask_unavailable']);
    expect((await events(await asked('built-in'))).at(-1)).toMatchObject({ provider: 'built-in' });
  });

  it('answers on built-in AI when the key is chosen and none is set', async () => {
    const ai = fakeAi('<answer>Built in [1].</answer>');
    const kit = await knowledgeKit({ AI: ai });
    const res = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy?',
      ai: 'key',
    });
    expect((await events(res)).at(-1)).toMatchObject({ provider: 'built-in' });
    expect(ai.sent).toHaveLength(1);
  });

  it(`answers ${ASK_BUILT_IN_PER_PERSON_PER_DAY} a person and ${ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY} a knowledgebase a day`, async () => {
    const ai = fakeAi('<answer>Tuesdays [1].</answer>');
    const kit = await knowledgeKit({ AI: ai });
    for (let i = 0; i < ASK_BUILT_IN_PER_PERSON_PER_DAY; i++)
      await accountCount(kit, 'user_p').spendSetupDraft(today(), 99);
    const refused = await ask(kit, 'participant');
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({
      error: 'built-in-limit',
      message:
        "You have used today's 30 built-in questions. Try again tomorrow, or add your team's AI key in AI Settings.",
    });
    expect(ai.sent).toEqual([]);
    expect(counters(kit)).toEqual([]);
    kit.db.sql
      .prepare('INSERT INTO usage_counters (scope, period, used) VALUES (?, ?, ?)')
      .run('ask:built-in', today(), ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY);
    expect(await failure(await ask(kit, 'viewer'))).toEqual([429, 'built-in-knowledgebase-limit']);
    expect(ai.sent).toEqual([]);
  });

  it('refuses rather than lifting the cap when the count cannot be reached, and says when there is no built-in AI', async () => {
    const ai = fakeAi('<answer>x</answer>');
    const kit = await knowledgeKit({ AI: ai });
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
    expect(await failure(await ask(kit))).toEqual([503, 'built-in-failed']);
    expect(ai.sent).toEqual([]);
    const none = await knowledgeKit();
    expect(await failure(await ask(none))).toEqual([503, 'built-in-unavailable']);
  });

  it('tells the AI settings and AI Knowledge that built-in AI answers here', async () => {
    const kit = await knowledgeKit({ AI: fakeAi('x') });
    expect(await (await kit.call('viewer', 'GET', '/api/documents/kb/ai')).json()).toMatchObject({
      hasKey: false,
      builtIn: true,
    });
    expect(
      await (await kit.call('viewer', 'GET', '/api/documents/kb/knowledge')).json(),
    ).toMatchObject({ hasKey: false, hasAi: true });
  });
});

describe('the conflict check on built-in AI', () => {
  it(`checks with no key, at most ${CONFLICT_BUILT_IN_CHECKS_PER_DAY} a day`, async () => {
    const ai = fakeAi('<pair number="1" verdict="conflict">When do deploys go out?</pair>');
    const kit = await knowledgeKit({ AI: ai });
    await kit.call(
      'editor',
      'PUT',
      '/api/documents/kb/tabs/releases',
      page('releases', 'Releases', [
        {
          id: 'b1',
          type: 'paragraph',
          runs: [
            { text: 'Deploys go out on Fridays after the morning standup, never on a Tuesday.' },
          ],
        },
      ]),
    );
    oweConflictChecks(nodeItemSql(kit.db.sql), [{ tab: 'releases', before: [] }], 1_000);
    const now = Date.now();
    const work = { kind: 'conflict' as const, key: 'releases', dueAt: now, payload: '[]' };
    expect(await runConflictCheck(kit.db.env, 'kb', work, now)).toBeNull();
    expect(ai.sent).toHaveLength(1);
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM conflicts').get()).toEqual({ n: 1 });
    kit.db.sql.exec('DELETE FROM conflict_checks');
    kit.db.sql
      .prepare("UPDATE usage_counters SET used = ? WHERE scope = 'conflicts:check'")
      .run(CONFLICT_BUILT_IN_CHECKS_PER_DAY);
    expect(await runConflictCheck(kit.db.env, 'kb', work, now + 700_000)).toBeNull();
    expect(ai.sent).toHaveLength(1);
    // With no built-in AI and no key, nothing checks.
    const none = await knowledgeKit();
    expect(await runConflictCheck(none.db.env, 'kb', work, now)).toBeNull();
  });
});
