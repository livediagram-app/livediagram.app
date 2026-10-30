import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response) => {
    if (!res.ok) throw Object.assign(new Error(String(res.status)), { code: 'refused' });
    return (await res.json()) as unknown;
  }),
}));
vi.mock('../offline/offline-store', () => ({ isOfflineId: vi.fn(async () => false) }));
vi.mock('../offline/offline-threads', () => ({
  offlineFetchThreads: vi.fn(async () => ['offline']),
  offlineWriteThread: vi.fn(async () => ({ unchanged: true })),
}));

import { apiFetch } from './core';
import { isOfflineId } from '../offline/offline-store';
import { offlineFetchThreads, offlineWriteThread } from '../offline/offline-threads';
import { fetchThreads, writeThread, type ThreadAction } from './card-threads';

// A card's threads on the api (docs/specs/026-plan/items.md "Writes"; blueprint item-store.md "Editor"): each action's
// route, a tab-scoped session's tab, and a This Browser plan kept in this browser.
const SCOPE = { ownerId: 'me', projectId: 'p 1', shareCode: null, tabId: null };
const WHO = { ownerId: 'me', by: { id: 'x', name: 'Sam', color: '#000' } };

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(isOfflineId).mockResolvedValue(false);
});

describe('the thread routes', () => {
  it('reads the threads, naming a tab-scoped session’s tab', async () => {
    vi.mocked(apiFetch).mockImplementation(async () => Response.json({ threads: [] }));
    expect(await fetchThreads(SCOPE)).toEqual([]);
    await fetchThreads({ ...SCOPE, tabId: 't/1' });
    expect(vi.mocked(apiFetch).mock.calls.map((c) => c[0])).toEqual([
      '/api/projects/p%201/threads',
      '/api/projects/p%201/threads?tabId=t%2F1',
    ]);
  });

  it('sends each action to its route', async () => {
    const mentions = [{ id: 'm', name: 'Bo', start: 0, length: 3 }] as never;
    const cases: [ThreadAction, string, string, unknown][] = [
      [
        { kind: 'start', itemId: 'c1', text: 'Hi', mentions },
        'POST',
        '/items/c1/threads',
        { text: 'Hi', mentions },
      ],
      [
        { kind: 'start', itemId: 'c1', text: 'Hi', field: 'f-review' },
        'POST',
        '/items/c1/threads',
        { text: 'Hi', field: 'f-review' },
      ],
      [
        { kind: 'start', itemId: 'c1', text: 'Hi', field: 'comments' },
        'POST',
        '/items/c1/threads',
        { text: 'Hi' },
      ],
      [
        { kind: 'reply', threadId: 'th', text: 'Yes' },
        'POST',
        '/threads/th/comments',
        { text: 'Yes' },
      ],
      [
        { kind: 'edit', threadId: 'th', commentId: 'k', text: 'E' },
        'PUT',
        '/threads/th/comments/k',
        { text: 'E' },
      ],
      [
        { kind: 'delete', threadId: 'th', commentId: 'k' },
        'DELETE',
        '/threads/th/comments/k',
        undefined,
      ],
      [
        { kind: 'resolve', threadId: 'th', resolved: true },
        'POST',
        '/threads/th/resolve',
        undefined,
      ],
      [
        { kind: 'resolve', threadId: 'th', resolved: false },
        'POST',
        '/threads/th/reopen',
        undefined,
      ],
      [{ kind: 'rename', threadId: 'th', title: 'T' }, 'PUT', '/threads/th/title', { title: 'T' }],
      [
        { kind: 'addToCard', threadId: 'th', itemId: 'c2' },
        'POST',
        '/threads/th/cards',
        { itemId: 'c2' },
      ],
      [{ kind: 'deleteThread', threadId: 'th' }, 'DELETE', '/threads/th', undefined],
    ];
    for (const [action, method, path, body] of cases) {
      vi.mocked(apiFetch).mockResolvedValueOnce(Response.json({ thread: null }));
      await writeThread(SCOPE, action, WHO);
      const [url, init] = vi.mocked(apiFetch).mock.calls.at(-1)!;
      expect([init?.method, url]).toEqual([method, `/api/projects/p%201${path}`]);
      expect(init?.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body);
    }
  });

  it('takes a 204 as nothing changed, or for a thread delete as gone', async () => {
    vi.mocked(apiFetch).mockImplementation(async () => new Response(null, { status: 204 }));
    expect(
      await writeThread(SCOPE, { kind: 'resolve', threadId: 'th', resolved: true }, WHO),
    ).toEqual({
      unchanged: true,
    });
    expect(await writeThread(SCOPE, { kind: 'deleteThread', threadId: 'th' }, WHO)).toEqual({
      thread: null,
    });
  });

  it('throws a refusal', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ error: 'x' }, { status: 409 }));
    await expect(
      writeThread(SCOPE, { kind: 'reply', threadId: 'th', text: 'x' }, WHO),
    ).rejects.toMatchObject({ code: 'refused' });
  });

  it('keeps a This Browser plan’s threads in this browser', async () => {
    vi.mocked(isOfflineId).mockResolvedValue(true);
    expect(await fetchThreads(SCOPE)).toEqual(['offline']);
    await writeThread(SCOPE, { kind: 'deleteThread', threadId: 'th' }, WHO);
    expect(offlineFetchThreads).toHaveBeenCalledWith('p 1');
    expect(offlineWriteThread).toHaveBeenCalledWith(
      'p 1',
      { kind: 'deleteThread', threadId: 'th' },
      WHO,
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
