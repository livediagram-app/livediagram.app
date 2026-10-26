import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IndexClient, ShareLink } from '@liveworkspace/index-client';
import { useShareLinks } from './useShareLinks';

const link = (code: string, over: Partial<ShareLink> = {}): ShareLink => ({
  code,
  itemId: 'item-1',
  level: 'view',
  tabId: null,
  expiry: 'never',
  expiresAt: null,
  createdAt: 1,
  ...over,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(links: ShareLink[]) {
  const updates: ReturnType<typeof deferred<{ link: ShareLink }>>[] = [];
  const revokes: ReturnType<typeof deferred<void>>[] = [];
  const client = {
    listShareLinks: async () => ({ links, passwordSet: false }),
    updateShareLink: () => {
      const d = deferred<{ link: ShareLink }>();
      updates.push(d);
      return d.promise;
    },
    revokeShareLink: () => {
      const d = deferred<void>();
      revokes.push(d);
      return d.promise;
    },
  } as unknown as IndexClient;
  const onError = vi.fn();
  const hook = renderHook(() => useShareLinks(client, 'item-1', onError));
  return { hook, updates, revokes, onError };
}

describe('useShareLinks', () => {
  it('a refused edit takes back only its own field, not a newer edit to another field', async () => {
    const { hook, updates } = setup([link('a')]);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    let first!: Promise<boolean>;
    act(() => {
      first = hook.result.current.update('a', { level: 'edit' });
    });
    act(() => {
      void hook.result.current.update('a', { tabId: 'tab-2' });
    });
    expect(hook.result.current.links[0]).toMatchObject({ level: 'edit', tabId: 'tab-2' });
    await act(async () => {
      updates[0]!.reject(new Error('no'));
      await first;
    });
    expect(hook.result.current.links[0]).toMatchObject({ level: 'view', tabId: 'tab-2' });
  });

  it('an older answer does not undo a newer edit to the same field', async () => {
    const { hook, updates } = setup([link('a')]);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = hook.result.current.update('a', { level: 'edit' });
    });
    act(() => {
      second = hook.result.current.update('a', { level: 'participate' });
    });
    await act(async () => {
      updates[0]!.resolve({ link: link('a', { level: 'edit' }) });
      await first;
    });
    expect(hook.result.current.links[0]!.level).toBe('participate');
    await act(async () => {
      updates[1]!.reject(new Error('no'));
      await second;
    });
    // The newest edit was refused: back to the first, which the index took.
    expect(hook.result.current.links[0]!.level).toBe('edit');
  });

  it('a refused revoke puts the link back where it was, not at the top', async () => {
    const { hook, revokes } = setup([link('a'), link('b'), link('c')]);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    let done!: Promise<boolean>;
    act(() => {
      done = hook.result.current.revoke('b');
    });
    expect(hook.result.current.links.map((l) => l.code)).toEqual(['a', 'c']);
    await act(async () => {
      revokes[0]!.reject(new Error('no'));
      await done;
    });
    expect(hook.result.current.links.map((l) => l.code)).toEqual(['a', 'b', 'c']);
  });
});
