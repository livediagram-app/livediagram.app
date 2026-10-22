import { describe, expect, it, vi } from 'vitest';
import { handleIngest, rateKey } from './ingest';
import { testEnv } from './test-env';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://liveworkspace.app/telemetry/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const fromPage = (origin: string) => ({ Origin: origin, 'CF-Connecting-IP': '203.0.113.9' });
const created = { category: 'Document', action: 'Created' };

describe('ingest', () => {
  it('stores a page’s events under the app it names, with a server time', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    const res = await handleIngest(
      post({ app: 'livediagram.app', events: [created] }, fromPage('https://livediagram.app')),
      env,
    );
    expect(res.status).toBe(204);
    expect(env.rows).toHaveLength(1);
    expect(env.rows[0]).toMatchObject({ app: 'livediagram.app', category: 'Document', type: null });
    expect(env.rows[0]!.ts).toBeGreaterThan(0);
  });

  it('refuses a page speaking for another app', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    await handleIngest(
      post({ app: 'liveplanner.app', events: [created] }, fromPage('https://livediagram.app')),
      env,
    );
    await handleIngest(
      post({ app: 'livediagram.app', events: [created] }, fromPage('https://evil.example')),
      env,
    );
    expect(env.rows).toHaveLength(0);
  });

  it('takes localhost pages only in development', async () => {
    const prod = testEnv({ ENVIRONMENT: 'production' });
    const dev = testEnv();
    const req = () =>
      post({ app: 'liveplanner.app', events: [created] }, fromPage('http://localhost:3100'));
    await handleIngest(req(), prod);
    await handleIngest(req(), dev);
    expect(prod.rows).toHaveLength(0);
    expect(dev.rows).toHaveLength(1);
  });

  it('takes a Worker batch only with its own app’s key', async () => {
    const env = testEnv();
    const batch = { app: 'liveplanner.app', events: [{ category: 'Session', action: 'SignedUp' }] };
    await handleIngest(post(batch, { 'X-Telemetry-Key': 'ld-key' }), env);
    expect(env.rows).toHaveLength(0);
    await handleIngest(post(batch, { 'X-Telemetry-Key': 'lp-key' }), env);
    expect(env.rows).toHaveLength(1);
  });

  it('drops events outside the app’s vocabulary, and what only its Workers may count', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    await handleIngest(
      post(
        {
          app: 'livediagram.app',
          events: [
            created,
            { category: 'Nope', action: 'Created' },
            { category: 'Document', action: 'Created', type: 'my secret plan!' },
            { category: 'Session', action: 'SignedUp' },
          ],
        },
        fromPage('https://livediagram.app'),
      ),
      env,
    );
    expect(env.rows.map((r) => `${r.category}·${r.action}`)).toEqual(['Document·Created']);
  });

  it('caps a batch, and answers 204 to anything malformed', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    const headers = fromPage('https://livediagram.app');
    await handleIngest(
      post({ app: 'livediagram.app', events: Array(150).fill(created) }, headers),
      env,
    );
    expect(env.rows).toHaveLength(100);
    for (const body of [
      'not json',
      'null',
      '{"app":"x.app","events":[]}',
      '{"app":"livediagram.app"}',
    ]) {
      expect((await handleIngest(post(body, headers), env)).status).toBe(204);
    }
    expect(env.rows).toHaveLength(100);
  });

  it('stores nothing while telemetry is off', async () => {
    const env = testEnv({ TELEMETRY_ENABLED: undefined });
    await handleIngest(
      post({ app: 'livediagram.app', events: [created] }, fromPage('http://localhost:1')),
      env,
    );
    expect(env.rows).toHaveLength(0);
  });

  it('rate-limits pages by network, never an app’s Workers', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const env = testEnv({ EVENTS_RATE_LIMITER: { limit } });
    await handleIngest(
      post({ app: 'livediagram.app', events: [created] }, fromPage('http://localhost:1')),
      env,
    );
    expect(env.rows).toHaveLength(0);
    await handleIngest(
      post({ app: 'livediagram.app', events: [created] }, { 'X-Telemetry-Key': 'ld-key' }),
      env,
    );
    expect(env.rows).toHaveLength(1);
    expect(limit).toHaveBeenCalledTimes(1);
  });
});

describe('rateKey', () => {
  const req = (ip?: string) =>
    new Request('https://x', { headers: ip ? { 'CF-Connecting-IP': ip } : {} });
  it('keeps IPv4 whole and widens IPv6 to its /64', () => {
    expect(rateKey(req('203.0.113.9'))).toBe('203.0.113.9');
    expect(rateKey(req('2001:db8:0:1:aaaa::1'))).toBe('2001:db8:0:1::/64');
    expect(rateKey(req('2001:DB8::1'))).toBe('2001:db8:0:0::/64');
    expect(rateKey(req())).toBe('anonymous');
  });
});
