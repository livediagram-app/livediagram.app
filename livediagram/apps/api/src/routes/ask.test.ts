import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_BUILT_IN_PER_PERSON_PER_DAY, type AskEvent } from '@liveworkspace/ask';
import { askCountName, spendAskIn } from '@liveworkspace/ask/server';
import type { Env } from '../types';
import { handleAsk } from './ask';
import { makeTestRouteContext } from './test-route-context';

// Whose key applies (ai-keys.md "Every AI feature honours the choice"): built-in AI unless a test says otherwise.
const keyFor = vi.hoisted(() => vi.fn(async (): Promise<unknown> => null));
vi.mock('@liveworkspace/auth-client/ai-key', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/auth-client/ai-key')>()),
  personAiKey: keyFor,
}));

// Ask AI's door in this app (liveworkspace/docs/specs/019-ask/ask.md "The route"): who may ask, that built-in AI
// answers about a canvas through the app's own binding, and that its allowance is counted in the account's own room
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
    DOCUMENT_ROOM: rooms,
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
  it("answers a signed-in person on built-in AI, about a canvas, counting the account's allowance", async () => {
    const res = await ask();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(await lastEvent(res)).toMatchObject({
      type: 'done',
      text: 'It waits [1].',
      provider: 'built-in',
      sources: [{ id: 't1:a', number: 1 }],
    });
    expect(asked[0]!.messages[0]!.content).toContain('questions about one canvas');
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
