import { answerEvents, errorResponse, fakeFetch, streamResponse } from '@liveworkspace/ai/testing';
import type { KeyAnswer } from '@liveworkspace/ai';
import { ASK_BUILT_IN_PER_PERSON_PER_DAY } from '@liveworkspace/ask';
import { askCountName, spendAskIn } from '@liveworkspace/ask/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAN_AI_BUILT_IN_MAX_TOKENS,
  PLAN_AI_INSTRUCTION_MAX,
  PLAN_AI_WORDS,
} from '@liveplanner/items';
import type { PlanAiResponse } from '@liveplanner/api-schema';
import type { PlanGrant } from '../index-service';
import type { AutomationsAi, Env } from '../types';
import { handlePlanAi } from './plan-ai';
import { makeTestRouteContext } from './test-route-context';

// Plan AI (docs/specs/026-plan/plan-ai.md), Workers AI a stand-in binding and PLAN_ROOM a stand-in of rooms by name:
// who may ask, what the model is sent, the role the changes are read for, Ask's count, the second ask, and that
// nothing of the instruction, the tab or the reply is logged. No network.
const keyFor = vi.hoisted(() => vi.fn(async (..._args: unknown[]): Promise<unknown> => null));
vi.mock('@liveworkspace/auth-client/ai-key', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/auth-client/ai-key')>()),
  personAiKey: keyFor,
}));
// The index's grant on the plan, as the test sets it (resolvePlanGrant reads the index; here, this).
const grantNow = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./plan-grant', () => ({
  resolvePlanGrant: vi.fn(async () => grantNow.value),
}));
// With Pro on, Ask's credits (a test sets what chargeAsk answers); off (null door) by default.
const pro = vi.hoisted(() => ({ on: false, refusal: null as unknown }));
vi.mock('@liveworkspace/ask/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/ask/server')>()),
  askCreditsOf: (opts: { grant: (id: string) => unknown }) =>
    pro.on ? { grant: opts.grant, payer: opts.grant('p1') } : null,
  chargeAsk: async () => pro.refusal,
}));
const events: string[] = [];
vi.mock('../server-telemetry', () => ({
  reportServerEvent: async (_env: unknown, category: string, action: string, type: string) =>
    void events.push(`${category}·${action}·${type}`),
}));

type Call = { model: string; inputs: Record<string, unknown> };
let calls: Call[];
let replies: unknown[];
const run: AutomationsAi['run'] = (model, inputs) => {
  calls.push({ model, inputs });
  const next = replies.length > 1 ? replies.shift() : replies[0];
  return next instanceof Error ? Promise.reject(next) : Promise.resolve({ response: next });
};
const messages = (i = 0) => calls[i]!.inputs['messages'] as { role: string; content: string }[];

const MOVE = {
  reply: 'Moved #1 to Done.',
  changes: [
    { op: 'move', item: '#1', status: 'Done' },
    { op: 'delete', item: '#2' },
  ],
};
const BODY = {
  projectId: 'p1',
  kind: 'board',
  tabName: 'Sprint',
  tab: 'Columns: To Do, Done\n#1 Fix login (To Do)\n#2 Old (To Do)',
  instruction: 'Move #1 to Done and bin #2',
  teamId: 'team_1',
};
const grantOf = (level: 'edit' | 'participate' | 'view', trashed = false): PlanGrant => ({
  item: 'p1',
  level,
  tab: null,
  sub: 'user_a',
  team: null,
  exp: 9_999_999_999,
  shareCode: null,
  token: 'signed',
  ...(trashed ? { trashed: true } : {}),
});

let stores: Map<string, Map<string, unknown>>;
let env: Env;
let waits: Promise<unknown>[];
let logs: unknown[][];
beforeEach(() => {
  keyFor.mockReset();
  keyFor.mockResolvedValue(null);
  pro.on = false;
  pro.refusal = null;
  vi.unstubAllGlobals();
  calls = [];
  replies = [MOVE];
  events.length = 0;
  waits = [];
  logs = [];
  vi.spyOn(console, 'info').mockImplementation((...args) => void logs.push(args));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  stores = new Map();
  const ns = {
    idFromName: (name: string) => name,
    get: (name: string) => {
      const map = stores.get(name) ?? new Map<string, unknown>();
      stores.set(name, map);
      const storage = {
        get: async <T>(k: string) => map.get(k) as T | undefined,
        put: async <T>(k: string, v: T) => void map.set(k, v),
      };
      return { spendAsk: (day: string, cap: number) => spendAskIn(storage, day, cap) };
    },
  };
  env = { AI: { run }, PLAN_ROOM: ns } as unknown as Env;
});
afterEach(() => vi.restoreAllMocks());

