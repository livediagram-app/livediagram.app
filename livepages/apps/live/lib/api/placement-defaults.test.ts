import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@livepages/vitest-config/sent-request';
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
        body: init?.body ? sentJson(init) : undefined,
      });
      return reply.clone();
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('placement default calls', () => {
  it('lists the defaults', async () => {
    const defaults = [{ key: 'mode:pages', folderId: 'f1' }];
    reply = new Response(JSON.stringify({ defaults }), { status: 200 });
    expect(await apiListPlacementDefaults('owner-1')).toEqual(defaults);
    expect(calls[0]).toMatchObject({ method: 'GET' });
    expect(calls[0]!.url).toMatch(/\/placement-defaults$/);
  });

  it('sets a default with the key encoded in the path', async () => {
    await apiSetPlacementDefault('owner-1', 'mode:pages', 'f-decks');
    expect(calls[0]).toMatchObject({ method: 'PUT', body: { folderId: 'f-decks' } });
    expect(calls[0]!.url).toMatch(/\/placement-defaults\/mode%3Apages$/);
  });

  it('clears a default', async () => {
    await apiClearPlacementDefault('owner-1', 'mode:pages');
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(calls[0]!.url).toMatch(/\/placement-defaults\/mode%3Apages$/);
  });

  it('surfaces a refusal by its token', async () => {
    reply = new Response(JSON.stringify({ error: 'folder_not_found' }), { status: 404 });
    const error = await apiSetPlacementDefault('owner-1', 'mode:pages', 'gone').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'folder_not_found' });
  });
});
