import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_KEY_TIMEOUT_MS, aiKeyFor } from './ai-key';
import type { ClientCredentials } from './oauth';

const KEY = 'sk-ant-api03-planted-secret-key-4f2a';

function credentials(
  respond: (request: { url: string; init: RequestInit }) => Promise<Response> | Response,
) {
  const sent: { url: string; init: RequestInit }[] = [];
  const creds: ClientCredentials = {
    accountsUrl: 'https://www.liveworkspace.app',
    clientId: 'liveknowledge',
    clientSecret: 'client-secret',
    accounts: {
      fetch: async (input, init) => {
        const request = { url: String(input), init: init ?? {} };
        sent.push(request);
        return respond(request);
      },
    },
  };
  return { creds, sent };
}

afterEach(() => vi.useRealTimers());

describe("asking accounts for the person's AI key", () => {
  it('goes over the binding with the client credentials and the person’s own token, and reads the answer', async () => {
    const { creds, sent } = credentials(() =>
      Response.json({ source: 'team', provider: 'openai', model: 'gpt-6-luna', key: KEY }),
    );
    expect(
      await aiKeyFor(creds, { accessToken: 'jwt-ada', teamId: 'team_1', want: 'key' }),
    ).toEqual({
      status: 'key',
      source: 'team',
      provider: 'openai',
      model: 'gpt-6-luna',
      key: KEY,
    });
    expect(sent[0]!.url).toBe('https://www.liveworkspace.app/internal/ai-key');
    expect(sent[0]!.init.method).toBe('POST');
    expect((sent[0]!.init.headers as Record<string, string>).authorization).toBe(
      `Basic ${btoa('liveknowledge:client-secret')}`,
    );
    expect(JSON.parse(sent[0]!.init.body as string)).toEqual({
      token: 'jwt-ada',
      teamId: 'team_1',
      want: 'key',
    });

    const which = credentials(() =>
      Response.json({ source: 'account', provider: 'anthropic', model: 'claude-fable-5-2' }),
    );
    expect(await aiKeyFor(which.creds, { accessToken: 'jwt-ada', want: 'which' })).toEqual({
      status: 'key',
      source: 'account',
      provider: 'anthropic',
      model: 'claude-fable-5-2',
    });
    expect(JSON.parse(which.sent[0]!.init.body as string)).toEqual({
      token: 'jwt-ada',
      want: 'which',
    });
  });

  it('says none, unreadable or unavailable, and never throws', async () => {
    const cases: [() => Response | Promise<Response>, string][] = [
      [() => Response.json({ source: null }), 'none'],
      [
        () => Response.json({ error: 'ai_key_unreadable', source: 'account' }, { status: 409 }),
        'unreadable',
      ],
      [
        () => Response.json({ error: 'ai_key_unreadable', source: 'nobody' }, { status: 409 }),
        'unavailable',
      ],
      [() => Response.json({ error: 'rate_limited' }, { status: 429 }), 'unavailable'],
      [() => Response.json({ error: 'invalid_token' }, { status: 401 }), 'unavailable'],
      [() => new Response('Not found', { status: 404 }), 'unavailable'],
      [() => Response.json({ source: 'elsewhere', provider: 'openai', model: 'm' }), 'unavailable'],
      [() => Response.json({ source: 'team', provider: 'gemini', model: 'm' }), 'unavailable'],
      [() => Response.json({ source: 'team', provider: 'openai', model: 7 }), 'unavailable'],
      [() => Response.json({ source: 'team', provider: 'openai', model: 'm' }), 'unavailable'],
      [
        () => Response.json({ source: 'team', provider: 'openai', model: 'm', key: '' }),
        'unavailable',
      ],
      [() => Promise.reject(new Error('binding down')), 'unavailable'],
    ];
    for (const [respond, status] of cases) {
      const { creds } = credentials(respond);
      expect(await aiKeyFor(creds, { accessToken: 'jwt-ada', want: 'key' })).toMatchObject({
        status,
      });
    }
  });

  it('never leaves the binding, and needs a token', async () => {
    const global = vi.spyOn(globalThis, 'fetch');
    const { creds, sent } = credentials(() => Response.json({ source: null }));
    expect(
      await aiKeyFor({ ...creds, accounts: undefined }, { accessToken: 'jwt-ada', want: 'key' }),
    ).toEqual({
      status: 'unavailable',
    });
    expect(await aiKeyFor(creds, { accessToken: '', want: 'key' })).toEqual({
      status: 'unavailable',
    });
    expect(sent).toEqual([]);
    expect(global).not.toHaveBeenCalled();
    global.mockRestore();
  });

  it('gives up at its deadline', async () => {
    vi.useFakeTimers();
    const { creds } = credentials(
      ({ init }) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const pending = aiKeyFor(creds, { accessToken: 'jwt-ada', want: 'key' });
    await vi.advanceTimersByTimeAsync(AI_KEY_TIMEOUT_MS);
    expect(await pending).toEqual({ status: 'unavailable' });
  });
});
