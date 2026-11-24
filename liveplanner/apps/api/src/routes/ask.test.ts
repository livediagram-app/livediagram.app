import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_BUILT_IN_PER_PERSON_PER_DAY, type AskEvent } from '@liveworkspace/ask';
import { askCountName, spendAskIn } from '@liveworkspace/ask/server';
import { fakeSubscription } from '@liveworkspace/subscription/testing';
import type { Env } from '../types';
import { handleAsk } from './ask';
import { makeTestRouteContext } from './test-route-context';

// Whose key applies (ai-keys.md "Every AI feature honours the choice"): built-in AI unless a test says otherwise.
const keyFor = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null));
vi.mock('@liveworkspace/auth-client/ai-key', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/auth-client/ai-key')>()),
  personAiKey: keyFor,
}));

// The index's grant on the item for the asker (020-ask "AI credits"): who pays a built-in question with Pro on.
const granted = vi.hoisted(() => ({
  level: 'edit' as string | null,
  asked: [] as string[],
}));
vi.mock('./plan-grant', () => ({
  resolvePlanGrant: vi.fn(async (_ctx: unknown, itemId: string) => {
    granted.asked.push(itemId);
    return granted.level
      ? { item: itemId, level: granted.level, owner: 'user_owner', team: null }
      : null;
  }),
}));

// Ask AI's door in this app (liveworkspace/docs/specs/020-ask/ask.md "The route"): who may ask, that built-in AI
// answers about a plan through the app's own binding, and that its allowance is counted in the account's own room
// instance. The route itself is tested where it lives (packages/ask). No network.
const passages = [
  {
    id: 't1:a',
    tabId: 't1',
    tabName: 'First',
    elementId: 'a',
    kind: 'Shape',
    title: 'Payment',
    text: 'It waits.',
  },
];
let stores: Map<string, Map<string, unknown>>;
let asked: { messages: { role: string; content: string }[] }[];
let env: Env;
beforeEach(() => {
  keyFor.mockReset();
  keyFor.mockResolvedValue(null);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  stores = new Map();
  asked = [];
  const rooms = {
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
  env = {
    AI: {
      run: async (_model: string, input: { messages: { role: string; content: string }[] }) => {
        asked.push(input);
        return { response: '<answer>It waits [1].</answer>' };
      },
    },
    PLAN_ROOM: rooms,
  } as unknown as Env;
});
afterEach(() => vi.restoreAllMocks());

type Who = 'account' | 'guest' | 'nobody';
const ask = (who: Who = 'account', path = '/api/ask', method = 'POST') =>
  handleAsk(
    makeTestRouteContext(method, path, {
      ...(who === 'account'
        ? { owner: 'user_a', accountUserId: 'user_a' }
        : who === 'guest'
          ? { owner: 'guest_1' }
          : {}),
      ...(method === 'POST'
        ? { body: { question: 'What happens?', passages, teamId: 'team_1' } }
        : {}),
      env,
    }),
  );
const lastEvent = async (res: Response): Promise<AskEvent> => {
  const lines = (await res.text()).split('\n').filter((line) => line.startsWith('data: '));
  return JSON.parse(lines.at(-1)!.slice(6)) as AskEvent;
};

describe('POST /api/ask', () => {
  it("answers a signed-in person on built-in AI, about a plan, counting the account's allowance", async () => {
    const res = await ask();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(await lastEvent(res)).toMatchObject({
      type: 'done',
      text: 'It waits [1].',
      provider: 'built-in',
      sources: [{ id: 't1:a', number: 1 }],
    });
    expect(asked[0]!.messages[0]!.content).toContain('questions about one plan');
    // Asked of accounts for the item's team; counted in the account's own instance, and nowhere else.
    expect(keyFor.mock.calls[0]![2]).toBe('team_1');
    expect([...stores.keys()]).toEqual([askCountName('user_a')]);
    expect(stores.get(askCountName('user_a'))!.get('ask-ai')).toMatchObject({ count: 1 });
  });

  it('refuses a guest and someone with no identity, asking and counting nothing', async () => {
    for (const who of ['guest', 'nobody'] as const) {
      const res = await ask(who);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: 'ask_needs_account' });
    }
    expect(asked).toHaveLength(0);
    expect(stores.size).toBe(0);
  });

  it("refuses past the day's allowance", async () => {
    for (let n = 0; n < ASK_BUILT_IN_PER_PERSON_PER_DAY; n += 1)
      expect((await ask()).status).toBe(200);
    const capped = await ask();
    expect(capped.status).toBe(429);
    expect(await capped.json()).toMatchObject({ error: 'ask_built_in_limit' });
    expect(asked).toHaveLength(ASK_BUILT_IN_PER_PERSON_PER_DAY);
  });

  it('is one path and one verb', async () => {
    expect((await ask('account', '/api/ask/more')).status).toBe(404);
    expect((await ask('account', '/api/ask', 'GET')).status).toBe(405);
  });
});

describe('POST /api/ask on AI credits (020-ask "AI credits")', () => {
  const askAbout = (extra: Partial<Env> = {}) =>
    handleAsk(
      makeTestRouteContext('POST', '/api/ask', {
        owner: 'user_a',
        accountUserId: 'user_a',
        body: { question: 'What happens?', passages, itemId: 'item_1' },
        env: { ...env, ...extra },
      }),
    );

  beforeEach(() => {
    granted.level = 'edit';
    granted.asked = [];
  });

  it('with Pro off, reads no grant and asks no subscription service', async () => {
    const service = fakeSubscription();
    const res = await askAbout({ SUBSCRIPTION: service.fetcher, SUBSCRIPTION_KEY: 'app-key' });
    expect(res.status).toBe(200);
    expect(service.calls).toEqual([]);
    expect(granted.asked).toEqual([]);
  });

  it("with Pro on, lends an Editor and a Participant the owner's credit, a Viewer nothing", async () => {
    const service = fakeSubscription();
    const pro = {
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'app-key',
      SUBSCRIPTION_URL: 'https://subscription.test/ask',
      SUBSCRIPTION: service.fetcher,
    } as Partial<Env>;
    for (const level of ['edit', 'participate', 'view']) {
      granted.level = level;
      const res = await askAbout(pro);
      expect(res.status).toBe(200);
      await res.text();
    }
    expect(granted.asked).toEqual(['item_1', 'item_1', 'item_1']);
    expect(service.to('spend').map((spend) => [spend.owner, spend.meter, spend.amount])).toEqual([
      ['p:user_owner', 'aiCredits', 1],
      ['p:user_owner', 'aiCredits', 1],
      ['p:user_a', 'aiCredits', 1],
    ]);
    // The owner's month is used: the question is refused with whose it is, and the model is not asked.
    service.spent.set('p:user_owner:aiCredits', 50);
    granted.level = 'edit';
    const asksBefore = asked.length;
    const used = await askAbout(pro);
    expect(used.status).toBe(429);
    expect(await used.json()).toMatchObject({ error: 'ai_credits_used', owner: 'p:user_owner' });
    expect(asked).toHaveLength(asksBefore);
  });
});
