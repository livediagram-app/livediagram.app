import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLAUDE_HOST, claudeDoor, claudeDoorFor } from './claude-door';

const MESSAGES = `https://${CLAUDE_HOST}/v1/messages`;

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return Promise.resolve(new Response('ok'));
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('claudeDoor', () => {
  it('lets a request for the Anthropic API through, as a string, a URL or a Request', async () => {
    const calls = stubFetch();
    await claudeDoor(MESSAGES);
    await claudeDoor(new URL(MESSAGES));
    await claudeDoor(new Request(MESSAGES));
    expect(calls).toEqual([MESSAGES, MESSAGES, MESSAGES]);
  });

  it('refuses any other host, and plain HTTP', async () => {
    const calls = stubFetch();
    await expect(claudeDoor('https://example.com/v1/messages')).rejects.toThrow(
      'outbound host refused',
    );
    await expect(claudeDoor(`http://${CLAUDE_HOST}/v1/messages`)).rejects.toThrow(
      'outbound host refused',
    );
    expect(calls).toEqual([]);
  });
});

describe('claudeDoorFor', () => {
  it('is the Anthropic door when the e2e var is unset or empty', () => {
    expect(claudeDoorFor({})).toBe(claudeDoor);
    expect(claudeDoorFor({ E2E_CLAUDE_STAND_IN: '' })).toBe(claudeDoor);
  });

  it.each([
    'https://127.0.0.1:9000',
    'http://example.com:9000',
    'http://127.0.0.1.example.com:9000',
    'http://10.0.0.5:9000',
    'http://127.0.0.1',
    'not a url',
  ])('ignores a var that is not plain HTTP on a loopback port: %s', (value) => {
    expect(claudeDoorFor({ E2E_CLAUDE_STAND_IN: value })).toBe(claudeDoor);
  });

  it('sends a request for the Anthropic API to the stand-in, and never to Anthropic', async () => {
    const calls = stubFetch();
    const door = claudeDoorFor({ E2E_CLAUDE_STAND_IN: 'http://127.0.0.1:9000' });
    await door(MESSAGES);
    await claudeDoorFor({ E2E_CLAUDE_STAND_IN: 'http://localhost:9001/ignored/path' })(
      `${MESSAGES}?beta=1`,
    );
    expect(calls).toEqual([
      'http://127.0.0.1:9000/v1/messages',
      'http://localhost:9001/v1/messages?beta=1',
    ]);
  });

  it('still refuses an address that is not the Anthropic API', async () => {
    const calls = stubFetch();
    const door = claudeDoorFor({ E2E_CLAUDE_STAND_IN: 'http://127.0.0.1:9000' });
    await expect(door('https://example.com/v1/messages')).rejects.toThrow('outbound host refused');
    await expect(door('http://127.0.0.1:9000/v1/messages')).rejects.toThrow(
      'outbound host refused',
    );
    expect(calls).toEqual([]);
  });

  it('is named in no deployed configuration', () => {
    for (const file of ['../../wrangler.toml', '../../hosted-vars.json']) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
      expect(text, file).not.toContain('E2E_CLAUDE_STAND_IN');
    }
  });
});
