import { describe, expect, it, vi } from 'vitest';
import type { CommunityAppClient, CommunityAppEnv } from './client';
import { createCommunityMineRoute } from './mine-route';

const call = vi.fn(async () => Response.json({ posts: [] }));
const route = createCommunityMineRoute({
  service: { call } as unknown as CommunityAppClient,
  responses: {
    json: (body, init) => Response.json(body, init),
    notFound: () => new Response(null, { status: 404 }),
    signInRequired: () => new Response(null, { status: 401 }),
  },
});

const on = { COMMUNITY_KEY: 'k' } as CommunityAppEnv;
const ctx = (over: {
  env?: CommunityAppEnv;
  segments?: string[];
  method?: string;
  user?: string | null;
}) => ({
  request: new Request('https://app.test/api/community/mine', { method: over.method ?? 'GET' }),
  env: over.env ?? on,
  segments: over.segments ?? ['api', 'community', 'mine'],
  accountUserId: over.user === undefined ? 'user_a' : over.user,
});

describe('createCommunityMineRoute', () => {
  it('answers 404 with the Community off, off its path, or for another method', async () => {
    expect((await route(ctx({ env: {} as CommunityAppEnv }))).status).toBe(404);
    expect((await route(ctx({ segments: ['api', 'community', 'other'] }))).status).toBe(404);
    expect((await route(ctx({ method: 'POST' }))).status).toBe(404);
    expect(call).not.toHaveBeenCalled();
  });

  it('asks for a signed-in author, then answers their posts from the service', async () => {
    expect((await route(ctx({ user: null }))).status).toBe(401);
    const res = await route(ctx({}));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(call).toHaveBeenCalledWith(
      on,
      expect.stringContaining('owner=user_a'),
      expect.anything(),
    );
  });
});
