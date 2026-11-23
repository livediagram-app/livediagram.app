import { answerEvents, errorResponse, fakeFetch, streamResponse } from '@liveworkspace/ai/testing';
import type { KeyAnswer } from '@liveworkspace/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FORM_DRAFT_CAPPED,
  FORM_DRAFT_OFF_TOPIC,
  FORM_DRAFT_PER_DAY,
  FORM_DRAFT_PROMPT_MAX,
  FORM_DRAFT_UNREADABLE,
  questionsOf,
} from '@liveplanner/forms';
import { PLAN_DRAFT_FAILED, PLAN_DRAFT_NOT_SET_UP } from '@liveplanner/items';
import type { FormDraftErrorBody, FormDraftResponse } from '@liveplanner/api-schema';
import { AUTOMATION_AI_MODEL } from '../plan-room/automations/automation-ai';
import { spendPlanDraftIn } from '../plan-draft-count';
import type { AutomationsAi, Env } from '../types';
import { handleFormDrafts } from './form-drafts';
import { handlePlanDrafts } from './plan-drafts';
import { DRAFT_ASKS_MAX } from './draft-asks';
import { makeTestRouteContext } from './test-route-context';

// Describe a Form (docs/specs/030-forms/describe-a-form.md), Workers AI a stand-in binding and PLAN_ROOM a stand-in of
// rooms by name: who may ask, what the model is sent, the second ask, the cap shared with Describe a Plan, and that
// nothing but the count is written or logged. No network.
// Whose key applies (ai-keys.md "Every AI feature honours the choice"): built-in AI unless a test says otherwise.
const keyFor = vi.hoisted(() => vi.fn(async (): Promise<unknown> => null));
vi.mock('@liveworkspace/auth-client/ai-key', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/auth-client/ai-key')>()),
  personAiKey: keyFor,
}));
const KEY = 'sk-ant-api03-planted-secret-key-7q7q';
const onKey = (answer: KeyAnswer, respond: () => Response) => {
  keyFor.mockResolvedValue(answer);
  const faked = fakeFetch(respond);
  vi.stubGlobal('fetch', faked.fetch);
  return faked.sent;
};
const MINE: KeyAnswer = {
  status: 'key',
  source: 'account',
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  key: KEY,
};

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

const FORM = {
  outcome: 'form',
  form: {
    heading: 'Summer Party RSVP',
    respondsTo: 'sheet',
    sections: [
      {
        questions: [
          { type: 'short', prompt: 'Your name', required: true },
          { type: 'multi', prompt: 'Dietary needs', options: ['Vegetarian', 'Vegan'] },
          { type: 'number', prompt: 'Guests', min: 0, max: 4, whole: true },
        ],
      },
    ],
  },
};
const PLAN = {
  outcome: 'plan',
  plan: {
    title: 'Hiring',
    columns: ['Applied', 'Offer'],
    cardTypes: [{ name: 'Candidate', fields: [] }],
  },
};
const PROMPT = 'An event RSVP with dietary needs and plus-ones';

let stores: Map<string, Map<string, unknown>>;
let env: Env;
let waits: Promise<unknown>[];
let logs: unknown[][];
beforeEach(() => {
  keyFor.mockReset();
  keyFor.mockResolvedValue(null);
  vi.unstubAllGlobals();
  calls = [];
  replies = [FORM];
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
        get: async (k: string) => map.get(k),
        put: async (k: string, v: unknown) => void map.set(k, v),
      } as unknown as DurableObjectStorage;
      return { spendPlanDraft: (day: string, cap: number) => spendPlanDraftIn(storage, day, cap) };
    },
  };
  env = { AI: { run }, PLAN_ROOM: ns } as unknown as Env;
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Who = 'account' | 'guest' | 'nobody';
const call = async (
  handler: typeof handleFormDrafts,
  path: string,
  body: unknown,
  who: Who = 'account',
) => {
  const identity =
    who === 'account'
      ? { owner: 'user_a', accountUserId: 'user_a' }
      : who === 'guest'
        ? { owner: 'guest_1' }
        : {};
  const res = await handler(
    makeTestRouteContext('POST', path, {
      ...identity,
      body,
      env,
      waitUntil: (p) => void waits.push(p),
    }),
  );
  await Promise.all(waits);
  return res;
};
const draft = (body: unknown = { prompt: PROMPT }, who: Who = 'account') =>
  call(handleFormDrafts, '/api/form-drafts', body, who);
