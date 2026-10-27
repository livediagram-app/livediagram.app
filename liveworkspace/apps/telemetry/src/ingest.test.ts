import { describe, expect, it, vi } from 'vitest';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { handleIngest } from './ingest';
import { testEnv } from './test-env';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://liveworkspace.app/api/telemetry/events', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const fromPage = (origin: string) => ({ Origin: origin, 'CF-Connecting-IP': '203.0.113.9' });
const created = { category: 'Document', action: 'Created' };
// liveplanner calls its document a project, so its vocabulary takes this one instead.
const projectCreated = { category: 'Project', action: 'Created' };

describe('ingest', () => {
  it('stores a page’s events under the app it names, with a server time', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    const res = await handleIngest(
      post({ app: 'livediagram.app', events: [created] }, fromPage('https://www.livediagram.app')),
      env,
    );
    expect(res.status).toBe(204);
    expect(env.rows).toHaveLength(1);
    expect(env.rows[0]).toMatchObject({ app: 'livediagram.app', category: 'Document', type: null });
    expect(env.rows[0]!.ts).toBeGreaterThan(0);
  });

  it('checks each app against its own vocabulary: livedocuments’ and livedesign’s', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    await handleIngest(
      post({ app: 'livedocuments.app', events: [created] }, fromPage('https://livedocuments.app')),
      env,
    );
    await handleIngest(
      post({ app: 'livedesign.app', events: [created] }, fromPage('https://livedesign.app')),
      env,
    );
    expect(env.rows).toHaveLength(2);
    expect(env.rows[0]).toMatchObject({ app: 'livedocuments.app', category: 'Document' });
    expect(env.rows[1]).toMatchObject({ app: 'livedesign.app', category: 'Document' });
  });

  it('refuses a page speaking for another app', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    await handleIngest(
      post({ app: 'liveplanner.app', events: [created] }, fromPage('https://www.livediagram.app')),
      env,
    );
    await handleIngest(
      post({ app: 'livediagram.app', events: [created] }, fromPage('https://evil.example')),
      env,
    );
    expect(env.rows).toHaveLength(0);
  });

  it('takes only the Explorer’s events from liveworkspace.app, in an app’s name or its own', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    const lens = { category: 'Explorer', action: 'Selected', type: 'OpensIn' };
    const view = { category: 'UI', action: 'Toggled', type: 'ExplorerViewCard' };
    await handleIngest(
      post(
        { app: 'liveplanner.app', events: [lens, projectCreated, view] },
        fromPage('https://liveworkspace.app'),
      ),
      env,
    );
    await handleIngest(
      post(
        { app: 'liveworkspace.app', events: [view, created] },
        fromPage('https://liveworkspace.app'),
      ),
      env,
    );
    // An unknown token for a known pair is not the Explorer's either.
    await handleIngest(
      post(
        { app: 'livediagram.app', events: [{ ...lens, type: 'Anything' }] },
        fromPage('https://liveworkspace.app'),
      ),
      env,
    );
    expect(env.rows.map((r) => [r.app, r.category, r.type])).toEqual([
      ['liveplanner.app', 'Explorer', 'OpensIn'],
      ['liveplanner.app', 'UI', 'ExplorerViewCard'],
      ['liveworkspace.app', 'UI', 'ExplorerViewCard'],
    ]);
  });

  it('takes an app’s settings events from liveworkspace.app, and only that app’s, and the shared ones in its own name', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    const comments = { category: 'UI', action: 'Toggled', type: 'NotifyCommentsOff' };
    const join = { category: 'UI', action: 'Toggled', type: 'NotifyProjectJoinOff' };
    await handleIngest(
      post(
        { app: 'liveplanner.app', events: [comments, join] },
        fromPage('https://liveworkspace.app'),
      ),
      env,
    );
    // livediagram has no Project Joined switch.
    await handleIngest(
      post(
        { app: 'livediagram.app', events: [join, comments] },
        fromPage('https://liveworkspace.app'),
      ),
      env,
    );
    // The settings page opened for no app counts a switch every app shares once, in liveworkspace.app's name, and
    // only such a switch.
    await handleIngest(
      post(
        { app: 'liveworkspace.app', events: [comments, join] },
        fromPage('https://liveworkspace.app'),
      ),
      env,
    );
    expect(env.rows.map((r) => [r.app, r.type])).toEqual([
      ['liveplanner.app', 'NotifyCommentsOff'],
      ['liveplanner.app', 'NotifyProjectJoinOff'],
      ['livediagram.app', 'NotifyCommentsOff'],
      ['liveworkspace.app', 'NotifyCommentsOff'],
    ]);
  });

  it('never lets an app’s page, or a key, speak for liveworkspace.app', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    const view = { category: 'UI', action: 'Toggled', type: 'ExplorerViewCard' };
    await handleIngest(
      post({ app: 'liveworkspace.app', events: [view] }, fromPage('https://www.livediagram.app')),
      env,
    );
    await handleIngest(
      post({ app: 'liveworkspace.app', events: [view] }, { 'X-Telemetry-Key': 'lp-key' }),
      env,
    );
    expect(env.rows).toHaveLength(0);
  });

  it('takes localhost pages only in development', async () => {
    const prod = testEnv({ ENVIRONMENT: 'production' });
    const dev = testEnv();
    const req = () =>
      post({ app: 'liveplanner.app', events: [projectCreated] }, fromPage('http://localhost:3200'));
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
        fromPage('https://www.livediagram.app'),
      ),
      env,
    );
    expect(env.rows.map((r) => `${r.category}·${r.action}`)).toEqual(['Document·Created']);
  });

  it('caps a batch, and answers 204 to anything malformed', async () => {
    const env = testEnv({ ENVIRONMENT: 'production' });
    const headers = fromPage('https://www.livediagram.app');
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

describe('the rate-limit key', () => {
  // api-kit's clientRateKey, the one every api keys its limiters on, not a copy of it.
  it('is api-kit’s clientRateKey for every kind of address', async () => {
    const addresses = ['203.0.113.9', '2001:db8:0:1:aaaa::1', '2001:DB8::1', '::ffff:192.0.2.1'];
    for (const ip of [...addresses, undefined]) {
      const limit = vi.fn().mockResolvedValue({ success: true });
      const env = testEnv({ ENVIRONMENT: 'production', EVENTS_RATE_LIMITER: { limit } });
      const headers: Record<string, string> = { Origin: 'https://livedocuments.app' };
      if (ip) headers['CF-Connecting-IP'] = ip;
      const request = post({ app: 'livedocuments.app', events: [created] }, headers);
      await handleIngest(request.clone(), env);
      expect(limit).toHaveBeenCalledWith({ key: clientRateKey(request) });
    }
  });
});
