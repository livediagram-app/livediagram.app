// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenverseSearchError, type OpenverseImage } from '../../lib/image-search/openverse';
import type { PickOutcome, PickStage } from '../../lib/image-search/pick';
import { searchOpenverse } from '../../lib/image-search/search';
import { storeSearchResult } from '../../lib/image-search/pick';
import { createImageSearch } from './useImageSearch';

vi.mock('../../lib/image-search/search', () => ({ searchOpenverse: vi.fn() }));
vi.mock('../../lib/image-search/pick', async (actual) => ({
  ...(await actual<typeof import('../../lib/image-search/pick')>()),
  storeSearchResult: vi.fn(),
}));

const search = vi.mocked(searchOpenverse);
const store = vi.mocked(storeSearchResult);

const image = (id: string): OpenverseImage => ({
  id,
  url: `https://img.test/${id}`,
  thumbnail: `https://img.test/${id}/thumb`,
  width: 10,
  height: 10,
});
const page = (n: number, pageCount: number, ids: string[]) => ({
  page: n,
  pageCount,
  results: ids.map(image),
});

const track = vi.fn();
const session = { store: vi.fn() };
const openImportSession = vi.fn(async () => session);
const useImageSearch = createImageSearch({ track, openImportSession });

function setup(filters?: { aspect_ratio?: 'wide' }) {
  const onPicked = vi.fn();
  const hook = renderHook(() =>
    useImageSearch({ ownerId: 'o1', documentId: 'd1', onPicked, filters }),
  );
  return { hook, onPicked };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// docs/specs/009-elements/blueprints/image-search.md "Behaviour and state", bound per editor in its
// hooks/ui/useImageSearch.ts.
describe('useImageSearch', () => {
  it('ignores a blank query, searches a trimmed one with the filters, and loads more without repeats', async () => {
    search.mockResolvedValueOnce(page(1, 2, ['a', 'b']));
    const { hook } = setup({ aspect_ratio: 'wide' });
    act(() => hook.result.current.submit('   '));
    expect(search).not.toHaveBeenCalled();
    // Nothing loaded yet, so there is no more to load.
    act(() => hook.result.current.loadMore());
    expect(search).not.toHaveBeenCalled();

    act(() => hook.result.current.submit(' cats '));
    expect(track).toHaveBeenCalledWith('Element', 'Searched', 'Image');
    expect(hook.result.current.pendingQuery).toBe('cats');
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(search).toHaveBeenCalledWith('cats', 1, fetch, { aspect_ratio: 'wide' });
    expect(hook.result.current.hasMore).toBe(true);

    search.mockResolvedValueOnce(page(2, 2, ['b', 'c']));
    act(() => hook.result.current.loadMore());
    expect(hook.result.current.loadingMore).toBe(true);
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(hook.result.current.results.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(hook.result.current.hasMore).toBe(false);
    // The last page: no further load.
    act(() => hook.result.current.loadMore());
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('says why a search failed, and drops an answer a newer search overtook', async () => {
    const { hook } = setup();
    search.mockRejectedValueOnce(new OpenverseSearchError('rate-limited', 429));
    act(() => hook.result.current.submit('a'));
    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.error).toBe('rate-limited');
    expect(track).toHaveBeenCalledWith('Error', 'Warning', expect.any(String));

    search.mockRejectedValueOnce(new OpenverseSearchError('failed'));
    act(() => hook.result.current.submit('b'));
    await waitFor(() => expect(hook.result.current.error).toBe('failed'));

    search.mockRejectedValueOnce(new Error('offline'));
    act(() => hook.result.current.submit('c'));
    await waitFor(() => expect(console.warn).toHaveBeenCalledWith(
      '[image-search] search failed',
      'kind=failed',
      'status=0',
    ));

    // Two in flight: the first to be asked answers last, and is dropped, success or failure.
    let first!: (v: unknown) => void;
    let second!: (v: unknown) => void;
    search
      .mockImplementationOnce(() => new Promise((_, reject) => (first = reject)) as never)
      .mockImplementationOnce(() => new Promise((_, reject) => (second = reject)) as never)
      .mockImplementationOnce(() => new Promise((resolve) => (first = resolve)) as never)
      .mockResolvedValueOnce(page(1, 1, ['new']));
    act(() => hook.result.current.submit('old'));
    act(() => hook.result.current.submit('newer'));
    await act(async () => second(new OpenverseSearchError('failed')));
    await act(async () => first(new OpenverseSearchError('rate-limited')));
    expect(hook.result.current.error).toBe('failed');
    act(() => hook.result.current.submit('stale'));
    act(() => hook.result.current.submit('fresh'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    await act(async () => first(page(1, 1, ['stale'])));
    expect(hook.result.current.results.map((r) => r.id)).toEqual(['new']);
  });

  it('drops a search that answers after the picker closed', async () => {
    let answer!: (v: unknown) => void;
    search.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)) as never);
    const { hook } = setup();
    act(() => hook.result.current.submit('a'));
    hook.unmount();
    await act(async () => answer(page(1, 1, ['a'])));
    expect(hook.result.current.status).toBe('loading');
  });

  it('stores a pick through the import session and hands it back, one pick at a time', async () => {
    const picked = { id: 'img1', width: 10, height: 10 };
    let finish!: (o: PickOutcome) => void;
    store.mockImplementationOnce(async (_result, put, _fetch, onFallback, onStage) => {
      await put({ kind: 'blob', blob: new Blob(), name: 'a' });
      onFallback?.();
      onStage?.('saving' as PickStage);
      return new Promise<PickOutcome>((resolve) => (finish = resolve));
    });
    const { hook, onPicked } = setup();
    act(() => hook.result.current.pick(image('a')));
    expect(hook.result.current.pickingId).toBe('a');
    await waitFor(() => expect(hook.result.current.pickStage).toBe('saving'));
    expect(openImportSession).toHaveBeenCalledWith({ ownerId: 'o1', documentId: 'd1' });
    expect(session.store).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith('Error', 'Warning', 'ImageSearch.ThumbnailFallback');
    // A second press while the first is in flight does nothing.
    act(() => hook.result.current.pick(image('b')));
    expect(store).toHaveBeenCalledOnce();
    await act(async () => finish({ ok: true, picked }));
    expect(onPicked).toHaveBeenCalledWith(picked, image('a'));
    expect(hook.result.current.pickingId).toBeNull();
  });

  it('says why a pick failed, and unlocks the grid when the session throws', async () => {
    store.mockResolvedValueOnce({ ok: false, failure: 'download-failed' });
    const { hook, onPicked } = setup();
    act(() => hook.result.current.pick(image('a')));
    await waitFor(() => expect(hook.result.current.pickError).not.toBeNull());
    expect(onPicked).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Error', 'Warning', expect.any(String));

    openImportSession.mockRejectedValueOnce(new Error('chunk failed'));
    act(() => hook.result.current.pick(image('b')));
    await waitFor(() => expect(hook.result.current.pickingId).toBeNull());
    expect(hook.result.current.pickError).not.toBeNull();
  });

  it('ignores a pick that finishes after the picker closed', async () => {
    let finish!: (o: PickOutcome) => void;
    store.mockImplementationOnce(async (_r, _put, _f, _fallback, onStage) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      onStage?.('saving' as PickStage);
      return new Promise<PickOutcome>((resolve) => (finish = resolve));
    });
    const { hook, onPicked } = setup();
    act(() => hook.result.current.pick(image('a')));
    hook.unmount();
    await waitFor(() => expect(finish).toBeDefined());
    await act(async () => finish({ ok: true, picked: { id: 'x', width: 1, height: 1 } }));
    expect(onPicked).not.toHaveBeenCalled();
    expect(hook.result.current.pickStage).toBe('downloading');
  });
});
