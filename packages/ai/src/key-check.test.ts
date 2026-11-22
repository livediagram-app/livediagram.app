import { describe, expect, it, vi } from 'vitest';
import { CLAUDE_API_VERSION } from './claude-request';
import { KEY_CHECK_TIMEOUT_MS, checkProviderKey, keyCheckHeaders, keyCheckUrl } from './key-check';
import { providerFetch } from './provider-door';
import { errorResponse } from './testing/claude';
import { openAiErrorResponse } from './testing/openai';

const KEY = 'sk-ant-api03-planted-secret-key-4f2a';

type Sent = { url: string; init: RequestInit };
function recording(respond: () => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return respond();
  }) as unknown as typeof globalThis.fetch;
  return { fetch, sent };
}

describe('checking a key before it is saved', () => {
  it("asks for the model's record on the provider's own host, with the key in its one header", async () => {
    const claude = recording(() => new Response('{"id":"claude-fable-5-2"}', { status: 200 }));
    await expect(
      checkProviderKey({
        provider: 'anthropic',
        apiKey: KEY,
        model: 'claude-fable-5-2',
        fetch: claude.fetch,
      }),
    ).resolves.toEqual({ ok: true });
    expect(claude.sent[0]!.url).toBe('https://api.anthropic.com/v1/models/claude-fable-5-2');
    expect(claude.sent[0]!.init.method).toBe('GET');
    expect(claude.sent[0]!.init.headers).toEqual({
      'x-api-key': KEY,
      'anthropic-version': CLAUDE_API_VERSION,
    });

    const openai = recording(() => new Response(null, { status: 200 }));
    await expect(
      checkProviderKey({
        provider: 'openai',
        apiKey: 'sk-proj-x',
        model: 'gpt-6.2-sol',
        fetch: openai.fetch,
      }),
    ).resolves.toEqual({ ok: true });
    expect(openai.sent[0]!.url).toBe('https://api.openai.com/v1/models/gpt-6.2-sol');
    expect(openai.sent[0]!.init.headers).toEqual({ authorization: 'Bearer sk-proj-x' });
  });

  it('writes a model id into the path as one segment, never as a way elsewhere', () => {
    expect(keyCheckUrl('anthropic', '../../evil?x=1')).toBe(
      'https://api.anthropic.com/v1/models/..%2F..%2Fevil%3Fx%3D1',
    );
    expect(keyCheckHeaders('openai', 'k')).toEqual({ authorization: 'Bearer k' });
  });

  it("tells a refused key, no credit and a model the key cannot use apart, never in the provider's words", async () => {
    const answers: [() => Response, string][] = [
      [() => errorResponse(401, 'authentication_error'), 'bad-key'],
      [() => errorResponse(400, 'billing_error'), 'no-credit'],
      [() => errorResponse(404, 'not_found_error'), 'model-unavailable'],
      [() => errorResponse(529, 'overloaded_error'), 'overloaded'],
      [() => new Response('not json', { status: 500 }), 'other'],
    ];
    for (const [respond, kind] of answers) {
      const check = await checkProviderKey({
        provider: 'anthropic',
        apiKey: KEY,
        model: 'claude-fable-5-2',
        fetch: recording(respond).fetch,
      });
      expect(check).toEqual({ ok: false, kind });
    }
    const openai = await checkProviderKey({
      provider: 'openai',
      apiKey: KEY,
      model: 'gpt-6.2-sol',
      fetch: recording(() => openAiErrorResponse(429, { code: 'insufficient_quota' })).fetch,
    });
    expect(openai).toEqual({ ok: false, kind: 'no-credit' });
  });

  it('never throws: a network failure is `other`, and so is a check given up at its deadline', async () => {
    const down = (() =>
      Promise.reject(new Error(`connect failed with ${KEY}`))) as unknown as typeof fetch;
    const check = await checkProviderKey({
      provider: 'anthropic',
      apiKey: KEY,
      model: 'm',
      fetch: down,
    });
    expect(check).toEqual({ ok: false, kind: 'other' });
    expect(JSON.stringify(check)).not.toContain(KEY);

    vi.useFakeTimers();
    try {
      const hanging = ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        })) as unknown as typeof fetch;
      const pending = checkProviderKey({
        provider: 'openai',
        apiKey: KEY,
        model: 'm',
        fetch: hanging,
      });
      await vi.advanceTimersByTimeAsync(KEY_CHECK_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ ok: false, kind: 'other' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the provider's door", () => {
  it("lets a request through to the provider's own host over HTTPS, and refuses every other address", async () => {
    const through = vi.fn(async () => new Response('ok'));
    const door = providerFetch('anthropic', through);
    await expect(door('https://api.anthropic.com/v1/models/x')).resolves.toBeInstanceOf(Response);
    await door(new URL('https://api.anthropic.com/v1/messages'));
    await door(new Request('https://api.anthropic.com/v1/messages', { method: 'POST' }));
    expect(through).toHaveBeenCalledTimes(3);
    for (const address of [
      'http://api.anthropic.com/v1/models',
      'https://api.anthropic.com:8443/v1/models',
      'https://api.openai.com/v1/models',
      'https://api.anthropic.com.evil.example/v1',
      'https://169.254.169.254/latest',
      'not a url',
    ]) {
      await expect(door(address)).rejects.toThrow('outbound host refused');
    }
    expect(through).toHaveBeenCalledTimes(3);
  });

  it('uses the global fetch unless it is handed one', async () => {
    const global = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    try {
      await providerFetch('openai')('https://api.openai.com/v1/models');
      expect(global).toHaveBeenCalledOnce();
    } finally {
      global.mockRestore();
    }
  });
});
