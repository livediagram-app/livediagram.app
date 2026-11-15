// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerView } from '@liveworkspace/explorer';
import type { ThisBrowserItem } from '@liveworkspace/explorer/this-browser';
import { useItemArrival } from './useItemArrival';

// An editor's door from an open item (liveworkspace/docs/specs/004-index/one-explorer.md "Opening from an open item"):
// the skeleton until the place is known, then that place at once, its address in place of `?item=`, and the item
// marked there.

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const VIEWER = { id: 'me', teamIds: ['marketing'] };
const indexed = (over: Record<string, unknown>) => ({
  item: { ownerId: 'me', teamId: null, folderId: null, trashedAt: null, archivedAt: null, ...over },
});
type Props = Parameters<typeof useItemArrival>[0];
const setup = (over: Partial<Props>) => {
  const replace = vi.fn();
  const getItem = vi.fn();
  const props: Props = {
    item: 'd1',
    viewer: VIEWER,
    client: { getItem },
    local: [],
    view: { kind: 'home' },
    replace,
    ...over,
  };
  const hook = renderHook((p: Props) => useItemArrival(p), { initialProps: props });
  return { ...hook, props, replace, getItem: props.client.getItem as ReturnType<typeof vi.fn> };
};

describe('useItemArrival', () => {
  it('asks nothing and holds nothing with no item', () => {
    const { result, getItem } = setup({ item: null });
    expect(result.current).toEqual({ pending: false, arrivedItem: null, view: { kind: 'home' } });
    expect(getItem).not.toHaveBeenCalled();
  });

  it('waits for the person before asking', () => {
    const { result, getItem } = setup({ viewer: null });
    expect(result.current.pending).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("opens a team item's folder in place of the address, then marks it there", async () => {
    const getItem = vi.fn().mockResolvedValue(indexed({ teamId: 'marketing', folderId: 'f2' }));
    const { result, replace, rerender, props } = setup({
      client: { getItem },
    });
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(replace).toHaveBeenCalledWith('/explorer/team?id=marketing&folder=f2');
    // The place shows, and the item is marked, before the router has moved the address there.
    expect(result.current.view).toEqual({ kind: 'team', id: 'marketing', folderId: 'f2' });
    expect(result.current.arrivedItem).toBe('d1');
    const there: ExplorerView = { kind: 'team', id: 'marketing', folderId: 'f2', q: 'brief' };
    rerender({ ...props, client: { getItem }, view: there });
    expect(result.current.view).toBe(there);
    expect(result.current.arrivedItem).toBe('d1');
    // Moved on elsewhere: no longer marked.
    rerender({
      ...props,
      client: { getItem },
      view: { kind: 'all' },
    });
    expect(result.current.arrivedItem).toBeNull();
    expect(getItem).toHaveBeenCalledTimes(1);
    // Back on Home later: Home, not the place again.
    rerender({ ...props, client: { getItem }, view: { kind: 'home' } });
    expect(result.current.view).toEqual({ kind: 'home' });
  });

  it('follows the person who goes elsewhere before the router has moved', async () => {
    const getItem = vi.fn().mockResolvedValue(indexed({ folderId: 'f1' }));
    // A person in no team.
    const { result, rerender, props } = setup({
      client: { getItem },
      viewer: { id: 'me', teamIds: [] },
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.view).toEqual({ kind: 'folder', id: 'f1' });
    rerender({ ...props, client: { getItem }, view: { kind: 'trash' } });
    expect(result.current.view).toEqual({ kind: 'trash' });
    expect(result.current.arrivedItem).toBeNull();
    rerender({ ...props, client: { getItem }, view: { kind: 'home' } });
    expect(result.current.view).toEqual({ kind: 'home' });
  });

  it('opens This Browser at its local folder without asking the index', async () => {
    const local = [{ id: 'd1', title: 'L', folderId: 'lf' } as unknown as ThisBrowserItem];
    const { result, replace, getItem } = setup({ local });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(replace).toHaveBeenCalledWith('/explorer/offline?folder=lf');
    expect(getItem).not.toHaveBeenCalled();
  });

  it("stays where it was, dropping `?item=`, for an item the index can't answer", async () => {
    window.history.replaceState(null, '', '/explorer?item=gone&from=livediagram');
    const getItem = vi.fn().mockRejectedValue(new Error('404'));
    const { result, replace } = setup({
      item: 'gone',
      client: { getItem },
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?from=livediagram');
    expect(result.current.arrivedItem).toBeNull();
    expect(result.current.view).toEqual({ kind: 'home' });
  });

  it('drops an answer that comes after the page has gone', async () => {
    let answer: (value: unknown) => void = () => {};
    const getItem = vi.fn(
      () => new Promise<never>((resolve) => (answer = resolve as (value: unknown) => void)),
    );
    const { unmount, replace } = setup({ client: { getItem } });
    unmount();
    answer(indexed({ folderId: 'f1' }));
    await Promise.resolve();
    expect(replace).not.toHaveBeenCalled();
  });
});
