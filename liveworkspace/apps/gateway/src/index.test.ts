import { describe, expect, it } from 'vitest';
import worker, { targetFor, type Env, type Target } from './index';

describe('targetFor', () => {
  it.each<[string, Target]>([
    ['/api/auth/token', 'ACCOUNTS'],
    ['/api/account/profile', 'ACCOUNTS'],
    ['/.well-known/openid-configuration', 'ACCOUNTS'],
    ['/.well-known/oauth-authorization-server/api/auth', 'ACCOUNTS'],
    ['/api/index', 'INDEX'],
    ['/api/index/jwks', 'INDEX'],
    ['/api/media/x.png', 'MEDIA'],
    ['/api/previews/liveplanner.app/abc', 'MEDIA'],
    ['/api/telemetry/events', 'TELEMETRY'],
    ['/api/community', 'COMMUNITY'],
    ['/', 'SITE'],
    ['/explorer/home', 'SITE'],
    ['/telemetry', 'SITE'],
    ['/api/authx', 'SITE'],
  ])('%s goes to %s', (path, target) => {
    expect(targetFor(path)).toBe(target);
  });
});

describe('fetch', () => {
  it('forwards the request unchanged to the Worker that owns its path', async () => {
    const seen: Array<[Target, string]> = [];
    const env = Object.fromEntries(
      (['ACCOUNTS', 'INDEX', 'MEDIA', 'TELEMETRY', 'COMMUNITY', 'SITE'] as const).map((t) => [
        t,
        { fetch: async (r: Request) => (seen.push([t, r.url]), new Response(t)) },
      ]),
    ) as unknown as Env;
    const url = 'https://gw.example/api/index/jwks?x=1';
    const res = await worker.fetch(new Request(url), env);
    expect(await res.text()).toBe('INDEX');
    expect(seen).toEqual([['INDEX', url]]);
  });
});
