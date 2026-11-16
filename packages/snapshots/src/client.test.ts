import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSnapshotFence,
  itemIdOf,
  reloadAfterRevert,
  resetRevertReload,
  snapshotsApi,
  SnapshotsApiError,
} from './client';
import { SNAPSHOT_FENCED_HEADER, SNAPSHOT_GENERATION_HEADER } from './wire';

afterEach(() => resetRevertReload());

function response(
  url: string,
  status: number,
  headers: Record<string, string>,
  body = '{}',
): Response {
  const res = new Response(status === 204 ? null : body, { status, headers });
  Object.defineProperty(res, 'url', { value: url });
  return res;
}

describe('itemIdOf', () => {
  it('reads the id under the collection only', () => {
    expect(itemIdOf('projects', 'https://x/api/projects/p%201/tabs/t')).toBe('p 1');
    expect(itemIdOf('projects', '/api/projects/p1')).toBe('p1');
    expect(itemIdOf('projects', '/api/documents/p1')).toBeNull();
    expect(itemIdOf('projects', '/api/projects')).toBeNull();
    expect(itemIdOf('projects', '/other/projects/p1')).toBeNull();
    expect(itemIdOf('projects', 'http://[bad')).toBeNull();
  });
});

describe('createSnapshotFence', () => {
  it('stamps nothing until a generation is known, then the highest seen for that item', () => {
    const reverted = vi.fn();
    const fence = createSnapshotFence('projects', reverted);
    const init = { method: 'PUT' };
    expect(fence.stamp('/api/projects/p1/tabs/t', init)).toBe(init);
    fence.note(response('https://x/api/projects/p1', 200, {}));
    fence.note(response('https://x/api/projects/p1', 200, { [SNAPSHOT_GENERATION_HEADER]: '2' }));
    fence.note(response('https://x/api/projects/p1', 200, { [SNAPSHOT_GENERATION_HEADER]: '1' }));
    fence.note(response('https://x/api/other', 200, { [SNAPSHOT_GENERATION_HEADER]: '7' }));
    fence.note(response('https://x/api/projects/p1', 200, { [SNAPSHOT_GENERATION_HEADER]: 'NaN' }));
    expect(fence.generationOf('p1')).toBe(2);
    expect(fence.generationOf('p2')).toBe(0);
    const stamped = fence.stamp('/api/projects/p1/tabs/t', { method: 'PUT', headers: { A: 'b' } });
    const headers = new Headers(stamped?.headers);
    expect(headers.get(SNAPSHOT_GENERATION_HEADER)).toBe('2');
    expect(headers.get('A')).toBe('b');
    expect(fence.stamp('/api/projects/p2', undefined)).toBeUndefined();
    expect(fence.stamp('/elsewhere', undefined)).toBeUndefined();
    expect(reverted).not.toHaveBeenCalled();
  });

  it('reloads on the fence refusal alone, not on any other 409', () => {
    const reverted = vi.fn();
    const fence = createSnapshotFence('documents', reverted);
    fence.note(response('https://x/api/documents/d', 409, { [SNAPSHOT_GENERATION_HEADER]: '3' }));
    expect(reverted).not.toHaveBeenCalled();
    fence.note(
      response('https://x/api/documents/d', 409, {
        [SNAPSHOT_GENERATION_HEADER]: '3',
        [SNAPSHOT_FENCED_HEADER]: '1',
      }),
    );
    expect(reverted).toHaveBeenCalledTimes(1);
  });

  it('defaults to reloading the page', () => {
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    const fence = createSnapshotFence('designs');
    expect(() =>
      fence.note(
        response('https://x/api/designs/d', 409, {
          [SNAPSHOT_GENERATION_HEADER]: '3',
          [SNAPSHOT_FENCED_HEADER]: '1',
        }),
      ),
    ).not.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('reloadAfterRevert', () => {
  it('reloads once', () => {
    const reload = vi.fn();
    reloadAfterRevert(reload);
    reloadAfterRevert(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('snapshotsApi', () => {
  it('makes the four calls and throws the server message on refusal', async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    const answers = [
      response('', 200, {}, JSON.stringify({ snapshots: [], kept: 5 })),
      response('', 201, {}, JSON.stringify({ snapshot: { id: 's_1' } })),
      response('', 204, {}),
      response(
        '',
        200,
        {},
        JSON.stringify({ reverted: { snapshotId: 's_1', safetySnapshotId: 's_2', generation: 1 } }),
      ),
      response('', 413, {}, JSON.stringify({ error: 'snapshot_too_large', message: 'Too large.' })),
      response('', 500, {}, 'oops'),
      response('', 500, {}, JSON.stringify({ error: 1, message: 2 })),
    ];
    const api = snapshotsApi({
      itemUrl: 'https://x/api/projects/p1',
      apiHeaders: async (opts): Promise<HeadersInit> =>
        opts.body ? { 'Content-Type': 'application/json' } : {},
      apiFetch: async (url, init) => {
        calls.push({ url, method: init?.method ?? 'GET', body: init?.body });
        return answers.shift()!;
      },
    });
    expect(await api.list()).toEqual({ snapshots: [], kept: 5 });
    expect((await api.take('n')).id).toBe('s_1');
    await api.remove('s 1');
    expect((await api.revert('s_1')).generation).toBe(1);
    await expect(api.take('x')).rejects.toMatchObject({
      status: 413,
      code: 'snapshot_too_large',
      message: 'Too large.',
    });
    const generic = await api.list().catch((e: unknown) => e);
    expect(generic).toBeInstanceOf(SnapshotsApiError);
    expect((generic as SnapshotsApiError).message).toBe('Something went wrong. Try again.');
    await expect(api.list()).rejects.toMatchObject({ code: null });
    expect(calls.map((c) => `${c.method} ${c.url}`).slice(0, 4)).toEqual([
      'GET https://x/api/projects/p1/snapshots',
      'POST https://x/api/projects/p1/snapshots',
      'DELETE https://x/api/projects/p1/snapshots/s%201',
      'POST https://x/api/projects/p1/snapshots/s_1/revert',
    ]);
    expect(calls[1]!.body).toBe(JSON.stringify({ name: 'n' }));
  });
});
