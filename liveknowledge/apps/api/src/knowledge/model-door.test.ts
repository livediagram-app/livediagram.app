import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLAUDE_MESSAGES_URL,
  MODEL_PROVIDERS,
  OPENAI_RESPONSES_URL,
  type KeyProviderId,
} from '@liveworkspace/ai';
import {
  E2E_VERIFIED_AT_HEADER,
  modelDoor,
  modelDoorFor,
  underE2eStack,
  verifyMoment,
} from './model-door';

const API: Record<KeyProviderId, string> = {
  anthropic: CLAUDE_MESSAGES_URL,
  openai: OPENAI_RESPONSES_URL,
};
const OTHER: Record<KeyProviderId, KeyProviderId> = {
  anthropic: 'openai',
  openai: 'anthropic',
};
const PROVIDERS = MODEL_PROVIDERS.map((p) => p.id);

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return Promise.resolve(new Response('ok'));
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('modelDoor', () => {
  it('allows exactly two hosts, one a provider', () => {
    expect(MODEL_PROVIDERS.map((p) => p.host)).toEqual(['api.anthropic.com', 'api.openai.com']);
  });

  it.each(PROVIDERS)(
    "lets a request for %s's own API through, as a string, a URL or a Request",
    async (provider) => {
      const calls = stubFetch();
      const door = modelDoor(provider);
      await door(API[provider]);
      await door(new URL(API[provider]));
      await door(new Request(API[provider]));
      expect(calls).toEqual([API[provider], API[provider], API[provider]]);
    },
  );

  it.each(PROVIDERS)(
    "refuses, for a %s key, the other provider's host, any other host, plain HTTP and another port",
    async (provider) => {
      const calls = stubFetch();
      const door = modelDoor(provider);
      const { host } = new URL(API[provider]);
      for (const address of [
        API[OTHER[provider]],
        'https://example.com/v1/messages',
        `https://${host}.example.com/v1/messages`,
        `https://example.com/?next=https://${host}/v1/messages`,
        `http://${host}/v1/messages`,
        `https://${host}:8443/v1/messages`,
        `https://user@example.com/${host}`,
      ])
        await expect(door(address), address).rejects.toThrow('outbound host refused');
      expect(calls).toEqual([]);
    },
  );
});

describe('modelDoorFor', () => {
  it.each([
    undefined,
    '',
    'https://127.0.0.1:9000',
    'http://example.com:9000',
    'http://127.0.0.1.example.com:9000',
    'http://10.0.0.5:9000',
    'http://127.0.0.1',
    'not a url',
  ])(
    'is the provider door unless the var names plain HTTP on a loopback port: %s',
    async (value) => {
      const calls = stubFetch();
      for (const provider of PROVIDERS) {
        const door = modelDoorFor(
          value === undefined ? {} : { E2E_CLAUDE_STAND_IN: value },
          provider,
        );
        await door(API[provider]);
        await expect(door(API[OTHER[provider]])).rejects.toThrow('outbound host refused');
      }
      expect(calls).toEqual([API.anthropic, API.openai]);
    },
  );

  it('sends a request for the provider API to the stand-in, and never to the provider', async () => {
    const calls = stubFetch();
    await modelDoorFor(
      { E2E_CLAUDE_STAND_IN: 'http://127.0.0.1:9000' },
      'anthropic',
    )(API.anthropic);
    await modelDoorFor({ E2E_CLAUDE_STAND_IN: 'http://127.0.0.1:9000' }, 'openai')(API.openai);
    await modelDoorFor(
      { E2E_CLAUDE_STAND_IN: 'http://localhost:9001/ignored/path' },
      'anthropic',
    )(`${API.anthropic}?beta=1`);
    expect(calls).toEqual([
      'http://127.0.0.1:9000/v1/messages',
      'http://127.0.0.1:9000/v1/responses',
      'http://localhost:9001/v1/messages?beta=1',
    ]);
  });

  it('still refuses an address that is not the stored provider API', async () => {
    const calls = stubFetch();
    const door = modelDoorFor({ E2E_CLAUDE_STAND_IN: 'http://127.0.0.1:9000' }, 'anthropic');
    await expect(door('https://example.com/v1/messages')).rejects.toThrow('outbound host refused');
    await expect(door('http://127.0.0.1:9000/v1/messages')).rejects.toThrow(
      'outbound host refused',
    );
    await expect(door(API.openai)).rejects.toThrow('outbound host refused');
    expect(calls).toEqual([]);
  });

  it('is named in no deployed configuration', () => {
    for (const file of ['../../wrangler.toml', '../../hosted-vars.json']) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url).href), 'utf8');
      expect(text, file).not.toMatch(/E2E_[A-Z_]*STAND_IN/);
    }
  });
});

describe('verifyMoment', () => {
  const NOW = 1_800_000_000_000;
  const asking = (value: string) =>
    new Request('https://kb.test/verify', { headers: { [E2E_VERIFIED_AT_HEADER]: value } });
  const stack = { E2E_CLAUDE_STAND_IN: 'http://127.0.0.1:9000' };

  it('is now on every deployment, whatever the header says', () => {
    expect(underE2eStack({})).toBe(false);
    expect(verifyMoment({}, asking(String(NOW - 1000)), NOW)).toBe(NOW);
    expect(
      verifyMoment({ E2E_CLAUDE_STAND_IN: 'https://example.com' }, asking(String(NOW - 1000)), NOW),
    ).toBe(NOW);
  });

  it('takes an earlier moment under the e2e stack, and nothing else', () => {
    expect(underE2eStack(stack)).toBe(true);
    expect(verifyMoment(stack, asking(String(NOW - 1000)), NOW)).toBe(NOW - 1000);
    expect(verifyMoment(stack, new Request('https://kb.test/verify'), NOW)).toBe(NOW);
    for (const value of [String(NOW + 1), '-5', '1.5', 'yesterday'])
      expect(verifyMoment(stack, asking(value), NOW)).toBe(NOW);
  });
});
