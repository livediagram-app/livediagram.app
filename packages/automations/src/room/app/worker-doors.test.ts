import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serveItemHook, serveItemOptOut, type ItemDoorAnswers } from './worker-doors';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const answers: ItemDoorAnswers = {
  notFound: () => Response.json({ error: 'not_found' }, { status: 404 }),
  methodNotAllowed: () => Response.json({ error: 'method_not_allowed' }, { status: 405 }),
  json: (body, init) => Response.json(body, init),
};
const base = { network: () => '203.0.113.9', answers };
const limiter = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });
const post = (path: string, init: RequestInit = {}) =>
  new Request(`https://api.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    ...init,
  });

describe('the Incoming Webhook door', () => {
  const hook = vi.fn(async () => ({ status: 202, body: { queued: 1 } }));

  it('answers 404 for anything but a rule’s address, before the room', async () => {
    for (const path of [
      '/api/hooks/automations/d1',
      '/api/hooks/automations/d1/r1/x',
      '/api/hooks/other/d1/r1',
    ])
      expect((await serveItemHook(post(path), { ...base, hook })).status).toBe(404);
    expect(hook).not.toHaveBeenCalled();
  });

  it('refuses another method, and a network past the write limit, before the room', async () => {
    const get = new Request('https://api.test/api/hooks/automations/d1/r1');
    expect((await serveItemHook(get, { ...base, hook })).status).toBe(405);
    const held = limiter(false);
    const res = await serveItemHook(post('/api/hooks/automations/d1/r1'), {
      ...base,
      limiter: held,
      hook,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await res.json()).toEqual({ error: 'webhook_rate_limited' });
    expect(held.limit).toHaveBeenCalledWith({ key: 'hook:203.0.113.9' });
    expect(hook).not.toHaveBeenCalled();
  });

  it('turns a network past the write limit away before a byte of the body is read', async () => {
    const pulled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled();
        controller.enqueue(new TextEncoder().encode('{}'));
        controller.close();
      },
    });
    const request = new Request('https://api.test/api/hooks/automations/d1/r1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit);
    const res = await serveItemHook(request, { ...base, limiter: limiter(false), hook });
    expect(res.status).toBe(429);
    expect(request.bodyUsed).toBe(false);
    expect(hook).not.toHaveBeenCalled();
  });

  it('hands the call to the item’s room, under the app’s own prefix too', async () => {
    const res = await serveItemHook(post('/api/hooks/automations/d1/r1'), {
      ...base,
      limiter: limiter(true),
      hook,
    });
    expect(res.status).toBe(202);
    expect(hook).toHaveBeenCalledWith('d1', 'r1', expect.objectContaining({ signature: null }));
    const other = await serveItemHook(post('/v2/hooks/automations/d2/r2'), {
      ...base,
      prefix: '/v2',
      hook,
    });
    expect(other.status).toBe(202);
    expect(hook).toHaveBeenLastCalledWith('d2', 'r2', expect.anything());
  });
});

describe('the email opt-out door', () => {
  it('answers 404 for another address and 405 for a GET, before the room', async () => {
    const optOut = vi.fn(async () => true);
    expect((await serveItemOptOut(post('/api/email-optout/d1'), { ...base, optOut })).status).toBe(
      404,
    );
    const get = new Request('https://api.test/api/email-optout/d1/tok');
    expect((await serveItemOptOut(get, { ...base, optOut })).status).toBe(405);
    expect(optOut).not.toHaveBeenCalled();
  });

  it('holds a network to the write limit', async () => {
    const optOut = vi.fn(async () => true);
    const held = limiter(false);
    const res = await serveItemOptOut(post('/api/email-optout/d1/tok'), {
      ...base,
      limiter: held,
      optOut,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(held.limit).toHaveBeenCalledWith({ key: 'optout:203.0.113.9' });
    expect(optOut).not.toHaveBeenCalled();
  });

  it('unsubscribes a token’s address, and answers 404 for one the item never made', async () => {
    const done = await serveItemOptOut(post('/api/email-optout/d1/tok'), {
      ...base,
      limiter: limiter(true),
      optOut: async (itemId, token) => itemId === 'd1' && token === 'tok',
    });
    expect(done.status).toBe(200);
    expect(done.headers.get('Cache-Control')).toBe('no-store');
    expect(await done.json()).toEqual({ unsubscribed: true });
    const none = await serveItemOptOut(post('/api/email-optout/d1/other'), {
      ...base,
      optOut: async () => false,
    });
    expect(none.status).toBe(404);
    expect(await none.json()).toEqual({ error: 'optout_not_found' });
  });
});
