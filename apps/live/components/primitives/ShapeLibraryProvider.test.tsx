// @vitest-environment jsdom

// The owner's shape libraries (docs/specs/013-workspace/blueprints/shape-libraries.md "Behaviour and
// state" 3): loaded once per owner, changed through the api, every failure said in words.

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShapeLibrary } from '@livediagram/api-schema';
import { ShapeLibraryProvider, useShapeLibraries } from './ShapeLibraryProvider';

const api = vi.hoisted(() => ({
  apiListShapeLibraries: vi.fn(),
  apiCreateShapeLibrary: vi.fn(),
  apiUpdateShapeLibrary: vi.fn(),
  apiDeleteShapeLibrary: vi.fn(),
}));
vi.mock('@/lib/api/shape-libraries', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/shape-libraries')>()),
  ...api,
}));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

const item = (id: string) => ({ id, title: id, width: 10, height: 10, elements: [] });
const lib = (id: string, over: Partial<ShapeLibrary> = {}): ShapeLibrary => ({
  id,
  ownerId: 'owner-1',
  name: id,
  source: 'drawio',
  items: [item('a'), item('b')],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

function libraries(ownerId: string | null = 'owner-1') {
  return renderHook(() => useShapeLibraries(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ShapeLibraryProvider ownerId={ownerId}>{children}</ShapeLibraryProvider>
    ),
  });
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  track.mockReset();
  api.apiListShapeLibraries.mockResolvedValue([lib('one')]);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ShapeLibraryProvider', () => {
  it("loads the owner's list once", async () => {
    const view = libraries();
    expect(view.result.current.status).toBe('loading');
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    expect(view.result.current.libraries.map((l) => l.id)).toEqual(['one']);
    expect(api.apiListShapeLibraries).toHaveBeenCalledWith('owner-1');
  });

  it('says the load failed, and loads again on reload', async () => {
    api.apiListShapeLibraries.mockRejectedValueOnce(new Error('down'));
    const view = libraries();
    await waitFor(() => expect(view.result.current.status).toBe('error'));
    await act(() => view.result.current.reload());
    expect(view.result.current.status).toBe('ready');
  });

  it('creates, putting the new library first', async () => {
    api.apiCreateShapeLibrary.mockResolvedValue(lib('two'));
    const view = libraries();
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    let made: Awaited<ReturnType<typeof view.result.current.createLibrary>> | undefined;
    await act(async () => {
      made = await view.result.current.createLibrary({ name: 'two', source: 'drawio', items: [] });
    });
    expect(made).toEqual({ ok: true, library: lib('two') });
    expect(view.result.current.libraries.map((l) => l.id)).toEqual(['two', 'one']);
    expect(api.apiCreateShapeLibrary.mock.calls[0]![1]).toMatchObject({
      name: 'two',
      source: 'drawio',
    });
  });

  it('turns a refused create into its words', async () => {
    const { ApiError } = await import('@/lib/api/core');
    api.apiCreateShapeLibrary.mockRejectedValue(new ApiError('x', 413, null));
    const view = libraries();
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    let made: unknown;
    await act(async () => {
      made = await view.result.current.createLibrary({ name: 'x', source: 'drawio', items: [] });
    });
    expect(made).toEqual({ ok: false, error: 'This library is too large to store.' });
  });

  it('renames in place, and deletes one shape by sending the rest', async () => {
    api.apiUpdateShapeLibrary.mockImplementation(async (_o, id, patch) => lib(id, patch));
    const view = libraries();
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    await act(() => view.result.current.renameLibrary('one', 'Renamed'));
    expect(view.result.current.libraries[0]!.name).toBe('Renamed');
    await act(() => view.result.current.deleteItem('one', 'a'));
    expect(api.apiUpdateShapeLibrary).toHaveBeenLastCalledWith('owner-1', 'one', {
      items: [item('b')],
    });
    expect(view.result.current.libraries[0]!.items.map((i) => i.id)).toEqual(['b']);
  });

  it('deletes at once, and reloads when the server refuses', async () => {
    api.apiDeleteShapeLibrary.mockRejectedValue(new Error('down'));
    const view = libraries();
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    await act(() => view.result.current.deleteLibrary('one'));
    await waitFor(() => expect(api.apiListShapeLibraries).toHaveBeenCalledTimes(2));
    expect(track).not.toHaveBeenCalled();
    api.apiDeleteShapeLibrary.mockResolvedValue(undefined);
    await act(() => view.result.current.deleteLibrary('one'));
    expect(track).toHaveBeenCalledWith('Element', 'Deleted', 'ShapeLibrary');
  });

  it('does nothing without an owner, and is inert without a provider', async () => {
    const view = libraries(null);
    expect(view.result.current.status).toBe('ready');
    expect(api.apiListShapeLibraries).not.toHaveBeenCalled();
    const bare = renderHook(() => useShapeLibraries());
    expect(bare.result.current.libraries).toEqual([]);
    expect(
      await bare.result.current.createLibrary({ name: 'x', source: 'drawio', items: [] }),
    ).toMatchObject({ ok: false });
  });
});
