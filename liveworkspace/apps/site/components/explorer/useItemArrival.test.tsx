// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerView } from '@liveworkspace/explorer';
import type { ThisBrowserItem } from '@liveworkspace/explorer/this-browser';
import { useItemArrival } from './useItemArrival';

// An editor's door from an open item (liveworkspace/docs/specs/004-index/one-explorer.md "Opening from an open item"):
// the skeleton until the place is known, then that place's address in place of `?item=`, and the item marked there.

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
    expect(result.current).toEqual({ pending: false, arrivedItem: null });
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
    // Still on Home until the router moves: nothing marked.
    expect(result.current.arrivedItem).toBeNull();
    const there: ExplorerView = { kind: 'team', id: 'marketing', folderId: 'f2', q: 'brief' };
    rerender({ ...props, client: { getItem }, view: there });
    expect(result.current.arrivedItem).toBe('d1');
    // Moved on elsewhere: no longer marked.
    rerender({
      ...props,
      client: { getItem },
      view: { kind: 'all' },
    });
    expect(result.current.arrivedItem).toBeNull();
    expect(getItem).toHaveBeenCalledTimes(1);
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
