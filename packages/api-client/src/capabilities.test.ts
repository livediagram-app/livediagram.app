// The capabilities answer is deployment config, so a page asks once however many surfaces need it,
// and asks again only after a failure.
import { describe, expect, it, vi } from 'vitest';
import { createCapabilitiesClient } from './capabilities';

type Caps = { aiEnabled: boolean };
const CLOSED: Caps = { aiEnabled: false };
const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('createCapabilitiesClient', () => {
  it('asks the api once for every caller on the page', async () => {
    const request = answer({ aiEnabled: true });
    const client = createCapabilitiesClient<Caps>({ request, closed: CLOSED });
    const [a, b] = await Promise.all([client.get(), client.get()]);
    const c = await client.get();
    expect(a.aiEnabled).toBe(true);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(request).toHaveBeenCalledOnce();
  });

  it('answers closed on a failure, and asks again next time', async () => {
    const request = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }));
    const client = createCapabilitiesClient<Caps>({ request, closed: CLOSED });
    expect(await client.get()).toBe(CLOSED);
    request.mockResolvedValueOnce(new Response('{"aiEnabled":true}'));
    expect((await client.get()).aiEnabled).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('answers closed when the api cannot be reached', async () => {
    const request = vi.fn(async (): Promise<Response> => {
      throw new TypeError('offline');
    });
    const client = createCapabilitiesClient<Caps>({ request, closed: CLOSED });
    expect(await client.get()).toBe(CLOSED);
    expect(await client.get()).toBe(CLOSED);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('gives each client its own answer, and reset starts a fresh page', async () => {
    const request = answer({ aiEnabled: true });
    const one = createCapabilitiesClient<Caps>({ request, closed: CLOSED });
    const two = createCapabilitiesClient<Caps>({ request, closed: CLOSED });
    await one.get();
    await two.get();
    expect(request).toHaveBeenCalledTimes(2);
    one.reset();
    await one.get();
    expect(request).toHaveBeenCalledTimes(3);
  });
});
