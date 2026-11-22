import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { apiPublish, apiPublishingState, apiUnpublish } from './publishing';

// Publish to the Web's client (docs/specs/030-knowledgebase/publishing.md), over a fake fetch.

type Call = { url: string; init: RequestInit };

function stub(answer: unknown, status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(Response.json(answer, { status }));
    }),
  );
  return calls;
}

const who = { ownerId: 'owner-1', shareCode: null };
const state = { offered: true, published: false, site: null, defaultAddress: 'kb', preview: {} };

afterEach(() => vi.unstubAllGlobals());

describe('the publishing client', () => {
  it('reads the state, with or without a section', async () => {
    const calls = stub(state);
    expect(await apiPublishingState(who, 'd 1')).toEqual(state);
    await apiPublishingState(who, 'd1', 'p1');
    await apiPublishingState(who, 'd1', null);
    expect(calls.map((c) => c.url.replace(/^.*\/api/, ''))).toEqual([
      '/documents/d%201/publishing',
      '/documents/d1/publishing?root=p1',
      '/documents/d1/publishing?root=',
    ]);
  });

  it('publishes and unpublishes', async () => {
    const calls = stub(state);
    const body = { address: 'acme', root: null, noindex: false, showWriters: true };
    await apiPublish(who, 'd1', body);
    await apiUnpublish(who, 'd1');
    expect(calls.map((c) => c.init.method)).toEqual(['PUT', 'DELETE']);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(body);
  });

  it('throws the refusal with its code', async () => {
    stub({ error: 'address_taken', message: 'x' }, 409);
    await expect(
      apiPublish(who, 'd1', { address: 'acme', root: null, noindex: false, showWriters: false }),
    ).rejects.toMatchObject({ code: 'address_taken', status: 409 });
    await expect(apiUnpublish(who, 'd1')).rejects.toBeInstanceOf(ApiError);
  });
});