type Who = 'account' | 'guest' | 'nobody';
const ask = async (
  body: unknown = BODY,
  opts: { who?: Who; grant?: PlanGrant | null; rawBody?: string } = {},
) => {
  const who = opts.who ?? 'account';
  grantNow.value = opts.grant === undefined ? grantOf('edit') : opts.grant;
  const identity =
    who === 'account'
      ? { owner: 'user_a', accountUserId: 'user_a' }
      : who === 'guest'
        ? { owner: 'guest_1' }
        : {};
  const res = await handlePlanAi(
    makeTestRouteContext('POST', '/api/plan-ai', {
      ...identity,
      ...(opts.rawBody !== undefined ? { rawBody: opts.rawBody } : { body }),
      env,
      waitUntil: (p) => void waits.push(p),
    }),
  );
  await Promise.all(waits);
  return res;
};
const error = (res: Response) => res.json<{ error: string; message: string }>();

describe('who may ask', () => {
  it('refuses a guest (403) and asks someone with no identity to sign in (401), asking nothing', async () => {
    const guest = await ask(BODY, { who: 'guest' });
    expect(guest.status).toBe(403);
    expect(await error(guest)).toEqual({
      error: 'plan_ai_needs_account',
      message: PLAN_AI_WORDS.needsAccount,
    });
    expect((await ask(BODY, { who: 'nobody' })).status).toBe(401);
    expect(calls).toEqual([]);
    expect(stores.size).toBe(0);
  });

  it('refuses someone with no access to the plan, or one in the Trash', async () => {
    for (const grant of [null, grantOf('edit', true)]) {
      const res = await ask(BODY, { grant });
      expect(res.status).toBe(403);
      expect((await error(res)).error).toBe('plan_ai_no_access');
    }
    expect(calls).toEqual([]);
  });

  it('answers only POST /api/plan-ai', async () => {
    const get = await handlePlanAi(
      makeTestRouteContext('GET', '/api/plan-ai', { accountUserId: 'user_a', env }),
    );
    expect(get.status).toBe(405);
    const deeper = await handlePlanAi(
      makeTestRouteContext('POST', '/api/plan-ai/x', { accountUserId: 'user_a', env }),
    );
    expect(deeper.status).toBe(404);
  });
});