const error = (res: Response) => res.json<FormDraftErrorBody>();

describe('who may draft', () => {
  it('refuses a guest (403) and asks someone with no identity to sign in (401), asking and counting nothing', async () => {
    const guest = await draft(undefined, 'guest');
    expect(guest.status).toBe(403);
    expect((await error(guest)).error).toBe('form_draft_needs_account');
    expect((await draft(undefined, 'nobody')).status).toBe(401);
    expect(calls).toEqual([]);
    expect(stores.size).toBe(0);
  });

  it('answers only POST /api/form-drafts', async () => {
    const get = await handleFormDrafts(
      makeTestRouteContext('GET', '/api/form-drafts', { accountUserId: 'user_a', env }),
    );
    expect(get.status).toBe(405);
    const deeper = await handleFormDrafts(
      makeTestRouteContext('POST', '/api/form-drafts/x', { accountUserId: 'user_a', env }),
    );
    expect(deeper.status).toBe(404);
  });
});

describe('a draft', () => {
  it('answers the form, from the request alone sent as data, logging only its size', async () => {
    const res = await draft();
    expect(res.status).toBe(200);
    const { draft: d } = await res.json<FormDraftResponse>();
    expect(d.respondsTo).toBe('sheet');
    expect(questionsOf(d.form).map((q) => q.type)).toEqual(['short', 'multi', 'number']);
    expect(calls[0]!.model).toBe(AUTOMATION_AI_MODEL);
    expect(JSON.parse(messages()[1]!.content)).toEqual({ request: PROMPT });
    expect(events).toEqual(['Form·Ran·FormAiDraft']);
    expect(logs).toContainEqual([
      '[form-draft] draft',
      expect.objectContaining({ answer: 'drafted', asks: 1, sections: 1, questions: 3 }),
    ]);
    const logged = JSON.stringify(logs);
    expect(logged).not.toContain('RSVP');
    expect(logged).not.toContain('Dietary');
  });

  it('refuses an empty or over-long request before asking or counting', async () => {
    for (const body of [{ prompt: ' ' }, { prompt: 'x'.repeat(FORM_DRAFT_PROMPT_MAX + 1) }, {}]) {
      const res = await draft(body);
      expect(res.status).toBe(400);
      expect(await error(res)).toMatchObject({ error: 'form_draft_invalid', path: 'prompt' });
    }
    expect(calls).toEqual([]);
    expect(stores.size).toBe(0);
  });

  it('answers off topic in fixed words', async () => {
    replies = [{ outcome: 'not_a_form' }];
    const res = await draft({ prompt: 'Tell me a joke' });
    expect(res.status).toBe(422);
    expect(await error(res)).toEqual({
      error: 'form_draft_off_topic',
      message: FORM_DRAFT_OFF_TOPIC,
    });
    expect(events).toEqual(['Form·Ran·FormAiDraft', 'Form·Ran·FormAiOffTopic']);
  });

  it('asks once more with the check’s words, then answers the second', async () => {
    const bad = {
      outcome: 'form',
      form: { heading: 'F', sections: [{ questions: [{ type: 'signature', prompt: 'Sign' }] }] },
    };
    replies = [bad, FORM];
    const res = await draft();
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
    const second = JSON.parse(messages(1)[1]!.content) as { previous: { refused: string } };
    expect(second.previous.refused).toMatch(/^sections\.0\.questions\.0\.type: must be one of/);
    expect([...stores.get('~plan-drafts:user_a')!.values()]).toEqual([
      { day: expect.any(String), count: 1 },
    ]);
  });

  it('says it couldn’t draft after two replies that don’t read, logging the place, never the words', async () => {
    replies = ['not json', { outcome: 'form', form: { heading: 'F', sections: [] } }];
    const res = await draft();
    expect(res.status).toBe(422);
    expect(await error(res)).toEqual({
      error: 'form_draft_unreadable',
      message: FORM_DRAFT_UNREADABLE,
    });
    expect(calls).toHaveLength(DRAFT_ASKS_MAX);
    expect(logs).toContainEqual([
      '[form-draft] draft',
      expect.objectContaining({ answer: 'unreadable', asks: 2, refused: 'sections' }),
    ]);
  });

  it('answers a model that errs in fixed words, never its own', async () => {
    replies = [new Error('model exploded with secret words')];
    const res = await draft();
    expect(res.status).toBe(503);
    expect(await error(res)).toEqual({
      error: 'form_draft_unavailable',
      message: PLAN_DRAFT_FAILED,
    });
  });

  it('says AI isn’t set up with no binding, counting nothing', async () => {
    env = { ...env, AI: undefined };
    const res = await draft();
    expect(res.status).toBe(503);
    expect(await error(res)).toEqual({
      error: 'form_draft_unavailable',
      message: PLAN_DRAFT_NOT_SET_UP,
    });
    expect(stores.size).toBe(0);
  });
});

