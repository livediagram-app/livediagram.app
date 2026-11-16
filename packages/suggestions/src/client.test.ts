import { describe, expect, it, vi } from 'vitest';
import { suggestionsClient, type SuggestionRequest } from './client';
import { author, el, type El } from './test/fixtures';

const stored = {
  id: 'sg_aaaaaaaaaa',
  tabId: 't 1',
  author,
  createdAt: 1,
  ops: [{ kind: 'remove', id: 'a' }],
  base: { a: 'x' },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function client(answer: (path: string, init: { method: string; body?: unknown }) => Response) {
  const request = vi.fn<SuggestionRequest>(async (path, init) => answer(path, init));
  return { request, c: suggestionsClient<El>(request) };
}

describe('suggestionsClient', () => {
  it('lists, skipping what it cannot read', async () => {
    const { c, request } = client(() => json(200, { suggestions: [stored, { id: 'bad' }] }));
    expect((await c.list('t 1')).map((s) => s.id)).toEqual(['sg_aaaaaaaaaa']);
    expect(request).toHaveBeenCalledWith('tabs/t%201/suggestions', { method: 'GET' });
    const empty = client(() => json(200, {}));
    expect(await empty.c.list('t')).toEqual([]);
  });

  it('submits ops and reads the suggestion made', async () => {
    const { c, request } = client(() => json(201, { suggestion: stored }));
    const ops = [{ kind: 'add' as const, element: el('n'), at: 0 }];
    expect((await c.submit('t1', ops)).id).toBe('sg_aaaaaaaaaa');
    expect(request).toHaveBeenCalledWith('tabs/t1/suggestions', { method: 'POST', body: { ops } });
    await expect(client(() => json(201, {})).c.submit('t1', ops)).rejects.toThrow('bad_answer');
  });

  it('answers accept, with its conflicts, either way', async () => {
    const ok = client(() => json(200, { accepted: ['x'], conflicts: [] }));
    expect(await ok.c.accept('t1', { all: true })).toEqual({
      ok: true,
      accepted: ['x'],
      conflicts: [],
    });
    expect(ok.request).toHaveBeenCalledWith('tabs/t1/suggestions/accept', {
      method: 'POST',
      body: { all: true },
    });
    const bare = client(() => json(200, {}));
    expect(await bare.c.accept('t1', { all: true })).toEqual({
      ok: true,
      accepted: [],
      conflicts: [],
    });
    const conflict = client(() =>
      json(409, { error: 'suggestion_conflict', conflicts: [{ id: 'x', elements: ['a'] }] }),
    );
    expect(await conflict.c.accept('t1', { ids: ['x'] })).toEqual({
      ok: false,
      error: 'suggestion_conflict',
      conflicts: [{ id: 'x', elements: ['a'] }],
    });
    const broken = client(() => new Response('nope', { status: 500 }));
    expect(await broken.c.accept('t1', { all: true })).toEqual({
      ok: false,
      error: 'http_500',
      conflicts: [],
    });
  });

  it('rejects, and throws the api’s error word', async () => {
    const ok = client(() => json(200, { rejected: ['x'] }));
    expect(await ok.c.reject('t1', { ids: ['x'] })).toEqual(['x']);
    expect(await client(() => json(200, {})).c.reject('t1', { all: true })).toEqual([]);
    const refused = client(() => json(403, { error: 'editor_only' }));
    await expect(refused.c.reject('t1', { all: true })).rejects.toThrow('editor_only');
    await expect(refused.c.list('t1')).rejects.toThrow('editor_only');
    await expect(refused.c.submit('t1', [])).rejects.toThrow('editor_only');
    const bare = client(() => new Response('x', { status: 502 }));
    await expect(bare.c.list('t1')).rejects.toThrow('http_502');
  });
});