describe('a turn', () => {
  it('answers an Editor the words and every change, sending the tab as data, logging only counts', async () => {
    const res = await ask();
    expect(res.status).toBe(200);
    expect(await res.json<PlanAiResponse>()).toEqual({
      reply: 'Moved #1 to Done.',
      changes: MOVE.changes,
      dropped: 0,
      provider: 'built-in',
      role: 'edit',
    });
    // Built-in AI writes a shorter reply, so its longest turn ends inside its 20 seconds.
    expect(calls[0]!.inputs['max_tokens']).toBe(PLAN_AI_BUILT_IN_MAX_TOKENS);
    expect(messages()[0]!.content).toContain('at most 15 rows');
    expect(JSON.parse(messages()[1]!.content)).toEqual({
      tabName: 'Sprint',
      kind: 'board',
      tab: BODY.tab,
      instruction: BODY.instruction,
    });
    expect(events).toEqual(['Plan·Ran·PlanAi']);
    expect(logs).toContainEqual([
      '[plan-ai] asked',
      expect.objectContaining({ answer: 'answered', kind: 'board', role: 'edit', changes: 2 }),
    ]);
    const logged = JSON.stringify(logs);
    expect(logged).not.toContain('Fix login');
    expect(logged).not.toContain('bin #2');
    // Ask's day, in the account's own instance.
    expect([...stores.get(askCountName('user_a'))!.values()]).toHaveLength(1);
    expect(keyFor.mock.calls[0]![2]).toBe('team_1');
  });

  it('reads a Participant’s changes as theirs (no delete) and a Viewer’s as none', async () => {
    const participant = await ask(BODY, { grant: grantOf('participate') });
    expect(await participant.json<PlanAiResponse>()).toMatchObject({
      changes: [{ op: 'move' }],
      dropped: 1,
      role: 'participate',
    });
    const viewer = await ask(BODY, { grant: grantOf('view') });
    expect(await viewer.json<PlanAiResponse>()).toMatchObject({
      changes: [],
      dropped: 2,
      role: 'view',
    });
    expect(messages(1)[0]!.content).toContain('never answer changes');
  });

  it('sends the last turns back', async () => {
    const turns = [{ instruction: 'Add a card', reply: 'Added #3.' }, { bad: true }];
    await ask({ ...BODY, turns });
    expect((JSON.parse(messages()[1]!.content) as { turns: unknown }).turns).toEqual([
      { instruction: 'Add a card', reply: 'Added #3.' },
    ]);
  });

  it('refuses a request that doesn’t read before asking or counting', async () => {
    const bodies: unknown[] = [
      { ...BODY, instruction: ' ' },
      { ...BODY, instruction: 'x'.repeat(PLAN_AI_INSTRUCTION_MAX + 1) },
      { ...BODY, kind: 'canvas' },
      { ...BODY, projectId: '' },
      { ...BODY, tab: 4 },
      { ...BODY, tabName: 'x'.repeat(500) },
      [1],
    ];
    for (const body of bodies) {
      const res = await ask(body);
      expect(res.status).toBe(400);
      expect((await error(res)).error).toBe('plan_ai_invalid');
    }
    const raw = await ask(undefined, { rawBody: '{not json' });
    expect(raw.status).toBe(400);
    expect(calls).toEqual([]);
    expect(stores.size).toBe(0);
  });

  it('asks once more with the check’s words, then answers the second', async () => {
    replies = [{ reply: 'x', changes: [{ op: 'add_row' }] }, MOVE];
    const res = await ask();
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(
      (JSON.parse(messages(1)[1]!.content) as { previous: { refused: string } }).previous.refused,
    ).toMatch(/^changes\.0\.op:/);
  });

  it('says the answer couldn’t be read after two that don’t', async () => {
    replies = ['not json', { reply: 4 }];
    const res = await ask();
    expect(res.status).toBe(422);
    expect(await error(res)).toEqual({
      error: 'plan_ai_unreadable',
      message: PLAN_AI_WORDS.unreadable,
    });
  });

  it('answers a model that errs in fixed words, never its own', async () => {
    replies = [new Error('model exploded with secret words')];
    const res = await ask();
    expect(res.status).toBe(503);
    expect(await error(res)).toEqual({
      error: 'plan_ai_unavailable',
      message: PLAN_AI_WORDS.failed,
    });
  });

  it('says AI isn’t set up with no binding, counting nothing', async () => {
    env = { ...env, AI: undefined };
    const res = await ask();
    expect(res.status).toBe(503);
    expect(await error(res)).toEqual({
      error: 'plan_ai_unavailable',
      message: PLAN_AI_WORDS.notSetUp,
    });
    expect(stores.size).toBe(0);
  });

  it('refuses when Ask’s day can’t be counted, asking nothing', async () => {
    env = { ...env, PLAN_ROOM: undefined } as unknown as Env;
    const res = await ask();
    expect(res.status).toBe(503);
    expect((await error(res)).error).toBe('plan_ai_unavailable');
    expect(calls).toEqual([]);
  });

  it('with Pro on, spends Ask’s credit and says a refusal in its own words', async () => {
    pro.on = true;
    expect((await ask()).status).toBe(200);
    const refusals: [unknown, string][] = [
      [
        {
          status: 429,
          error: 'ai_credits_used',
          message: 'used',
          more: { limit: 'aiCreditsPerMonth' },
        },
        'ai_credits_used',
      ],
      [{ status: 429, error: 'ask_by_others_limit', message: 'others' }, 'ask_by_others_limit'],
      [{ status: 503, error: 'ask_unavailable', message: 'unchecked' }, 'plan_ai_unavailable'],
    ];
    for (const [refusal, code] of refusals) {
      pro.refusal = refusal;
      const res = await ask();
      expect((await error(res)).error).toBe(code);
    }
    expect(calls).toHaveLength(1);
  });

  it('stops at Ask’s day of built-in questions', async () => {
    for (let i = 0; i < ASK_BUILT_IN_PER_PERSON_PER_DAY; i++) await ask();
    const res = await ask();
    expect(res.status).toBe(429);
    expect((await error(res)).error).toBe('ask_built_in_limit');
  });
});

describe('on a key', () => {
  const KEY = 'sk-ant-api03-planted-secret-key-7q7q';
  const MINE: KeyAnswer = {
    status: 'key',
    source: 'account',
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    key: KEY,
  };

  it('answers on the person’s key, counting nothing and asking no binding', async () => {
    keyFor.mockResolvedValue(MINE);
    const faked = fakeFetch(() => streamResponse(answerEvents([JSON.stringify(MOVE)])));
    vi.stubGlobal('fetch', faked.fetch);
    const res = await ask();
    expect(res.status).toBe(200);
    expect(await res.json<PlanAiResponse>()).toMatchObject({ provider: 'anthropic' });
    expect(calls).toEqual([]);
    expect(stores.size).toBe(0);
  });

  it('runs on built-in AI when the person picked it, though a key applies', async () => {
    keyFor.mockResolvedValue(MINE);
    const res = await ask({ ...BODY, ai: 'built-in' });
    expect(await res.json<PlanAiResponse>()).toMatchObject({ provider: 'built-in' });
    expect(keyFor).not.toHaveBeenCalled();
  });

  it('says a key the provider refuses as a key failure, never on built-in AI', async () => {
    keyFor.mockResolvedValue(MINE);
    const faked = fakeFetch(() => errorResponse(401, 'authentication_error'));
    vi.stubGlobal('fetch', faked.fetch);
    const res = await ask();
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: 'ai_key_failed',
      aiKey: { source: 'account', provider: 'anthropic', kind: 'bad-key' },
    });
    expect(calls).toEqual([]);
  });

  it('refuses a key that will not open in words', async () => {
    keyFor.mockResolvedValue({ status: 'unreadable', source: 'account' });
    const res = await ask();
    expect(res.status).toBe(422);
    expect((await error(res)).error).toBe('ai_key_failed');
  });
});