describe('the shared budget', () => {
  it(`drafts ${FORM_DRAFT_PER_DAY} plans and forms together an account a day, then refuses before asking`, async () => {
    replies = [PLAN];
    for (let i = 0; i < FORM_DRAFT_PER_DAY / 2; i++)
      expect((await call(handlePlanDrafts, '/api/plan-drafts', { prompt: 'hiring' })).status).toBe(
        200,
      );
    replies = [FORM];
    for (let i = 0; i < FORM_DRAFT_PER_DAY / 2; i++) expect((await draft()).status).toBe(200);
    calls = [];
    const res = await draft();
    expect(res.status).toBe(429);
    expect(await error(res)).toEqual({ error: 'form_draft_capped', message: FORM_DRAFT_CAPPED });
    expect(calls).toEqual([]);
    const plan = await call(handlePlanDrafts, '/api/plan-drafts', { prompt: 'hiring' });
    expect(plan.status).toBe(429);
  });

  it('refuses when the count can’t be read, asking nothing', async () => {
    env = { ...env, PLAN_ROOM: undefined } as unknown as Env;
    const res = await draft();
    expect(res.status).toBe(503);
    expect(await error(res)).toEqual({
      error: 'form_draft_unavailable',
      message: PLAN_DRAFT_FAILED,
    });
    expect(calls).toEqual([]);
  });
});

describe('on the person’s own key', () => {
  it('drafts on the provider, asking for the person’s key alone and spending no draft', async () => {
    const sent = onKey(MINE, () => streamResponse(answerEvents([JSON.stringify(FORM)])));
    const res = await draft();
    expect(res.status).toBe(200);
    expect((await res.json<FormDraftResponse>()).draft).toBeTruthy();
    expect(keyFor).toHaveBeenCalledWith(null, expect.anything(), null);
    expect(calls).toEqual([]);
    expect(stores.size).toBe(0);
    expect(sent[0]!.headers['x-api-key']).toBe(KEY);
  });

  it('says a key the provider refuses, whose it is, never drafting on built-in AI instead', async () => {
    onKey(MINE, () => errorResponse(401, 'authentication_error'));
    const res = await draft();
    expect(res.status).toBe(422);
    const body = await res.json<Record<string, unknown>>();
    expect(body['error']).toBe('ai_key_failed');
    expect(body['aiKey']).toEqual({ source: 'account', provider: 'anthropic', kind: 'bad-key' });
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(calls).toEqual([]);
  });

  it('says the provider’s busy words, a key that will not open, and accounts that could not say', async () => {
    onKey(MINE, () => errorResponse(529, 'overloaded_error'));
    const busy = await draft();
    expect(busy.status).toBe(503);
    expect((await error(busy)).error).toBe('form_draft_unavailable');
    keyFor.mockResolvedValue({ status: 'unreadable', source: 'account' });
    expect((await draft()).status).toBe(422);
    keyFor.mockResolvedValue({ status: 'unavailable' });
    const away = await draft();
    expect(away.status).toBe(503);
    expect((await error(away)).error).toBe('form_draft_unavailable');
    expect(calls).toEqual([]);
    expect(stores.size).toBe(0);
  });
});
