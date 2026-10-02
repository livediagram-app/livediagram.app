import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './core';
import {
  apiClearPlacementDefault,
  apiListPlacementDefaults,
  apiSetPlacementDefault,
} from './placement-defaults';

// docs/specs/013-workspace/blueprints/default-folders.md "Interfaces and contracts": a person's
// default folders, read, set and cleared, every refusal surfacing its token.

let calls: { url: string; method: string; body: unknown }[];
let reply: Response;

beforeEach(() => {
  calls = [];
  reply = new Response(null, { status: 204 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return reply.clone();
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('placement default calls', () => {
  it('lists the defaults', async () => {
    const defaults = [{ key: 'mode:draw', folderId: 'f1' }];
    reply = new Response(JSON.stringify({ defaults }), { status: 200 });
    expect(await apiListPlacementDefaults('owner-1')).toEqual(defaults);
    expect(calls[0]).toMatchObject({ method: 'GET' });
    expect(calls[0]!.url).toMatch(/\/placement-defaults$/);
  });

  it('sets a default with the key encoded in the path', async () => {
    await apiSetPlacementDefault('owner-1', 'board:retrospective', 'f-retros');
    expect(calls[0]).toMatchObject({ method: 'PUT', body: { folderId: 'f-retros' } });
    expect(calls[0]!.url).toMatch(/\/placement-defaults\/board%3Aretrospective$/);
  });

  it('clears a default', async () => {
    await apiClearPlacementDefault('owner-1', 'mode:diagram');
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(calls[0]!.url).toMatch(/\/placement-defaults\/mode%3Adiagram$/);
  });

  it('surfaces a refusal by its token', async () => {
    reply = new Response(JSON.stringify({ error: 'folder_not_found' }), { status: 404 });
    const error = await apiSetPlacementDefault('owner-1', 'mode:draw', 'gone').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'folder_not_found' });
  });
});
