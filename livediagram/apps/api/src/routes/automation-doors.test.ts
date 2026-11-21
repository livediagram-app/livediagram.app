import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import type { Env } from '../types';

// The two doors no identity opens (docs/specs/013-workspace/automations.md; blueprint automations.md "Routes"): an
// Incoming Webhook call and a rule email's unsubscribe, answered by the worker before identity. Everything a
// stranger can get wrong is refused before the canvas's room is asked anything.

afterEach(() => vi.restoreAllMocks());

function world(limited = false) {
  const calls: unknown[][] = [];
  const room = {
    incomingHook: async (...args: unknown[]) => {
      calls.push(['incomingHook', ...args]);
      return { status: 202, body: { queued: 1 } };
    },
    emailOptOut: async (...args: unknown[]) => {
      calls.push(['emailOptOut', ...args]);
      return args[1] === 'good-token';
    },
  };
  const limiter: string[] = [];
  const env = {
    DOCUMENT_ROOM: { idFromName: (name: string) => name, get: () => room },
    WRITE_RATE_LIMITER: {
      limit: async ({ key }: { key: string }) => {
        limiter.push(key);
        return { success: !limited };
      },
    },
  } as unknown as Env;
  const send = (path: string, init: RequestInit = {}) =>
    worker.fetch(new Request(`https://api.test${path}`, init), env);
  return { calls, limiter, send };
}

const JSON_POST = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer lwh_secret' },
  body: JSON.stringify({ version: '2.4' }),
};

describe('POST /api/hooks/automations/:documentId/:ruleId', () => {
  it('hands the call to the canvas’s room and answers what it says, never read as a person', async () => {
    const w = world();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const res = await w.send('/api/hooks/automations/doc-1/rule-1', JSON_POST);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ queued: 1 });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const [method, documentId, ruleId, call] = w.calls[0] as [
      string,
      string,
      string,
      { body: Uint8Array; authorization: string },
    ];
    expect([method, documentId, ruleId]).toEqual(['incomingHook', 'doc-1', 'rule-1']);
    expect(new TextDecoder().decode(call.body)).toBe('{"version":"2.4"}');
    expect(call.authorization).toBe('Bearer lwh_secret');
    // One network's calls share a budget of their own.
    expect(w.limiter).toHaveLength(1);
    expect(w.limiter[0]).toMatch(/^hook:/);
  });

  it('refuses the wrong address, method, type and size before the room is asked', async () => {
    const w = world();
    const refusals: [string, RequestInit, number][] = [
      ['/api/hooks/automations/doc-1', JSON_POST, 404],
      ['/api/hooks/automations/doc-1/rule-1/more', JSON_POST, 404],
      ['/api/hooks/other/doc-1/rule-1', JSON_POST, 404],
      ['/api/hooks/automations/doc-1/rule-1', { method: 'GET' }, 405],
      [
        '/api/hooks/automations/doc-1/rule-1',
        { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' },
        415,
      ],
      [
        '/api/hooks/automations/doc-1/rule-1',
        { ...JSON_POST, body: JSON.stringify({ big: 'x'.repeat(17 * 1024) }) },
        413,
      ],
    ];
    for (const [path, init, status] of refusals)
      expect((await w.send(path, init)).status, `${init.method} ${path}`).toBe(status);
    expect(w.calls).toEqual([]);
  });

  it('answers 429 past the network’s limit, with Retry-After, before the room is asked', async () => {
    const w = world(true);
    const res = await w.send('/api/hooks/automations/doc-1/rule-1', JSON_POST);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(w.calls).toEqual([]);
  });
});

describe('POST /api/email-optout/:documentId/:token', () => {
  it('unsubscribes the token’s address, and answers 404 for a token the canvas never made', async () => {
    const w = world();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const done = await w.send('/api/email-optout/doc-1/good-token', { method: 'POST' });
    expect(done.status).toBe(200);
    expect(await done.json()).toEqual({ unsubscribed: true });
    const missing = await w.send('/api/email-optout/doc-1/bad-token', { method: 'POST' });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'optout_not_found' });
    expect(w.limiter.every((key) => key.startsWith('optout:'))).toBe(true);
  });

  it('refuses a GET (a link scanner unsubscribes nobody), a wrong address, and a network past its limit', async () => {
    const w = world();
    expect((await w.send('/api/email-optout/doc-1/good-token')).status).toBe(405);
    expect((await w.send('/api/email-optout/doc-1', { method: 'POST' })).status).toBe(404);
    expect(w.calls).toEqual([]);
    const limited = world(true);
    const res = await limited.send('/api/email-optout/doc-1/good-token', { method: 'POST' });
    expect(res.status).toBe(429);
    expect(limited.calls).toEqual([]);
  });
});
