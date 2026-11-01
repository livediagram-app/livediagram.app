import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { indexFor, indexService, requestGrant } from './index-service';
import { indexServiceFor } from './test-index';
import type { Env } from './types';

// The index as this api reaches it, against the real index in this process (test-index.ts).
afterEach(() => vi.unstubAllGlobals());

describe('index service', () => {
  it('files a canvas for a person and grants them edit on it', async () => {
    const env = {} as Env;
    const index = await indexServiceFor(env);
    const token = await index.tokenFor('user_ann');
    const client = indexFor(env, { kind: 'bearer', token })!;
    const { item } = await client.createItem({ id: 'doc-1', app: 'livehuddle', title: 'Map' });
    expect(item).toMatchObject({ id: 'doc-1', ownerId: 'user_ann', kind: 'canvas', title: 'Map' });
    const outcome = await requestGrant(env, { kind: 'bearer', token }, 'doc-1', null);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const claims = await indexService.verifyGrant(env, outcome.grant.grant, 'doc-1');
    expect(claims).toMatchObject({ sub: 'user_ann', level: 'edit', item: 'doc-1' });
  });

  it('delegates for an API token with the app key', async () => {
    const env = {} as Env;
    await indexServiceFor(env);
    const client = indexFor(env, { kind: 'delegate', personId: 'user_bo', teams: [] })!;
    const { item } = await client.createItem({ app: 'livehuddle', title: 'Flow' });
    expect(item.ownerId).toBe('user_bo');
  });

  it('serves a guest by their guest token', async () => {
    const env = {} as Env;
    const index = await indexServiceFor(env);
    const token = await index.tokenFor('guest_0f5ca4af-9a8a-4a60-be5e-1179e5555880', {
      guest: true,
    });
    const { item } = await indexFor(env, { kind: 'bearer', token })!.createItem({
      app: 'livehuddle',
      title: 'Sketch',
    });
    expect(item.ownerId).toBe('guest_0f5ca4af-9a8a-4a60-be5e-1179e5555880');
  });
});
